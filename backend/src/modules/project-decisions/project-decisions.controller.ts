/**
 * project-decisions module — REST API Controller
 *
 * Phase 5: Decision Registry
 * SOLID: Thin controller — delegates to ProjectDecisionService.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectDecisionService } from './project-decisions.service';
import {
  CreateDecisionDto,
  UpdateDecisionDto,
  CastVoteDto,
  ApproveDecisionDto,
  ListDecisionsDto,
} from './dto/project-decision.dto';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import type { ProjectDecision } from './interfaces/project-decision.interface';

@ApiCommon('project-decisions')
@Controller({ path: 'project-decisions', version: '1' })
@UseGuards(JwtAuthGuard)
export class ProjectDecisionsController {
  constructor(private readonly decisionService: ProjectDecisionService) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDecisionDto) {
    return this.decisionService.create(user.tenantId ?? '', dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListDecisionsDto,
  ): Promise<PaginatedResponse<ProjectDecision>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { data, total } = await this.decisionService.findAll(user.tenantId ?? '', {
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

  @Get(':id')
  async findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.decisionService.findById(id, user.tenantId ?? '');
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDecisionDto,
  ) {
    return this.decisionService.update(id, user.tenantId ?? '', dto);
  }

  @Post(':id/vote')
  @HttpCode(HttpStatus.OK)
  async castVote(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CastVoteDto,
  ) {
    return this.decisionService.castVote(id, user.tenantId ?? '', dto.vote);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ApproveDecisionDto,
  ) {
    return this.decisionService.approve(
      id,
      user.tenantId ?? '',
      dto.approvedById,
      dto.approvedByType ?? 'HUMAN',
    );
  }
}
