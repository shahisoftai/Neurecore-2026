import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TIER_LIMIT_KEY, type TierLimitKey } from '../decorators/tier-limit.decorator';

/**
 * WS-7.2: TierLimitsGuard
 *
 * Reads the @TierLimit('maxUsers') decorator from the route handler and enforces
 * the cap against the tenant's tier. Throws ForbiddenException with a structured
 * error code the frontend can switch on for upgrade prompts.
 *
 * Usage:
 *   @TierLimit('maxUsers')
 *   @Post()
 *   createUser(...) { ... }
 */
@Injectable()
export class TierLimitsGuard implements CanActivate {
  private readonly logger = new Logger(TierLimitsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const limit = this.reflector.getAllAndOverride<TierLimitKey>(TIER_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!limit) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { tenantId?: string | null } | undefined;
    if (!user?.tenantId) return true; // super-admin path; skip limit

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: { tier: true },
    });
    if (!tenant) return true;

    const max = (tenant.tier as unknown as Record<string, number>)[limit];
    if (typeof max !== 'number') return true;

    const current = await this.computeCurrentCount(tenant.id, limit);
    if (current >= max) {
      throw new ForbiddenException({
        code: 'TIER_LIMIT_EXCEEDED',
        limit,
        current,
        max,
        tier: tenant.tier.slug,
        upgradeUrl: '/settings/billing',
      });
    }
    return true;
  }

  private async computeCurrentCount(
    tenantId: string,
    limit: TierLimitKey,
  ): Promise<number> {
    switch (limit) {
      case 'maxUsers':
        return this.prisma.user.count({ where: { tenantId, isActive: true } });
      case 'maxAgents':
        return this.prisma.agent.count({ where: { tenantId, isSelected: true } });
      case 'maxDepartments':
        return this.prisma.department.count({ where: { tenantId } });
      case 'maxApiCalls': {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const usage = await this.prisma.quotaUsage.findFirst({
          where: {
            tenantId,
            quotaKey: 'api_calls',
            period: 'daily',
            resetAt: { gte: today },
          },
        });
        return usage?.used ?? 0;
      }
      case 'maxConversationMessages':
        return this.prisma.memoryEntry.count({ where: { tenantId } });
      case 'maxStorageGB':
      case 'maxFileSizeMB':
        // Per-request check; guard treats as zero (no aggregate enforcement)
        return 0;
      default:
        return 0;
    }
  }
}