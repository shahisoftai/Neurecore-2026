/**
 * PoolAgentsController — admin CRUD for PoolAgent platform rows.
 *
 * Paths (under /api/v1/admin/pool):
 *   GET    /agents                       paginated list (?division=&divisionSlug=&q=&page=&limit=)
 *   GET    /agents/:id                   one
 *   POST   /agents                       create
 *   PATCH  /agents/:id                   partial update
 *   DELETE /agents/:id                   remove (409 if referenced by package entries)
 *
 * Auth: writes restricted to SUPER_ADMIN + PLATFORM_ADMIN. Reads available
 * to admin-tier roles that operate the FA `/pool` page.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PoolCatalogService } from '../services/pool-catalog.service';
import {
  CreatePoolAgentDto,
  ListPoolAgentsQueryDto,
  UpdatePoolAgentDto,
} from '../dto/admin-pool.dto';
import type {
  Paginated,
  PoolAgentDto,
} from '../interfaces/admin-pool.interface';

@ApiCommon('admin-pool-agents')
@Controller({ path: 'admin/pool/agents', version: '1' })
export class PoolAgentsController {
  constructor(private readonly catalog: PoolCatalogService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  list(@Query() q: ListPoolAgentsQueryDto): Promise<Paginated<PoolAgentDto>> {
    return this.catalog.listAgents({
      division: q.division,
      divisionSlug: q.divisionSlug,
      q: q.q,
      page: q.page,
      limit: q.limit,
    });
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  getOne(@Param('id', ParseUUIDPipe) id: string): Promise<PoolAgentDto> {
    return this.catalog.getAgent(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  create(@Body() dto: CreatePoolAgentDto): Promise<PoolAgentDto> {
    return this.catalog.createAgent({
      name: dto.name,
      division: dto.division,
      divisionSlug: dto.divisionSlug,
      description: dto.description,
      category: dto.category,
      emoji: dto.emoji,
      color: dto.color,
      systemPrompt: dto.systemPrompt,
      version: dto.version,
    });
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePoolAgentDto,
  ): Promise<PoolAgentDto> {
    return this.catalog.updateAgent(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.catalog.removeAgent(id);
  }
}
