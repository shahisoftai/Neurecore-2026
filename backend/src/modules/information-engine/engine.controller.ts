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

import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdaptiveQuestioningService } from './requirements/adaptive-questioning.service';
import { ResponseService } from './responses/response.service';
import type { ProjectCompletenessService } from './clients/project-completeness.service';
import type { ResolvedQuestion } from './requirements/interfaces/requirements.interface';

interface RequestWithUser {
  user?: { tenantId?: string };
}

@Controller({ path: 'projects/:projectId', version: '1' })
@ApiCommon('information-engine')
@UseGuards(JwtAuthGuard)
export class EngineReadController {
  constructor(
    private readonly adaptiveQuestioningService: AdaptiveQuestioningService,
    private readonly responseService: ResponseService,
    // Resolved lazily via ModuleRef to avoid a construction-time module cycle
    // (ClientsModule imports ProjectsModule → InformationEngineModule →
    // EngineReadModule). See ResponseController for the same pattern.
    private readonly moduleRef: ModuleRef,
  ) {}

  private projectCompleteness(): ProjectCompletenessService {
    return this.moduleRef.get<ProjectCompletenessService>(
      'PROJECT_COMPLETENESS_SERVICE',
      { strict: false },
    );
  }

  @Get('information-requirements')
  async getRequirements(
    @Param('projectId') projectId: string,
    @Req() req: RequestWithUser,
  ) {
    const tenantId = req.user?.tenantId ?? '';
    const resolved: ResolvedQuestion[] = await this.projectCompleteness()
      .resolveApplicable(projectId, tenantId);
    return { questions: resolved };
  }

  @Get('next-question')
  async getNextQuestion(
    @Param('projectId') projectId: string,
    @Req() req: RequestWithUser,
  ) {
    const tenantId = req.user?.tenantId ?? '';
    const resolved = await this.projectCompleteness().resolveApplicable(
      projectId,
      tenantId,
    );
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
}
