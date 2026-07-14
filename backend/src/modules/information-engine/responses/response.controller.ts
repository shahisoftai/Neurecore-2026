/**
 * Responses — Controller (Phase 2B)
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ResponseService } from './response.service';
import { RecordResponseDto, ListResponsesDto } from './dto/response.dto';
import { isInformationEntityType } from '../common/types';
import { EngineErrors } from '../common/apperrors';
import { EVENT_TRANSPORT } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { ProjectCompletenessService } from '../clients/project-completeness.service';

interface RequestWithUser {
  user?: { tenantId?: string };
}

@Controller({ path: 'responses', version: '1' })
@ApiCommon('information-engine-responses')
@UseGuards(JwtAuthGuard)
export class ResponseController {
  constructor(
    private readonly responseService: ResponseService,
    // ModuleRef lets us resolve ProjectCompletenessService lazily at request
    // time. This breaks the construction-time DI cycle between ResponsesModule
    // and ClientsModule (which imports ResponsesModule) — no module import edge
    // is added, so no circular module dependency. This is the local Phase-1
    // invocation mechanism; Phase 2 will replace it with an
    // enterprise.eie.response.recorded consumer. No temporary event bus.
    private readonly moduleRef: ModuleRef,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async record(@Body() dto: RecordResponseDto, @Req() req: RequestWithUser) {
    if (!isInformationEntityType(dto.entityType)) {
      throw EngineErrors.badRequest(
        'INVALID_ENTITY_TYPE',
        `entityType "${dto.entityType}" is not supported`,
      );
    }
    const response = await this.responseService.record(
      dto.entityType,
      dto.entityId,
      {
        questionId: dto.questionId,
        value: dto.value,
        sourceType: dto.sourceType as never,
        sourceLabel: dto.sourceLabel,
        sourceRefType: dto.sourceRefType ?? null,
        sourceRefId: dto.sourceRefId ?? null,
        confidence: dto.confidence,
        verified: dto.verified,
        skipSupersede: dto.skipSupersede,
      },
    );

    // Phase 2: publish enterprise.eie.response.recorded (best-effort, after the
    // response persisted). Non-transactional producer — the response write
    // already committed inside ResponseService; classified as non-transactional
    // in the Phase 2 report. Idempotency-keyed to the created response id.
    const tenantId = req.user?.tenantId ?? '';
    if (tenantId) {
      const transport = this.resolveTransport();
      if (transport) {
        try {
          await transport.publish({
            eventType: 'enterprise.eie.response.recorded',
            tenantId,
            actorType: 'HUMAN',
            actorId: (req.user as { sub?: string })?.sub ?? null,
            idempotencyKey: `eie.response.recorded.${response.id}`,
            sourceModule: 'information-engine',
            payload: {
              entityType: dto.entityType,
              entityId: dto.entityId,
              questionId: dto.questionId,
              responseId: response.id,
              sourceType: dto.sourceType,
              confidence: dto.confidence ?? null,
            },
          });
        } catch {
          // Publication failure must not fail the user's write.
        }
      }
    }

    // Phase 1.1: reactive completeness. After recording (which includes
    // supersession), recompute the entity's completeness snapshot and return
    // it so the tenant UI reflects updated organizational state without a
    // separate fetch. Only PROJECT entities have a completeness owner today.
    let completeness: Awaited<
      ReturnType<ProjectCompletenessService['recomputeForProject']>
    > | null = null;
    if (dto.entityType === 'PROJECT') {
      const svc = this.resolveProjectCompleteness();
      if (svc) {
        completeness = await svc.recomputeForProject(dto.entityId, tenantId);
      }
    }

    return { response, completeness };
  }

  /** Resolve the event transport lazily (no module import edge). */
  private resolveTransport(): IEnterpriseEventTransport | null {
    try {
      return this.moduleRef.get<IEnterpriseEventTransport>(EVENT_TRANSPORT, {
        strict: false,
      });
    } catch {
      return null;
    }
  }

  /**
   * Resolve ProjectCompletenessService lazily (no compile-time or module
   * import dependency). Returns null if unavailable (e.g. isolated unit test).
   */
  private resolveProjectCompleteness(): ProjectCompletenessService | null {
    try {
      return this.moduleRef.get<ProjectCompletenessService>(
        'PROJECT_COMPLETENESS_SERVICE',
        { strict: false },
      );
    } catch {
      return null;
    }
  }

  @Get()
  async list(@Query() query: ListResponsesDto) {
    if (!isInformationEntityType(query.entityType)) {
      throw EngineErrors.badRequest(
        'INVALID_ENTITY_TYPE',
        `entityType "${query.entityType}" is not supported`,
      );
    }
    if (query.questionId) {
      return this.responseService.listHistory(
        query.entityType,
        query.entityId,
        query.questionId,
      );
    }
    return this.responseService.listCurrent(query.entityType, query.entityId);
  }
}
