/**
 * AiActionKillSwitchGuard — emergency global kill-switch for AI Actions.
 *
 * Phase 5 pre-req (`EAOS-implementation-roadmap.md` §9 Phase 5, "Emergency
 * kill-switch flag `DISABLE_AI_ACTIONS`"). Per the roadmap:
 *
 *   "must be deployable in < 5 min"
 *
 * Implementation:
 *   - Reads the `DISABLE_AI_ACTIONS` env var on every request.
 *   - Reads from `FeatureFlagService` (which caches + can be refreshed).
 *   - Returns 503 SERVICE_UNAVAILABLE with `code: AI_ACTIONS_DISABLED`
 *     when the flag is set.
 *
 * Per-tenant `USE_AI_ACTIONS` is handled separately by tenant scoping
 * (not in this guard) — the global kill-switch is binary: ALL on or ALL off.
 *
 * SOLID: SRP — this guard does ONLY kill-switch checks. Per-tier /
 * per-tenant / per-role checks live elsewhere.
 */

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FeatureFlagService } from '../../../common/feature-flag/feature-flag.service';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

type AuthedRequest = Request & { user?: Partial<JwtPayload> | undefined };

@Injectable()
export class AiActionKillSwitchGuard implements CanActivate {
  private readonly logger = new Logger(AiActionKillSwitchGuard.name);

  constructor(private readonly flags: FeatureFlagService) {}

  canActivate(context: ExecutionContext): boolean {
    // Refresh flags on every request so a hot reload (env reload, file
    // touch) takes effect within ~1 RTT — well inside the 5-min SLO.
    this.flags.refresh();

    if (!this.flags.isDisabled('DISABLE_AI_ACTIONS')) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const tenantId = req.user?.tenantId ?? 'unknown';

    this.logger.warn(
      `[KILL_SWITCH] AI Action invocation blocked — tenant=${tenantId} path=${req.method} ${req.path}`,
    );

    res.setHeader('X-Kill-Switch', 'AI_ACTIONS_DISABLED');
    throw new HttpException(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'AI_ACTIONS_DISABLED',
        message:
          'AI Actions are temporarily disabled (DISABLE_AI_ACTIONS is set). ' +
          'Contact your platform admin for the ETA on re-enabling.',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
