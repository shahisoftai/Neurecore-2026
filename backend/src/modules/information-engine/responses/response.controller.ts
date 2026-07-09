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
  UseGuards,
} from '@nestjs/common';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ResponseService } from './response.service';
import { RecordResponseDto, ListResponsesDto } from './dto/response.dto';
import { isInformationEntityType } from '../common/types';
import { EngineErrors } from '../common/apperrors';

@Controller({ path: 'responses', version: '1' })
@ApiCommon('information-engine-responses')
@UseGuards(JwtAuthGuard)
export class ResponseController {
  constructor(private readonly responseService: ResponseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async record(@Body() dto: RecordResponseDto) {
    if (!isInformationEntityType(dto.entityType)) {
      throw EngineErrors.badRequest(
        'INVALID_ENTITY_TYPE',
        `entityType "${dto.entityType}" is not supported`,
      );
    }
    return this.responseService.record(dto.entityType, dto.entityId, {
      questionId: dto.questionId,
      value: dto.value,
      sourceType: dto.sourceType as never,
      sourceLabel: dto.sourceLabel,
      sourceRefType: dto.sourceRefType ?? null,
      sourceRefId: dto.sourceRefId ?? null,
      confidence: dto.confidence,
      verified: dto.verified,
      skipSupersede: dto.skipSupersede,
    });
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
