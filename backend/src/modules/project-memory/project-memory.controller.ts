/**
 * project-memory module — REST API Controller
 *
 * Phase 5: Project Memory
 * GET + POST + PATCH only — no DELETE (append-only, use supersede instead).
 * SOLID: Thin controller — delegates to ProjectMemoryService.
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
import { ProjectMemoryService } from './project-memory.service';
import {
  CreateMemoryDto,
  UpdateMemoryDto,
  ListMemoriesDto,
  SearchMemoriesDto,
} from './dto/project-memory.dto';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import type { ProjectMemory } from './interfaces/project-memory.interface';

@ApiCommon('project-memory')
@Controller({ path: 'project-memory', version: '1' })
@UseGuards(JwtAuthGuard)
export class ProjectMemoryController {
  constructor(private readonly memoryService: ProjectMemoryService) {}

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMemoryDto) {
    return this.memoryService.create(user.tenantId ?? '', {
      projectId: dto.projectId,
      authorId: dto.authorId,
      authorType: dto.authorType,
      category: dto.category,
      content: dto.content,
      sourceEntityType: dto.sourceEntityType,
      sourceEntityId: dto.sourceEntityId,
      isPinned: dto.isPinned,
      isAiGenerated: dto.isAiGenerated,
    });
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListMemoriesDto,
  ): Promise<PaginatedResponse<ProjectMemory>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { data, total } = await this.memoryService.findAll(user.tenantId ?? '', {
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

  @Get('search')
  async search(@CurrentUser() user: JwtPayload, @Query() query: SearchMemoriesDto) {
    return this.memoryService.search(query.projectId, query.query, user.tenantId ?? '');
  }

  @Get(':id')
  async findById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.memoryService.findById(id, user.tenantId ?? '');
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateMemoryDto,
  ) {
    return this.memoryService.update(id, user.tenantId ?? '', dto);
  }
}
