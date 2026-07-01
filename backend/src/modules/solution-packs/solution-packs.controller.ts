/**
 * SolutionPacksController — REST surface for Solution Packs.
 *
 * Phase 7, Tasks 7.1 + 7.9 (per `EAOS-api-contract.md` §8.19 +
 * `EAOS-implementation-roadmap.md` §11).
 *
 * Endpoints (all under /api/v1/solution-packs):
 *   GET    /                  — list catalog (filters: category, status,
 *                              tierRequired, q, installedOnly)
 *   GET    /:slug             — pack details
 *   GET    /:slug/preview     — install preview (Task 7.9)
 *   POST   /:slug/install     — install (OWNER | ADMIN per RBAC §4.11)
 *   DELETE /:slug             — uninstall
 *   GET    /installed         — list packs installed by the tenant
 *   GET    /installed/history — install/uninstall audit log
 *   POST   /                  — create (PLATFORM admin — used by seed)
 *   PATCH  /:id               — update
 *   POST   /:id/publish       — set status=stable + publishedAt
 *
 * All endpoints require JWT auth + tenant context (enforced by global
 * guards). RBAC: OWNER | ADMIN for install/uninstall per RBAC §4.11.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SolutionPacksService } from './services/solution-packs.service';
import {
  CreateSolutionPackDto,
  InstallSolutionPackDto,
  ListSolutionPacksDto,
  UpdateSolutionPackDto,
} from './dto/solution-pack.dto';
import type { JwtPayload } from '../auth/interfaces/token.interface';

@ApiTags('solution-packs')
@ApiBearerAuth()
@Controller({ path: 'solution-packs', version: '1' })
@UseGuards(RolesGuard)
export class SolutionPacksController {
  constructor(private readonly packs: SolutionPacksService) {}

  /**
   * GET /api/v1/solution-packs
   */
  @Get()
  @Roles(
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
    'USER',
    'AUDITOR',
    'SUPPORT',
  )
  @ApiOperation({ summary: 'Browse the Solution Pack catalog' })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListSolutionPacksDto,
  ) {
    return this.packs.listCatalog(user.tenantId!, {
      category: query.category,
      status: query.status,
      tierRequired: query.tierRequired,
      q: query.q,
      installedOnly: query.installedOnly,
    });
  }

  /**
   * GET /api/v1/solution-packs/installed
   */
  @Get('installed')
  @Roles(
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
    'USER',
    'AUDITOR',
    'SUPPORT',
  )
  @ApiOperation({ summary: 'List packs installed by the calling tenant' })
  async listInstalled(@CurrentUser() user: JwtPayload) {
    return this.packs.listInstalled(user.tenantId!);
  }

  /**
   * GET /api/v1/solution-packs/installed/history
   */
  @Get('installed/history')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN', 'OWNER', 'ADMIN', 'AUDITOR')
  @ApiOperation({
    summary: 'Install/uninstall audit log for the calling tenant',
  })
  async installHistory(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Math.min(200, Math.max(1, parseInt(limit, 10))) : 50;
    return this.packs.getInstallHistory(user.tenantId!, Number.isFinite(parsed) ? parsed : 50);
  }

  /**
   * GET /api/v1/solution-packs/:slug
   */
  @Get(':slug')
  @Roles(
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
    'USER',
    'AUDITOR',
    'SUPPORT',
  )
  @ApiOperation({ summary: 'Get a single Solution Pack by slug' })
  async getOne(@Param('slug') slug: string) {
    return this.packs.getBySlug(slug);
  }

  /**
   * GET /api/v1/solution-packs/:slug/preview
   *
   * Task 7.9 — pre-flight preview for the install dialog. Returns the
   * pack + already-installed flag + canInstall + blockers + impact.
   */
  @Get(':slug/preview')
  @Roles(
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
    'USER',
    'AUDITOR',
    'SUPPORT',
  )
  @ApiOperation({ summary: 'Pre-flight preview for installing a pack' })
  async preview(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
  ) {
    return this.packs.previewInstall(slug, user.tenantId!);
  }

  /**
   * POST /api/v1/solution-packs/:slug/install
   */
  @Post(':slug/install')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN', 'OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Install a Solution Pack for the calling tenant' })
  async install(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Body() body: InstallSolutionPackDto,
  ) {
    return this.packs.install({
      packSlug: slug,
      acceptWarnings: body.acceptWarnings,
      idempotencyKey: body.idempotencyKey,
      performedById: user.sub,
      tenantId: user.tenantId!,
    });
  }

  /**
   * DELETE /api/v1/solution-packs/:slug
   */
  @Delete(':slug')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN', 'OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Uninstall a Solution Pack for the calling tenant' })
  async uninstall(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
  ) {
    return this.packs.uninstall({
      packSlug: slug,
      performedById: user.sub,
      tenantId: user.tenantId!,
    });
  }

  // ─── Admin / seed endpoints ───────────────────────────────────────

  /**
   * POST /api/v1/solution-packs
   */
  @Post()
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Create a Solution Pack (platform admin)' })
  async create(@Body() body: CreateSolutionPackDto) {
    if (!body.slug || !body.name || !body.description || !body.category) {
      throw new BadRequestException(
        'slug, name, description, and category are required',
      );
    }
    return this.packs.create({
      slug: body.slug,
      name: body.name,
      description: body.description,
      shortDescription: body.shortDescription,
      category: body.category,
      icon: body.icon,
      color: body.color,
      tierRequired: body.tierRequired,
      status: body.status,
      ownerKind: body.ownerKind,
      ownerId: body.ownerId,
      extensions: (body.extensions ?? undefined) as
        Record<string, unknown> | undefined,
      requiresPacks: body.requiresPacks,
      conflictsWith: body.conflictsWith,
      tags: body.tags,
      monthlyPriceUsd: body.monthlyPriceUsd,
      estimatedAiCredits: body.estimatedAiCredits,
      sortOrder: body.sortOrder,
    });
  }

  /**
   * PATCH /api/v1/solution-packs/:id
   */
  @Patch(':id')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Update a Solution Pack' })
  async update(@Param('id') id: string, @Body() body: UpdateSolutionPackDto) {
    return this.packs.update(id, {
      name: body.name,
      description: body.description,
      shortDescription: body.shortDescription,
      icon: body.icon,
      color: body.color,
      tierRequired: body.tierRequired,
      status: body.status,
      extensions: (body.extensions ?? undefined) as
        Record<string, unknown> | undefined,
      requiresPacks: body.requiresPacks,
      conflictsWith: body.conflictsWith,
      tags: body.tags,
      monthlyPriceUsd: body.monthlyPriceUsd,
      estimatedAiCredits: body.estimatedAiCredits,
      sortOrder: body.sortOrder,
    });
  }

  /**
   * POST /api/v1/solution-packs/:id/publish
   */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Publish a Solution Pack (status → stable)' })
  async publish(@Param('id') id: string) {
    return this.packs.update(id, { status: 'stable' });
  }
}
