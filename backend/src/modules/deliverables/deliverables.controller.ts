/**
 * Deliverables Module — REST API Controller
 *
 * Phase 3: Goals + Tasks → Deliverables
 *
 * SOLID:
 * - Single Responsibility: only HTTP request handling
 * - Thin controller: delegates to DeliverablesService
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeliverablesService } from './deliverables.service';
import {
  CreateDeliverableDto,
  UpdateDeliverableDto,
  CreateDeliverableVersionDto,
  ListDeliverablesDto,
} from './dto/deliverable.dto';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import type { Deliverable, DeliverableVersion } from './interfaces/deliverable.interface';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

@Controller({ path: 'deliverables', version: '1' })
@ApiCommon('deliverables')
@UseGuards(JwtAuthGuard)
export class DeliverablesController {
  constructor(private readonly deliverablesService: DeliverablesService) {}

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDeliverableDto,
  ) {
    return this.deliverablesService.create(user.tenantId ?? '', {
      projectId: dto.projectId,
      taskId: dto.taskId,
      goalId: dto.goalId,
      name: dto.name,
      description: dto.description,
      status: dto.status,
      riskTier: dto.riskTier,
    });
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListDeliverablesDto,
  ): Promise<PaginatedResponse<Deliverable>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.deliverablesService.findAll(
      user.tenantId ?? '',
      { ...query, page, limit },
    );
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

  @Get(':id')
  async findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.deliverablesService.findById(id, user.tenantId ?? '');
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDeliverableDto,
  ) {
    return this.deliverablesService.update(id, user.tenantId ?? '', dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.deliverablesService.delete(id, user.tenantId ?? '');
  }

  // ─── Version endpoints ─────────────────────────────────────────────────────

  @Get(':id/versions')
  async findVersions(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.deliverablesService.findVersions(id, user.tenantId ?? '');
  }

  @Get(':id/versions/latest')
  async getLatestVersion(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.deliverablesService.getLatestVersion(id, user.tenantId ?? '');
  }

  @Post(':id/versions')
  async createVersion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateDeliverableVersionDto,
  ) {
    return this.deliverablesService.createVersion(id, user.tenantId ?? '', {
      content: dto.content,
      summary: dto.summary,
      producedBy: dto.producedBy,
      producedByTaskId: dto.producedByTaskId,
    });
  }
}
