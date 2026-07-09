/**
 * Responses — Service (Phase 2B)
 *
 * Single Responsibility: orchestrate InformationResponse lifecycle.
 * Atomic supersede pattern: when a new response is recorded for a (entity,
 * question) pair, the previous current row's supersededById is set to the
 * new row's id in a single logical operation.
 *
 * Does NOT trigger CompletenessService directly — the caller (adapter or
 * controller) supplies the recompute inputs and calls CompletenessService.
 * This keeps ResponsesService free of cyclic dependencies on Requirements.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { RESPONSE_REPOSITORY } from './interfaces/response.interface';
import type {
  IResponseService,
  IResponseRepository,
  RecordResponseInput,
  InformationResponse,
} from './interfaces/response.interface';
import { SourceService } from '../sources/source.service';
import { EngineErrors } from '../common/apperrors';
import type { InformationEntityType } from '../common/types';

@Injectable()
export class ResponseService implements IResponseService {
  private readonly logger = new Logger(ResponseService.name);

  constructor(
    @Inject(RESPONSE_REPOSITORY) private readonly repo: IResponseRepository,
    private readonly sourceService: SourceService,
  ) {}

  async record(
    entityType: InformationEntityType,
    entityId: string,
    dto: RecordResponseInput,
  ): Promise<InformationResponse> {
    if (!dto.questionId || dto.questionId.trim().length === 0) {
      throw EngineErrors.badRequest(
        'INVALID_QUESTION_ID',
        'questionId is required',
      );
    }
    if (!entityId || entityId.trim().length === 0) {
      throw EngineErrors.badRequest(
        'INVALID_ENTITY_ID',
        'entityId is required',
      );
    }

    const confidence =
      typeof dto.confidence === 'number'
        ? Math.max(0, Math.min(100, dto.confidence))
        : 100;

    const source = await this.sourceService.create(
      {
        type: dto.sourceType,
        label: dto.sourceLabel,
        refType: dto.sourceRefType ?? null,
        refId: dto.sourceRefId ?? null,
        confidence,
      },
      `${entityType}:${entityId}`,
    );

    if (dto.verified) {
      await this.sourceService.verify(source.id, `${entityType}:${entityId}`);
    }

    const created = await this.repo.create({
      entityType,
      entityId,
      questionId: dto.questionId,
      value: dto.value,
      sourceType: dto.sourceType,
      sourceLabel: dto.sourceLabel,
      sourceRefType: dto.sourceRefType ?? null,
      sourceRefId: dto.sourceRefId ?? null,
      confidence,
      sourceId: source.id,
    });

    if (!dto.skipSupersede) {
      const previous = await this.repo.findCurrentByEntityAndQuestion(
        entityType,
        entityId,
        dto.questionId,
      );
      if (previous && previous.id !== created.id) {
        await this.repo.markSuperseded(previous.id, created.id);
        this.logger.debug(
          `Superseded response ${previous.id} → ${created.id} for ${entityType}/${entityId}/${dto.questionId}`,
        );
      }
    }

    return created;
  }

  async listCurrent(
    entityType: InformationEntityType,
    entityId: string,
  ): Promise<InformationResponse[]> {
    return this.repo.listCurrent(entityType, entityId);
  }

  async listHistory(
    entityType: InformationEntityType,
    entityId: string,
    questionId: string,
  ): Promise<InformationResponse[]> {
    return this.repo.listHistory(entityType, entityId, questionId);
  }
}
