/**
 * Engine — Public read endpoints (Phase 2E)
 *
 * Exposes the engine's read paths (resolveForProjectType, pickNext, getCompleteness)
 * over HTTP for callers that don't have a project-creation event to latch onto
 * (e.g. the tenant's Discovery step fetches these AFTER the project is created).
 *
 * Endpoints under /v1/projects/:id/*:
 *   GET /:id/information-requirements
 *   GET /:id/next-question
 *
 * Writes (recordResponse, acceptCandidates, parseReply) live in the
 * Responses / Completeness / Interview / Extraction modules respectively.
 */

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirementsService } from './requirements/requirements.service';
import { AdaptiveQuestioningService } from './requirements/adaptive-questioning.service';
import { CompletenessService } from './completeness/completeness.service';
import { ResponseService } from './responses/response.service';
import { ProjectTypePacksService } from './project-type-packs/project-type-packs.service';
import { ProjectTypesService } from '../project-types/project-types.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { Project } from '../projects/interfaces/project.interface';
import type { ResolvedQuestion } from './requirements/interfaces/requirements.interface';

@Controller({ path: 'projects/:projectId', version: '1' })
@ApiCommon('information-engine')
@UseGuards(JwtAuthGuard)
export class EngineReadController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectTypesService: ProjectTypesService,
    private readonly projectTypePacksService: ProjectTypePacksService,
    private readonly requirementsService: RequirementsService,
    private readonly adaptiveQuestioningService: AdaptiveQuestioningService,
    private readonly responseService: ResponseService,
    private readonly completenessService: CompletenessService,
  ) {}

  @Get('information-requirements')
  async getRequirements(@Param('projectId') projectId: string) {
    const resolved = await this.resolveForProject(projectId);
    return { questions: resolved };
  }

  @Get('next-question')
  async getNextQuestion(@Param('projectId') projectId: string) {
    const resolved = await this.resolveForProject(projectId);
    const current = await this.responseService.listCurrent(
      'PROJECT',
      projectId,
    );
    const currentResponses = current.map((r) => ({
      questionId: r.questionId,
      value: r.value,
      confidence: r.confidence,
    }));
    const next = await this.adaptiveQuestioningService.pickNext(resolved, {
      entityType: 'PROJECT',
      entityId: projectId,
      hasCustomer: undefined,
      classification: null,
      currentResponses,
    });

    let existingResponse: { value: unknown; confidence: number } | null = null;
    if (next) {
      const localId = next.id.startsWith(`${next.packKey}.`)
        ? next.id.slice(next.packKey.length + 1)
        : next.id;
      const found = current.find(
        (r) =>
          r.questionId === next.questionId ||
          r.questionId === localId ||
          r.questionId === next.id,
      );
      if (found && found.value !== null && found.value !== undefined && found.value !== '') {
        existingResponse = { value: found.value, confidence: found.confidence };
      }
    }

    return { question: next, existingResponse };
  }

  private async resolveForProject(
    projectId: string,
  ): Promise<ResolvedQuestion[]> {
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
        hasCustomer: !!project.customerId,
        classification: null,
        currentResponses: [],
      },
    );
  }
}
