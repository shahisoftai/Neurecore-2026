/**
 * Interview — Controller (Phase 2E)
 *
 * Two POST endpoints under /v1/projects/:id/interview/*:
 *   - POST /ask    → askNext (returns prompt + question + completeness)
 *   - POST /answer → parseReply (persists extracted responses + completeness)
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { InterviewService } from './interview.service';

interface AnswerDto {
  message: string;
}

@Controller({ path: 'projects/:projectId/interview', version: '1' })
@ApiCommon('information-engine-interview')
@UseGuards(JwtAuthGuard)
export class InterviewController {
  constructor(private readonly service: InterviewService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  async ask(@Req() req: Request, @Param('projectId') projectId: string) {
    const tenantId =
      (req as Request & { user?: { tenantId?: string | null } }).user
        ?.tenantId ?? null;
    return this.service.askNext(projectId, tenantId ?? 'system', {});
  }

  @Post('answer')
  @HttpCode(HttpStatus.OK)
  async answer(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Body() dto: AnswerDto,
  ) {
    const tenantId =
      (req as Request & { user?: { tenantId?: string | null } }).user
        ?.tenantId ?? null;
    return this.service.parseReply(
      projectId,
      tenantId ?? 'system',
      dto.message,
      {},
    );
  }
}
