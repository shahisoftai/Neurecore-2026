/**
 * Platform Operations API (Phase 8).
 * Executive Operations Dashboard: health, audit, security, diagnostics,
 * readiness, deployment, backup. Tenant-scoped where applicable. Read-only.
 */

import { Controller, Get, Query, Req, UseGuards, ForbiddenException, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PLATFORM_OPS } from './contracts/platform-operations.interface';
import type { IPlatformOperations } from './contracts/platform-operations.interface';

interface ReqWithUser { user?: { tenantId?: string; sub?: string } }

@Controller({ path: 'platform-ops', version: '1' })
@UseGuards(JwtAuthGuard)
export class PlatformOpsController {
  constructor(@Inject(PLATFORM_OPS) private readonly ops: IPlatformOperations) {}
  private tenant(req: ReqWithUser) { const t = req.user?.tenantId; if (!t) throw new ForbiddenException(); return t; }

  @Get('health') health() { return this.ops.health(); }
  @Get('audit') audit(@Req() req: ReqWithUser) { return this.ops.audit(this.tenant(req)); }
  @Get('security') security() { return this.ops.security(); }
  @Get('diagnostics') diagnostics() { return this.ops.diagnostics(); }
  @Get('readiness') readiness() { return this.ops.readiness(); }
  @Get('deployment') deployment() { return this.ops.deployment(); }
  @Get('backup') backup() { return this.ops.backup(); }
}
