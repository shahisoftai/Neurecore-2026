/**
 * execution-log module — REST API Controller
 *
 * Phase 4: Append-only log. GET and POST only — no PUT/PATCH/DELETE.
 * SOLID: Thin controller, delegates to ExecutionLogService.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExecutionLogService } from './execution-log.service';
import { CreateLogEntryDto, ListLogEntriesDto } from './dto/execution-log.dto';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import type { TaskExecutionLogEntry } from './interfaces/execution-log.interface';

@ApiCommon('execution-log')
@Controller({ path: 'execution-log', version: '1' })
@UseGuards(JwtAuthGuard)
export class ExecutionLogController {
  constructor(private readonly logService: ExecutionLogService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateLogEntryDto) {
    return this.logService.log({
      taskId: dto.taskId,
      agentId: dto.agentId,
      action: dto.action,
      actorType: dto.actorType ?? 'HUMAN',
      actorId: dto.actorId,
      notes: dto.notes,
      metadata: dto.metadata,
    });
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListLogEntriesDto,
  ): Promise<PaginatedResponse<TaskExecutionLogEntry>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { data, total } = await this.logService.findAll(user.tenantId ?? '', {
      ...query,
      page,
      limit,
    });
    return {
      items: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  @Get('task/:taskId')
  async findByTask(@CurrentUser() user: JwtPayload, @Param('taskId') taskId: string) {
    return this.logService.getByTaskId(taskId);
  }
}
