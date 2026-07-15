/**
 * Context Plane diagnostics (Phase 3 §15).
 *
 * Authorized, tenant-scoped inspection: registered providers, a live context
 * assembly trace for the caller, and cache stats. JwtAuthGuard + tenant scope
 * from the JWT — never an unrestricted admin dump.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CONTEXT_PLANE,
  type IOrganizationalContextPlane,
} from './contracts/context-plane.interface';
import { ContextCache } from './cache/context-cache.service';

interface RequestWithUser {
  user?: { tenantId?: string; sub?: string; id?: string };
}

@Controller({ path: 'admin/context-plane', version: '1' })
@UseGuards(JwtAuthGuard)
export class ContextPlaneAdminController {
  constructor(
    @Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane,
    private readonly cache: ContextCache,
  ) {}

  @Get('providers')
  providers(@Req() req: RequestWithUser) {
    if (!req.user?.tenantId) throw new ForbiddenException('tenant required');
    return { providers: this.plane.listProviders() };
  }

  @Get('cache-stats')
  cacheStats(@Req() req: RequestWithUser) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new ForbiddenException('tenant required');
    // Return only the caller's tenant counters, never the aggregate.
    const all = this.cache.stats();
    const tenantStats = all.byTenant[tenantId] ?? {
      hits: 0, misses: 0, invalidations: 0, size: 0,
    };
    return {
      tenantId,
      size: tenantStats.size,
      hits: tenantStats.hits,
      misses: tenantStats.misses,
      invalidations: tenantStats.invalidations,
    };
  }

  /**
   * Live, tenant-scoped context trace for the CALLER. Returns authorization
   * decisions + provenance + cache status per capability. The requesting actor
   * is always the caller (no impersonation of other actors).
   */
  @Post('trace')
  async trace(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      projectId?: string;
      customerId?: string;
      includeCapabilities?: string[];
    },
  ) {
    const tenantId = req.user?.tenantId;
    const actorId = req.user?.sub ?? req.user?.id;
    if (!tenantId || !actorId) throw new ForbiddenException('tenant + actor required');

    const assembled = await this.plane.assemble({
      tenantId,
      actorId,
      actorType: 'HUMAN',
      scope: {
        projectId: body.projectId,
        customerId: body.customerId,
        includeCapabilities: body.includeCapabilities,
      },
    });

    // Return trace WITHOUT raw sensitive data — decisions + provenance only.
    return {
      actor: {
        id: assembled.identity.employeeId,
        role: assembled.identity.role,
        authorityLevel: assembled.identity.authorityLevel,
        resolvedFrom: assembled.identity.resolvedFrom,
      },
      authContext: assembled.authContext,
      capabilities: Object.fromEntries(
        Object.entries(assembled.capabilities).map(([cap, ctx]) => [
          cap,
          {
            provider: ctx.provider,
            access: ctx.authorization.access,
            reason: ctx.authorization.reason,
            policySource: ctx.authorization.policySource,
            cacheStatus: ctx.cacheStatus,
            fetchedAt: ctx.fetchedAt,
            lastModifiedAt: ctx.lastModifiedAt,
            expiresAt: ctx.expiresAt,
            unavailable: ctx.unavailable ?? false,
            sourceEntityCount: ctx.sourceEntities.length,
            dataKeys: Object.keys(ctx.data),
          },
        ]),
      ),
    };
  }
}
