/**
 * ActionAuthorizationGuard — Layer 3 (Action-Level) RBAC.
 *
 * Per `EAOS-rbac-model.md` §6.1 + §6.3 + `EAOS-api-contract.md` §7.4.
 * Wraps `POST /ai-actions/execute` and enforces, in order:
 *
 *   1. **Registry lookup** — `AI_ACTION_NOT_FOUND` if id is unknown.
 *   2. **Entity compatibility** — `AI_ACTION_NOT_SUPPORTED` if action
 *      does not support the target entity type.
 *   3. **Permissions** — `AI_ACTION_PERMISSION_DENIED` if the user
 *      lacks a required permission bit.
 *   4. **Tier** — `TIER_TOO_LOW` if the tenant's tier is below the
 *      action's `tierRequired`.
 *   5. **Per-tenant AI credit cap** — `AI_CREDITS_EXHAUSTED` if the
 *      projected monthly usage would exceed `Tenant.aiCredits`.
 *   6. **Per-user rate limit (Redis-backed)** — `AI_RATE_LIMIT_EXCEEDED`
 *      if the user has exceeded their role-based per-minute invocation cap.
 *
 * On success, the resolved `AIActionDefinition` is attached to the request
 * (`req.aiAction`) so the executor doesn't repeat the lookup.
 *
 * SOLID: SRP — this guard only authorizes. Recording metrics, persisting
 * the invocation, and executing the action are separate concerns.
 */

import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AIActionRegistry, tierMeetsRequirement } from '../ai-action.registry';
import type {
  AIActionTierRequired,
  AIActionPermission,
} from '../action-definition';
import type { ExecuteAIActionDto } from '../dto/ai-action.dto';
import { RedisService } from '../../../infrastructure/cache/redis.service';

interface AuthedRequest extends Request {
  user?: {
    sub?: string;
    tenantId?: string;
    role?: UserRole;
  };
  aiAction?: ReturnType<AIActionRegistry['getById']>;
}

const ROLE_PERMISSIONS: Record<string, AIActionPermission[]> = {
  [UserRole.SUPER_ADMIN]: [
    'ai.invoke',
    'ai.invoke.analysis',
    'ai.invoke.optimization',
    'ai.invoke.execution',
    'ai.invoke.reporting',
    'ai.invoke.delegate',
    'ai.invoke.workflow',
  ],
  [UserRole.PLATFORM_ADMIN]: [
    'ai.invoke',
    'ai.invoke.analysis',
    'ai.invoke.optimization',
    'ai.invoke.execution',
    'ai.invoke.reporting',
    'ai.invoke.delegate',
    'ai.invoke.workflow',
  ],
  [UserRole.OWNER]: [
    'ai.invoke',
    'ai.invoke.analysis',
    'ai.invoke.optimization',
    'ai.invoke.execution',
    'ai.invoke.reporting',
    'ai.invoke.delegate',
    'ai.invoke.workflow',
  ],
  [UserRole.ADMIN]: [
    'ai.invoke',
    'ai.invoke.analysis',
    'ai.invoke.optimization',
    'ai.invoke.reporting',
  ],
  [UserRole.USER]: ['ai.invoke', 'ai.invoke.analysis'],
  [UserRole.AUDITOR]: [],
  [UserRole.SUPPORT]: ['ai.invoke', 'ai.invoke.analysis'],
  [UserRole.SECURITY_OFFICER]: ['ai.invoke', 'ai.invoke.analysis'],
};

const ROLE_RATE_LIMIT_PER_MIN: Record<string, number> = {
  [UserRole.USER]: 60,
  [UserRole.ADMIN]: 120,
  [UserRole.OWNER]: 240,
  [UserRole.SUPER_ADMIN]: 600,
  [UserRole.PLATFORM_ADMIN]: 600,
  [UserRole.SECURITY_OFFICER]: 60,
  [UserRole.SUPPORT]: 60,
  [UserRole.AUDITOR]: 60,
};

const TIER_DEFAULT_AI_CREDITS: Record<AIActionTierRequired, number> = {
  COMMUNITY: 10_000,
  STARTER: 100_000,
  PRO: 2_000_000,
  ENTERPRISE: Number.MAX_SAFE_INTEGER,
};

@Injectable()
export class ActionAuthorizationGuard implements CanActivate {
  private readonly logger = new Logger(ActionAuthorizationGuard.name);

  constructor(
    private readonly registry: AIActionRegistry,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const dto = req.body as ExecuteAIActionDto | undefined;
    const user = req.user;

    if (!dto || typeof dto.action !== 'string') {
      throw new BadRequestException({
        code: 'AI_ACTION_INVALID_REQUEST',
        message: 'Missing or invalid `action` in body',
      });
    }
    if (!user?.sub) {
      throw new ForbiddenException({
        code: 'AI_ACTION_UNAUTHENTICATED',
        message: 'Authentication required',
      });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new ForbiddenException({
        code: 'AI_ACTION_NO_TENANT',
        message: 'No tenant context for invocation',
      });
    }

    // 1. Registry lookup
    const action = this.registry.getById(dto.action);
    if (!action) {
      throw new NotFoundException({
        code: 'AI_ACTION_NOT_FOUND',
        message: dto.action,
      });
    }

    const userRole: UserRole = user.role ?? UserRole.USER;
    const userPermissions = ROLE_PERMISSIONS[userRole] ?? ['ai.invoke'];

    // 2. Entity compatibility
    if (
      dto.entityType &&
      !action.supportedEntities.includes('*') &&
      !action.supportedEntities.includes(dto.entityType)
    ) {
      throw new BadRequestException({
        code: 'AI_ACTION_NOT_SUPPORTED',
        message: `${dto.action} does not support entity type ${dto.entityType}`,
      });
    }

    // 3. Permission check
    const missing = action.requiredPermissions.filter(
      (p) => !userPermissions.includes(p),
    );
    if (missing.length > 0) {
      throw new ForbiddenException({
        code: 'AI_ACTION_PERMISSION_DENIED',
        message: `Missing permissions: ${missing.join(', ')}`,
        missingPermissions: missing,
      });
    }

    // 4. Tier check
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tier: true },
    });
    if (!tenant) {
      throw new ForbiddenException({
        code: 'TENANT_NOT_FOUND',
        message: 'Tenant context invalid',
      });
    }

    const tenantTier = tenant.tier.slug.toUpperCase() as AIActionTierRequired;
    const knownTiers: AIActionTierRequired[] = [
      'COMMUNITY',
      'STARTER',
      'PRO',
      'ENTERPRISE',
    ];
    const safeTier: AIActionTierRequired = knownTiers.includes(tenantTier)
      ? tenantTier
      : 'COMMUNITY';

    if (!tierMeetsRequirement(safeTier, action.costModel.tierRequired)) {
      throw new ForbiddenException({
        code: 'TIER_TOO_LOW',
        message: `${dto.action} requires ${action.costModel.tierRequired} tier.`,
        upgradeUrl: '/billing/upgrade',
      });
    }

    // 5. Per-tenant AI credit cap (projected — uses tokensEstimate)
    if (safeTier !== 'ENTERPRISE') {
      const creditsMax =
        TIER_DEFAULT_AI_CREDITS[safeTier] ?? TIER_DEFAULT_AI_CREDITS.COMMUNITY;
      const usedThisMonth = await this.monthlyTokenUsage(tenantId);
      const projected = usedThisMonth + action.costModel.tokensEstimate;
      if (projected > creditsMax) {
        throw new HttpException(
          {
            code: 'AI_CREDITS_EXHAUSTED',
            message: 'AI credits exhausted for this period.',
            used: usedThisMonth,
            max: creditsMax,
            upgradeUrl: '/billing/upgrade',
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    // 6. Per-user rate limit (Redis-backed sliding window per minute)
    const cap = ROLE_RATE_LIMIT_PER_MIN[userRole] ?? 60;
    const allowed = await this.checkRateLimit(tenantId, user.sub, cap);
    if (!allowed) {
      throw new HttpException(
        {
          code: 'AI_RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded (${cap}/min for ${userRole}).`,
          limit: cap,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Attach the resolved action for the controller / executor.
    req.aiAction = action;
    return true;
  }

  /**
   * Sum of `AIActionInvocation.tokensUsed` for this tenant in the
   * current calendar month (UTC). Single query, indexed by
   * `[tenantId, startedAt]`.
   */
  private async monthlyTokenUsage(tenantId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const agg = await this.prisma.aIActionInvocation.aggregate({
      where: {
        tenantId,
        startedAt: { gte: startOfMonth },
        status: { in: ['COMPLETED', 'RUNNING'] },
      },
      _sum: { tokensUsed: true },
    });
    return agg._sum.tokensUsed ?? 0;
  }

  /**
   * Sliding-window per-minute counter keyed by
   * `ai_rl:{tenantId}:{userId}`. INCR + EXPIRE; cheap & lock-free.
   *
   * Falls back to `true` (allow) if Redis is unreachable so a Redis
   * outage cannot deny all AI traffic. The rate is still bounded by the
   * global ThrottlerModule (100 req / 60s / IP) so abuse is contained.
   */
  private async checkRateLimit(
    tenantId: string,
    userId: string,
    cap: number,
  ): Promise<boolean> {
    const key = `ai_rl:${tenantId}:${userId}`;
    try {
      const cur = await this.redis.incr(key);
      if (cur === 1) {
        await this.redis.expire(key, 60);
      }
      return cur <= cap;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Rate-limit Redis call failed (fail-open): ${msg}`);
      return true;
    }
  }
}
