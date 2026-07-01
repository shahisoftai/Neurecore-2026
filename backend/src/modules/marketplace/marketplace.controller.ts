/**
 * MarketplaceController — unified browse API for the 8 marketplace tabs.
 *
 * Phase 7, Task 7.3 (per EAOS-api-contract.md §8.19).
 *
 * Endpoints:
 *   GET /api/v1/marketplace/tabs              — tab list + counts + recent
 *   GET /api/v1/marketplace/items?tab=...      — browse one tab
 *   GET /api/v1/marketplace/packs              — pass-through to solution-packs (compat)
 *   GET /api/v1/marketplace/packs/:slug        — pass-through (compat)
 *   POST /api/v1/marketplace/packs/:slug/install — pass-through (compat)
 *   DELETE /api/v1/marketplace/packs/:slug     — pass-through (compat)
 *   GET /api/v1/marketplace/agent-templates    — pass-through (compat)
 *   GET /api/v1/marketplace/connectors         — pass-through (compat)
 *   GET /api/v1/marketplace/workflows          — pass-through
 *   GET /api/v1/marketplace/knowledge-packs    — pass-through
 *   GET /api/v1/marketplace/docs-json          — public OpenAPI subset
 *     (Phase 8 — third-party Solution Pack developers; Phase 7 ships the
 *     stub that returns the public catalog spec)
 */

import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UseGuards } from '@nestjs/common';
import {
  MarketplaceService,
  type MarketplaceTab,
} from './services/marketplace.service';
import { BrowseMarketplaceDto } from './dto/marketplace.dto';
import { SolutionPacksService } from '../solution-packs/services/solution-packs.service';
import type { JwtPayload } from '../auth/interfaces/token.interface';

@ApiTags('marketplace')
@ApiBearerAuth()
@Controller({ path: 'marketplace', version: '1' })
@UseGuards(RolesGuard)
export class MarketplaceController {
  constructor(
    private readonly marketplace: MarketplaceService,
    private readonly solutionPacks: SolutionPacksService,
  ) { }

  /**
   * GET /api/v1/marketplace — landing redirect (returns same as /tabs).
   * Prevents 404 when the frontend hits the base marketplace URL.
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
  @ApiOperation({ summary: 'Marketplace landing — alias for /tabs' })
  async root(@CurrentUser() user: JwtPayload) {
    return this.marketplace.getSummary(user.tenantId!);
  }

  /**
   * GET /api/v1/marketplace/tabs
   */
  @Get('tabs')
  @Roles(
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
    'USER',
    'AUDITOR',
    'SUPPORT',
  )
  @ApiOperation({
    summary: 'Marketplace landing — tab counts + recently installed',
  })
  async tabs(@CurrentUser() user: JwtPayload) {
    return this.marketplace.getSummary(user.tenantId!);
  }

  /**
   * GET /api/v1/marketplace/items
   */
  @Get('items')
  @Roles(
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
    'USER',
    'AUDITOR',
    'SUPPORT',
  )
  @ApiOperation({ summary: 'Browse a marketplace tab' })
  async items(
    @CurrentUser() user: JwtPayload,
    @Query() query: BrowseMarketplaceDto,
  ) {
    const tab = (query.tab ?? 'packs') as MarketplaceTab;
    return this.marketplace.browseTab(user.tenantId!, {
      tab,
      q: query.q,
      installedOnly: query.installedOnly,
    });
  }

  // ─── Compatibility routes (api-contract §8.19) ────────────────────

  @Get('packs')
  @Roles(
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
    'USER',
    'AUDITOR',
    'SUPPORT',
  )
  @ApiOperation({ summary: 'List Solution Packs (alias of /solution-packs)' })
  async listPacks(@CurrentUser() user: JwtPayload) {
    return this.solutionPacks.listCatalog(user.tenantId!, {});
  }

  @Get('packs/:slug')
  @Roles(
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
    'USER',
    'AUDITOR',
    'SUPPORT',
  )
  @ApiOperation({ summary: 'Get a Solution Pack by slug (alias)' })
  async getPack(@Param('slug') slug: string) {
    return this.solutionPacks.getBySlug(slug);
  }

  @Get('agent-templates')
  @Roles(
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
    'USER',
    'AUDITOR',
    'SUPPORT',
  )
  @ApiOperation({ summary: 'Browse agent templates (marketplace tab)' })
  async agentTemplates(@CurrentUser() user: JwtPayload) {
    return this.marketplace.browseTab(user.tenantId!, { tab: 'agent-templates' });
  }

  @Get('connectors')
  @Roles(
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
    'USER',
    'AUDITOR',
    'SUPPORT',
  )
  @ApiOperation({ summary: 'Browse connectors (marketplace tab)' })
  async connectors(@CurrentUser() user: JwtPayload) {
    return this.marketplace.browseTab(user.tenantId!, { tab: 'connectors' });
  }

  @Get('workflows')
  @Roles(
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
    'USER',
    'AUDITOR',
    'SUPPORT',
  )
  @ApiOperation({ summary: 'Browse workflow templates (marketplace tab)' })
  async workflows(@CurrentUser() user: JwtPayload) {
    return this.marketplace.browseTab(user.tenantId!, { tab: 'workflows' });
  }

  @Get('knowledge-packs')
  @Roles(
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'OWNER',
    'ADMIN',
    'USER',
    'AUDITOR',
    'SUPPORT',
  )
  @ApiOperation({ summary: 'Browse knowledge packs (marketplace tab)' })
  async knowledgePacks(@CurrentUser() user: JwtPayload) {
    return this.marketplace.browseTab(user.tenantId!, { tab: 'knowledge-packs' });
  }

  /**
   * GET /api/v1/marketplace/docs-json
   *
   * Per api-contract §11: public API subset for third-party Solution Pack
   * developers. Phase 7 ships a stub that returns the public catalog spec
   * (catalog list + pack detail + install preview). Phase 8 will expand
   * this with create/update/publish endpoints gated by API keys.
   */
  @Get('docs-json')
  @ApiOperation({
    summary: 'Public OpenAPI subset for third-party pack developers',
  })
  publicDocs() {
    return {
      openapi: '3.1.0',
      info: {
        title: 'NeureCore Solution Pack Developer API',
        version: '1.0.0',
        description:
          'Public subset of the NeureCore API for third-party Solution Pack publishers. ' +
          'Phase 7 ships the read endpoints; Phase 8 adds the write endpoints (create / ' +
          'update / publish) gated by API keys.',
      },
      servers: [{ url: '/api/v1' }],
      paths: {
        '/marketplace/packs': {
          get: {
            summary: 'List published Solution Packs',
            tags: ['marketplace'],
            security: [],
          },
        },
        '/marketplace/packs/{slug}': {
          get: {
            summary: 'Get a published Solution Pack by slug',
            tags: ['marketplace'],
            security: [],
            parameters: [
              {
                name: 'slug',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
          },
        },
        '/marketplace/packs/{slug}/preview': {
          get: {
            summary: 'Pre-flight preview for installing a pack',
            tags: ['marketplace'],
            security: [{ bearerAuth: [] }],
            parameters: [
              {
                name: 'slug',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
          },
        },
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    };
  }
}
