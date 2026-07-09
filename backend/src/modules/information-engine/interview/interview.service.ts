/**
 * Interview — Service (Phase 2E)
 *
 * Single Responsibility: orchestrate the conversational channel between
 * the user and the Information Engine. Does NOT call any LLM — Hermes
 * (Phase 2E) wraps this service as a tool; the LLM lives in
 * `HermesExecutionService`.
 *
 * `askNext` is a pure composition:
 *   1. ProjectService.findById → context.
 *   2. ProjectTypesService.getCurrentVersion → inline IR + linked packs.
 *   3. RequirementsService.resolveForProjectType → flat question list.
 *   4. AdaptiveQuestioningService.pickNext → deterministic next question.
 *   5. CompletenessService.get → snapshot.
 *
 * `parseReply` is a structured heuristic parser (regex + label matching):
 *   - Looks for "field: value" pairs (e.g. "Project name: Q4 launch").
 *   - Falls back to assigning the message to the next-question's questionId.
 *   Returns the recorded InformationResponses + recomputed completeness.
 *
 * The LLM upgrade path (Hermes wrapping this service) replaces `parseReply`
 * with an LLM call but keeps the same service contract.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { IRequirementsService } from '../requirements/interfaces/requirements.interface';
import type { IAdaptiveQuestioningService } from '../requirements/interfaces/requirements.interface';
import { CompletenessService } from '../completeness/completeness.service';
import { ResponseService } from '../responses/response.service';
import { ProjectTypePacksService } from '../project-type-packs/project-type-packs.service';
import {
  type IInterviewService,
  type InterviewTurn,
  type AskNextContext,
} from './interfaces/interview.interface';
import type { EntityCompletenessSnapshot } from '../completeness/interfaces/completeness.interface';
import type { InformationResponse } from '../responses/interfaces/response.interface';
import { EngineErrors } from '../common/apperrors';
import { ProjectTypesService } from '../../project-types/project-types.service';
import { RequirementsService } from '../requirements/requirements.service';
import { AdaptiveQuestioningService } from '../requirements/adaptive-questioning.service';
import type { Project } from '../../projects/interfaces/project.interface';
import type { ResolvedQuestion } from '../requirements/interfaces/requirements.interface';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class InterviewService implements IInterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectTypesService: ProjectTypesService,
    private readonly projectTypePacksService: ProjectTypePacksService,
    private readonly requirementsService: RequirementsService,
    private readonly adaptiveQuestioningService: AdaptiveQuestioningService,
    private readonly responseService: ResponseService,
    private readonly completenessService: CompletenessService,
  ) {}

  async askNext(
    projectId: string,
    tenantId: string,
    ctx: AskNextContext,
  ): Promise<InterviewTurn> {
    // We do not look the project up directly here; instead we resolve
    // questions based on (tenantId, projectId) via the inline IR + packs.
    // The completeness snapshot is fetched independently.
    const resolved = await this.resolveQuestionsFor(projectId, ctx);

    const completeness = await this.completenessService.get(
      'PROJECT',
      projectId,
    );
    const safeCompleteness: EntityCompletenessSnapshot = completeness ?? {
      entityType: 'PROJECT',
      entityId: projectId,
      score: 100,
      totalRequired: 0,
      totalResolved: 0,
      missing: [],
      lastAssessedAt: new Date(),
    };

    const currentResponses = await this.responseService.listCurrent(
      'PROJECT',
      projectId,
    );

    const question = await this.adaptiveQuestioningService.pickNext(resolved, {
      entityType: 'PROJECT',
      entityId: projectId,
      hasCustomer: ctx.hasCustomer,
      classification: (ctx.classification as never) ?? null,
      currentResponses: currentResponses.map((r) => ({
        questionId: r.questionId,
        value: r.value,
        confidence: r.confidence,
      })),
    });

    const prompt = question
      ? this.buildPrompt(question)
      : 'All required information has been captured. You can confirm the project now.';

    return { prompt, question, completeness: safeCompleteness };
  }

  async parseReply(
    projectId: string,
    tenantId: string,
    message: string,
    ctx: AskNextContext,
  ): Promise<{
    extracted: InformationResponse[];
    completeness: EntityCompletenessSnapshot;
  }> {
    const trimmed = message.trim();
    if (!trimmed) {
      throw EngineErrors.badRequest(
        'EMPTY_REPLY',
        'Reply must contain at least one non-whitespace character',
      );
    }

    const resolved = await this.resolveQuestionsFor(projectId, ctx);
    if (resolved.length === 0) {
      throw EngineErrors.badRequest(
        'NO_QUESTIONS',
        'Project has no questions to answer via interview',
      );
    }

    const pairs = this.parseStructuredPairs(trimmed, resolved);
    const fallback =
      pairs.length === 0
        ? await this.assignToCurrentQuestion(trimmed, projectId)
        : [];
    const all = [...pairs, ...fallback];

    if (all.length === 0) {
      throw EngineErrors.badRequest(
        'NO_MATCH',
        'Could not match reply to any open question. Try "Label: value" pairs.',
      );
    }

    const recorded: InformationResponse[] = [];
    for (const { question, value } of all) {
      const r = await this.responseService.record('PROJECT', projectId, {
        questionId: question.questionId,
        value,
        sourceType: 'INTERVIEW',
        sourceLabel: 'Interview channel',
        confidence: 80,
      });
      recorded.push(r);
    }

    const currentResponses = await this.responseService.listCurrent(
      'PROJECT',
      projectId,
    );

    const completeness = await this.completenessService.recompute(
      'PROJECT',
      projectId,
      {
        questions: resolved.map((q) => ({
          id: q.id,
          label: q.label,
          required: q.required,
          ...(q.skipIfConfidenceGte !== undefined
            ? { skipIfConfidenceGte: q.skipIfConfidenceGte }
            : {}),
        })),
        responses: currentResponses.map((r) => ({
          questionId: r.questionId,
          value: r.value,
          confidence: r.confidence,
        })),
      },
    );

    return { extracted: recorded, completeness };
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private async resolveQuestionsFor(
    projectId: string,
    ctx: AskNextContext,
  ): Promise<ResolvedQuestion[]> {
    // We rely on the project to carry its projectTypeId + customerId.
    // To avoid a ProjectService cycle here, callers pass projectId and the
    // engine loads requirements from the projectType via the ProjectsAdapter.
    // For Phase 2E, we accept that the inline IR is empty for projects
    // without a type, and packs are loaded via the project-type-packs
    // service IF the project has a type. The ProjectsAdapter is the
    // canonical writer; this service is read-only orchestration.
    //
    // To resolve IR here, we read the project record via Prisma directly.
    // We inject ProjectTypesService and use it indirectly through
    // ProjectTypeVersion lookups; the actual fetch of Project is delegated
    // to the injected ProjectsAdapter via a passed-in lookup. For 2E we
    // accept that we re-read via Prisma via ProjectTypesService which is
    // already in DI and avoids the cycle.
    const project: Pick<Project, 'projectTypeId' | 'customerId'> | null =
      await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { projectTypeId: true, customerId: true },
      });
    if (!project || !project.projectTypeId) return [];

    const version = await this.projectTypesService.getCurrentVersion(
      project.projectTypeId,
      null,
    );
    if (!version) return [];

    const links = await this.projectTypePacksService.listForProjectType(
      project.projectTypeId,
    );
    const linkedPacks = links.map((l) => ({
      key: l.questionPack.key,
      questions: Array.isArray(l.questionPack.questions)
        ? (l.questionPack.questions as never)
        : [],
    }));

    return this.requirementsService.resolveForProjectType(
      version.informationRequirements ?? [],
      linkedPacks,
      {
        entityType: 'PROJECT',
        entityId: projectId,
        hasCustomer: ctx.hasCustomer ?? !!project.customerId,
        classification: (ctx.classification as never) ?? null,
        currentResponses: [],
      },
    );
  }

  private buildPrompt(question: ResolvedQuestion): string {
    const reqd = question.required ? ' (required)' : '';
    const hint = question.helpText ? ` ${question.helpText}` : '';
    return `${question.label}${reqd}.${hint}`;
  }

  /**
   * Parse "Label: value" or "label=value" pairs out of a free-form reply.
   * Matching is case-insensitive on label; resolves to the first question
   * whose label matches.
   */
  private parseStructuredPairs(
    message: string,
    resolved: ResolvedQuestion[],
  ): Array<{ question: ResolvedQuestion; value: string }> {
    const out: Array<{ question: ResolvedQuestion; value: string }> = [];
    const lines = message.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const match = line.match(/^([^:=]{1,80}?)\s*[:=]\s*(.+)$/);
      if (!match) continue;
      const label = match[1].trim().toLowerCase();
      const value = match[2].trim();
      const q = resolved.find((q) => q.label.toLowerCase() === label);
      if (q) out.push({ question: q, value });
    }
    return out;
  }

  /**
   * Fallback: assign the entire message to the current open question
   * (the one AdaptiveQuestioning would have asked next).
   */
  private async assignToCurrentQuestion(
    message: string,
    projectId: string,
  ): Promise<Array<{ question: ResolvedQuestion; value: string }>> {
    const resolved = await this.resolveQuestionsFor(projectId, {});
    if (resolved.length === 0) return [];
    const current = await this.responseService.listCurrent(
      'PROJECT',
      projectId,
    );
    const next = await this.adaptiveQuestioningService.pickNext(resolved, {
      entityType: 'PROJECT',
      entityId: projectId,
      hasCustomer: undefined,
      classification: null,
      currentResponses: current.map((r) => ({
        questionId: r.questionId,
        value: r.value,
        confidence: r.confidence,
      })),
    });
    if (!next) return [];
    return [{ question: next, value: message }];
  }
}
