/**
 * EntitiesController — the universal entity workspace endpoint.
 *
 * Phase 3, Task 3.1 + 3.6 + 3.7 + 3.9 (per `EAOS-implementation-plan.md` §9.4
 * + `EAOS-api-contract.md` §8). Exposes the 10 capability panel endpoints
 * + workspace/summary composite endpoint for first paint.
 *
 * Routes:
 *   GET    /entities/:type/:id/workspace/summary
 *   GET    /entities/:type/:id/identity
 *   GET    /entities/:type/:id/context
 *   GET    /entities/:type/:id/intelligence
 *   GET    /entities/:type/:id/operations
 *   GET    /entities/:type/:id/resources
 *   GET    /entities/:type/:id/collaboration
 *   GET    /entities/:type/:id/insights
 *   GET    /entities/:type/:id/automation
 *   GET    /entities/:type/:id/activity
 *   GET    /entities/:type/:id/lifecycle
 *   POST   /entities/:type/:id/lifecycle/transition
 *   GET    /entities/:type/:id/lifecycle/history
 *   GET    /entities/:type/:id/lifecycle/why-not-active
 *   GET    /entities/:type/:id/graph (Mini-Graph, NUWS §5.6)
 *   POST   /entities/:type/:id/labels
 *   DELETE /entities/:type/:id/labels/:labelId
 *   POST   /entities/:type/:id/favorite
 *   POST   /entities/:type/:id/watch
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  EntityOwnerGuard,
  ResourceWithTenant,
} from '../../common/guards/entity-owner.guard';
import { EntityLifecycleGuard } from '../../common/guards/entity-lifecycle.guard';

import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { PaginatedResponse } from '../../common/responses/paginated.response';

import type {
  EntityLabelDto,
  LifecycleTransitionDto,
  EaosEntityType,
} from './dto/entity.dto';
import { EntityResolverService } from './services/entity-resolver.service';
import { IdentityCapability } from './services/identity.capability';
import { ContextCapability } from './services/context.capability';
import { IntelligenceCapability } from './services/intelligence.capability';
import { OperationsCapability } from './services/operations.capability';
import { ResourcesCapability } from './services/resources.capability';
import { CollaborationCapability } from './services/collaboration.capability';
import { InsightsCapability } from './services/insights.capability';
import { AutomationCapability } from './services/automation.capability';
import { ActivityCapability } from './services/activity.capability';
import { LifecycleCapability } from './services/lifecycle.capability';
import { EntityGraphService } from './services/entity-graph.service';
import { EventsGateway } from '../events/events.gateway';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Controller({ path: 'entities', version: '1' })
@ApiCommon('entities')
@ApiTags('entities')
@ApiBearerAuth('JWT')
export class EntitiesController {
  constructor(
    private readonly resolver: EntityResolverService,
    private readonly identity: IdentityCapability,
    private readonly context: ContextCapability,
    private readonly intelligence: IntelligenceCapability,
    private readonly operations: OperationsCapability,
    private readonly resources: ResourcesCapability,
    private readonly collaboration: CollaborationCapability,
    private readonly insights: InsightsCapability,
    private readonly automation: AutomationCapability,
    private readonly activity: ActivityCapability,
    private readonly lifecycle: LifecycleCapability,
    private readonly graph: EntityGraphService,
    private readonly events: EventsGateway,
    private readonly prisma: PrismaService,
  ) { }

  // ─── Workspace summary (composite — first paint) ────────────────────────

  @Get(':type/:id/workspace/summary')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({
    summary: 'Composite workspace summary (Identity + Intelligence + Lifecycle + Health)',
  })
  @ApiResponse({ status: 200, description: 'Workspace summary' })
  async workspaceSummary(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    const tenantId = user.tenantId;
    const type = entityType.toUpperCase() as EaosEntityType;
    const [identity, intelligence, lifecycle] = await Promise.all([
      this.identity.get(type, id, tenantId, user.sub),
      this.intelligence.get(type, id, tenantId),
      this.lifecycle.get(type, id, tenantId),
    ]);
    return { identity, intelligence, lifecycle };
  }

  // ─── Identity ──────────────────────────────────────────────────────────

  @Get(':type/:id/identity')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({ summary: 'Identity panel data' })
  async getIdentity(
    @Param('type') type: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, (type as EaosEntityType), id, user.tenantId!);
    return this.identity.get(
      type.toUpperCase() as EaosEntityType,
      id,
      user.tenantId!,
      user.sub,
    );
  }

  // ─── Context ───────────────────────────────────────────────────────────

  @Get(':type/:id/context')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({ summary: 'Context panel data' })
  async getContext(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    return this.context.get(
      entityType.toUpperCase() as EaosEntityType,
      id,
      user.tenantId,
    );
  }

  // ─── Intelligence ──────────────────────────────────────────────────────

  @Get(':type/:id/intelligence')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({ summary: 'Intelligence panel data (AI summary, risks, recommendations)' })
  async getIntelligence(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    return this.intelligence.get(
      entityType.toUpperCase() as EaosEntityType,
      id,
      user.tenantId,
    );
  }

  // ─── Operations ────────────────────────────────────────────────────────

  @Get(':type/:id/operations')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({ summary: 'Operations panel data' })
  async getOperations(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    return this.operations.get(
      entityType.toUpperCase() as EaosEntityType,
      id,
      user.tenantId,
    );
  }

  // ─── Resources ─────────────────────────────────────────────────────────

  @Get(':type/:id/resources')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({ summary: 'Resources panel data' })
  async getResources(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    return this.resources.get(
      entityType.toUpperCase() as EaosEntityType,
      id,
      user.tenantId,
    );
  }

  // ─── Collaboration ─────────────────────────────────────────────────────

  @Get(':type/:id/collaboration')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({ summary: 'Collaboration panel data (write surface)' })
  async getCollaboration(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    return this.collaboration.get(
      entityType.toUpperCase() as EaosEntityType,
      id,
      user.tenantId,
    );
  }

  // ─── Insights ──────────────────────────────────────────────────────────

  @Get(':type/:id/insights')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({ summary: 'Insights panel data (KPIs)' })
  async getInsights(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    return this.insights.get(
      entityType.toUpperCase() as EaosEntityType,
      id,
      user.tenantId,
    );
  }

  // ─── Automation ────────────────────────────────────────────────────────

  @Get(':type/:id/automation')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({ summary: 'Automation panel data (contextual capability)' })
  async getAutomation(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    return this.automation.get(
      entityType.toUpperCase() as EaosEntityType,
      id,
      user.tenantId,
    );
  }

  // ─── Activity ──────────────────────────────────────────────────────────

  @Get(':type/:id/activity')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({ summary: 'Activity panel data (audit-grade timeline)' })
  async getActivity(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') activityType?: string,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    const result = await this.activity.get(
      entityType.toUpperCase() as EaosEntityType,
      id,
      user.tenantId,
      {
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        type: activityType,
      },
    );
    const items = result.entries;
    return {
      items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    } satisfies PaginatedResponse<typeof items[number]>;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  @Get(':type/:id/lifecycle')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({ summary: 'Lifecycle panel data' })
  async getLifecycle(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    return this.lifecycle.get(
      entityType.toUpperCase() as EaosEntityType,
      id,
      user.tenantId,
    );
  }

  @Post(':type/:id/lifecycle/transition')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard, EntityLifecycleGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute a state transition' })
  async transitionLifecycle(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Body() dto: LifecycleTransitionDto,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    const upperType = entityType.toUpperCase() as EaosEntityType;
    const result = await this.lifecycle.transition(
      upperType,
      id,
      user.tenantId,
      user.sub,
      dto.to,
      dto.reason,
    );
    // Broadcast a lifecycle event so the frontend can invalidate queries.
    this.events.emitToTenant(user.tenantId, 'lifecycle:transitioned', {
      entityType: upperType,
      entityId: id,
      fromState: dto.from ?? null,
      toState: dto.to,
      actor: user.sub,
      timestamp: new Date().toISOString(),
    });
    return result;
  }

  @Get(':type/:id/lifecycle/history')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({ summary: 'State transition history with durations' })
  async getLifecycleHistory(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    const panel = await this.lifecycle.get(
      entityType.toUpperCase() as EaosEntityType,
      id,
      user.tenantId,
    );
    return panel.stateHistory;
  }

  @Get(':type/:id/lifecycle/why-not-active')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({ summary: 'AI explanation when state != ACTIVE' })
  async getWhyNotActive(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    const panel = await this.lifecycle.get(
      entityType.toUpperCase() as EaosEntityType,
      id,
      user.tenantId,
    );
    return {
      explanation:
        panel.whyNotActive ?? `${entityType} ${id} is ACTIVE.`,
    };
  }

  // ─── Graph (Mini-Graph, NUWS §5.6) ─────────────────────────────────────

  @Get(':type/:id/graph')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @ApiOperation({ summary: '1-hop relationship graph (Mini-Graph)' })
  async getGraph(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    return this.graph.oneHop(
      entityType.toUpperCase() as EaosEntityType,
      id,
      user.tenantId,
    );
  }

  // ─── Labels ────────────────────────────────────────────────────────────

  @Post(':type/:id/labels')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a label to the entity' })
  async addLabel(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Body() dto: EntityLabelDto,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    return this.prisma.entityLabel.create({
      data: {
        tenantId: user.tenantId,
        entityType: entityType.toUpperCase() as EaosEntityType,
        entityId: id,
        kind: 'CUSTOM',
        key: dto.key,
        value: dto.value,
        color: dto.color,
        createdById: user.sub,
      },
    });
  }

  @Delete(':type/:id/labels/:labelId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a label' })
  async deleteLabel(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Param('labelId') labelId: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    await this.prisma.entityLabel.deleteMany({
      where: {
        id: labelId,
        tenantId: user.tenantId,
        entityType: entityType.toUpperCase() as EaosEntityType,
        entityId: id,
      },
    });
    return;
  }

  // ─── Favorites / Watch ─────────────────────────────────────────────────

  @Post(':type/:id/favorite')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pin the entity to the user\'s favorites' })
  async favorite(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    const tenantId = user.tenantId;
    const upperType = entityType.toUpperCase() as EaosEntityType;
    const existing = await this.prisma.userFavorite.findUnique({
      where: {
        userId_entityType_entityId: {
          userId: user.sub,
          entityType: upperType,
          entityId: id,
        },
      },
    });
    if (existing) {
      return { favorited: true };
    }
    await this.prisma.userFavorite.create({
      data: {
        tenantId,
        userId: user.sub,
        entityType: upperType,
        entityId: id,
      },
    });
    return { favorited: true };
  }

  @Post(':type/:id/watch')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Watch the entity for changes' })
  async watch(
    @Param('type') entityType: string,
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.loadResource(req, entityType, id, user.tenantId);
    const tenantId = user.tenantId;
    const upperType = entityType.toUpperCase() as EaosEntityType;
    await this.prisma.entityWatcher.upsert({
      where: {
        watcherId_entityType_entityId: {
          watcherId: user.sub,
          entityType: upperType,
          entityId: id,
        },
      },
      update: {},
      create: {
        tenantId,
        watcherId: user.sub,
        entityType: upperType,
        entityId: id,
      },
    });
    return { watching: true };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  /**
   * Load the underlying resource into req.resource so that EntityOwnerGuard
   * can verify tenant scope. Throws 404 via the resolver if not found.
   */
  private async loadResource(
    req: Request,
    type: string,
    id: string,
    tenantId: string,
  ): Promise<ResourceWithTenant> {
    if ((req as unknown as { resource?: unknown }).resource) {
      return (req as unknown as { resource: ResourceWithTenant }).resource;
    }
    const entity = await this.resolver.resolve(
      type.toUpperCase() as never,
      id,
      tenantId,
    );
    (req as unknown as { resource: ResourceWithTenant }).resource = entity;
    return entity;
  }
}
