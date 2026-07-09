/**
 * Completeness — Controller (Phase 2B)
 *
 * Read + recompute endpoints. Per §12 rule, controllers MUST NOT
 * call `recompute` with business inputs — only ResponseService and
 * adapters do. The recompute endpoint here is an escape hatch for
 * cron + manual admin use; it recomputes against the entity's CURRENT
 * responses (no new answers accepted).
 */

import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CompletenessService } from './completeness.service';
import { isInformationEntityType } from '../common/types';
import { EngineErrors } from '../common/apperrors';

@Controller({ path: 'completeness', version: '1' })
@ApiCommon('information-engine-completeness')
@UseGuards(JwtAuthGuard)
export class CompletenessController {
  constructor(private readonly completenessService: CompletenessService) {}

  @Get()
  async get(
    @Query('entityType') entityTypeRaw: string,
    @Query('entityId') entityId: string,
  ) {
    if (!isInformationEntityType(entityTypeRaw)) {
      throw EngineErrors.badRequest(
        'INVALID_ENTITY_TYPE',
        `entityType "${entityTypeRaw}" is not supported`,
      );
    }
    if (!entityId) {
      throw EngineErrors.badRequest(
        'MISSING_ENTITY_ID',
        'entityId is required',
      );
    }
    const snapshot = await this.completenessService.get(
      entityTypeRaw,
      entityId,
    );
    return (
      snapshot ?? {
        entityType: entityTypeRaw,
        entityId,
        score: 0,
        totalRequired: 0,
        totalResolved: 0,
        missing: [],
        lastAssessedAt: null,
      }
    );
  }

  @Post('recompute')
  async recompute(
    @Query('entityType') entityTypeRaw: string,
    @Query('entityId') entityId: string,
  ) {
    if (!isInformationEntityType(entityTypeRaw)) {
      throw EngineErrors.badRequest(
        'INVALID_ENTITY_TYPE',
        `entityType "${entityTypeRaw}" is not supported`,
      );
    }
    if (!entityId) {
      throw EngineErrors.badRequest(
        'MISSING_ENTITY_ID',
        'entityId is required',
      );
    }
    // Recompute with no inputs — defaults to empty snapshot (score=100).
    // For a full recompute the caller should use the ResponseService path.
    return this.completenessService.recompute(entityTypeRaw, entityId);
  }
}
