/**
 * ProjectCompletenessService — Phase 1.1
 *
 * Single owner of the reactive EIE completeness sequence for PROJECT entities:
 *   1. Load the project (via IProjectRepository — no direct Prisma).
 *   2. Resolve the CURRENTLY-APPLICABLE Information Requirements, passing the
 *      project's real current responses so `appliesWhen` reacts to answers and
 *      to `hasCustomer`.
 *   3. Gather current responses.
 *   4. Recompute EntityCompleteness with inputs (questions + responses).
 *   5. Persist the snapshot (CompletenessService.recompute does the upsert).
 *
 * This is the shared application service both:
 *   - ProjectsAdapter.onProjectCreated (create-time), and
 *   - the response-triggered recompute (record/update/supersede)
 * invoke, so completeness logic is NOT duplicated and Projects never owns it.
 *
 * Phase-2 replaceability: today this is invoked directly (a local Phase 1
 * mechanism). In Phase 2 the same method will be invoked by an
 * enterprise.eie.response.recorded consumer instead of a direct call. No
 * second event bus is introduced here.
 *
 * ID-matching invariant (Phase 1.1 fix): responses are stored by LOCAL
 * questionId (e.g. "priority"), while resolved questions carry both a
 * qualified `id` ("core.priority") and a local `questionId`. Completeness
 * matching MUST use the local questionId so answered questions are counted.
 */

import { forwardRef, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  PROJECT_REPOSITORY,
  type IProjectRepository,
} from '../../projects/interfaces/project.interface';
import { ProjectTypesService } from '../../project-types/project-types.service';
import { RequirementsService } from '../requirements/requirements.service';
import { ResponseService } from '../responses/response.service';
import { CompletenessService } from '../completeness/completeness.service';
import { ProjectTypePacksService } from '../project-type-packs/project-type-packs.service';
import { EVENT_TRANSPORT } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { ResolvedQuestion } from '../requirements/interfaces/requirements.interface';
import type { EntityCompletenessSnapshot } from '../completeness/interfaces/completeness.interface';

@Injectable()
export class ProjectCompletenessService {
  private readonly logger = new Logger(ProjectCompletenessService.name);

  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(forwardRef(() => ProjectTypesService))
    private readonly projectTypesService: ProjectTypesService,
    private readonly projectTypePacksService: ProjectTypePacksService,
    private readonly requirementsService: RequirementsService,
    private readonly responseService: ResponseService,
    private readonly completenessService: CompletenessService,
    // Optional: publish enterprise.eie.completeness.changed when the fabric is
    // wired. Non-transactional publish (post-recompute) — documented in the
    // Phase 2 report as a non-transactional producer (ADR-001 §8).
    @Optional()
    @Inject(EVENT_TRANSPORT)
    private readonly transport?: IEnterpriseEventTransport,
  ) {}

  /**
   * Resolve the currently-applicable requirements for a project, using its
   * real current responses so `appliesWhen` (and hasCustomer) react.
   * Returns [] for untyped projects or missing versions.
   */
  async resolveApplicable(
    projectId: string,
    tenantId: string,
  ): Promise<ResolvedQuestion[]> {
    const project = await this.projectRepository.findById(projectId, tenantId);
    if (!project || !project.projectTypeId) return [];

    const version = await this.projectTypesService.getCurrentVersion(
      project.projectTypeId,
      project.tenantId,
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

    const current = await this.responseService.listCurrent(
      'PROJECT',
      projectId,
    );

    return this.requirementsService.resolveForProjectType(
      version.informationRequirements ?? [],
      linkedPacks,
      {
        entityType: 'PROJECT',
        entityId: projectId,
        hasCustomer: !!project.customerId,
        classification: null,
        currentResponses: current.map((r) => ({
          questionId: r.questionId,
          value: r.value,
          confidence: r.confidence,
        })),
      },
    );
  }

  /**
   * Recompute + persist completeness for a project against its current
   * applicable requirements and current responses. Returns the snapshot.
   *
   * This is the single reactive-recompute entry point. Invoked at create
   * time (adapter) and after every response mutation (record/supersede).
   */
  async recomputeForProject(
    projectId: string,
    tenantId: string,
  ): Promise<EntityCompletenessSnapshot> {
    const project = await this.projectRepository.findById(projectId, tenantId);
    // Untyped or unknown project → empty snapshot (score 100, 0 required).
    if (!project || !project.projectTypeId) {
      return this.completenessService.recompute('PROJECT', projectId);
    }

    const resolved = await this.resolveApplicable(projectId, tenantId);
    if (resolved.length === 0) {
      return this.completenessService.recompute('PROJECT', projectId);
    }

    const current = await this.responseService.listCurrent(
      'PROJECT',
      projectId,
    );

    // ID-matching invariant: match on LOCAL questionId. Resolved questions
    // expose `questionId` (local) and `id` (qualified). Responses are stored
    // by local questionId, so completeness must key on local ids.
    const snapshot = await this.completenessService.recompute(
      'PROJECT',
      projectId,
      {
        questions: resolved.map((q) => ({
          id: q.questionId,
          label: q.label,
          required: q.required,
          ...(q.skipIfConfidenceGte !== undefined
            ? { skipIfConfidenceGte: q.skipIfConfidenceGte }
            : {}),
        })),
        responses: current.map((r) => ({
          questionId: r.questionId,
          value: r.value,
          confidence: r.confidence,
        })),
      },
    );

    this.logger.debug(
      `recomputeForProject ${projectId}: ${snapshot.score}% ` +
        `(${snapshot.totalResolved}/${snapshot.totalRequired})`,
    );

    // Publish enterprise.eie.completeness.changed (best-effort, post-recompute).
    // Non-transactional: the completeness snapshot upsert already committed;
    // classified as a non-transactional producer in the Phase 2 report.
    if (this.transport) {
      try {
        await this.transport.publish({
          eventType: 'enterprise.eie.completeness.changed',
          tenantId,
          actorType: 'SYSTEM',
          idempotencyKey: `eie.completeness.${projectId}.${snapshot.totalResolved}.${snapshot.totalRequired}.${snapshot.score}`,
          sourceModule: 'information-engine',
          payload: {
            entityType: 'PROJECT',
            entityId: projectId,
            score: snapshot.score,
            totalRequired: snapshot.totalRequired,
            totalResolved: snapshot.totalResolved,
          },
        });
      } catch (e) {
        this.logger.warn(
          `Failed to publish completeness.changed for ${projectId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    return snapshot;
  }
}
