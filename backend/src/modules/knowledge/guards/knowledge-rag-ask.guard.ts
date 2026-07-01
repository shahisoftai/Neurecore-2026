/**
 * KnowledgeRagAskGuard — RBAC + credit cap + rate limit for /knowledge/rag-ask.
 *
 * Phase 6, Task 6.3 (per EAOS-rbac-model.md §6 + §4.9).
 *
 * Mirrors `ActionAuthorizationGuard`'s 4-layer pattern (Role → Resource
 * → Action → Row) but adapted for the RAG flow:
 *
 *   1. Authenticated user required.
 *   2. Tenant context required.
 *   3. Kill-switch check (`DISABLE_AI_ACTIONS` env, also covers RAG).
 *   4. Permission check: `ai.invoke` (same vocabulary as AI Actions).
 *   5. Tier check: COMMUNITY+ (RAG is core).
 *   6. Credit cap: projected token cost vs `TIER_DEFAULT_AI_CREDITS`.
 *   7. Rate limit: Redis sliding-window (USER 60/min, OWNER 240/min).
 *
 * Attaches `req.knowledgeRagContext` with the resolved tenantId + user
 * so the controller doesn't repeat the lookups.
 */

import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

interface KnowledgeRagContext {
  tenantId: string;
  user: JwtPayload;
  /** Approx token estimate — used by controller for cost attribution. */
  tokenEstimate: number;
}

interface AuthedRequest extends Request {
  knowledgeRagContext?: KnowledgeRagContext;
  user?: JwtPayload;
}

// Permission vocabulary (mirrors ai-actions).
const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['ai.invoke'],
  PLATFORM_ADMIN: ['ai.invoke'],
  OWNER: ['ai.invoke'],
  ADMIN: ['ai.invoke'],
  USER: ['ai.invoke'],
  AUDITOR: [],
  SUPPORT: ['ai.invoke'],
  SECURITY_OFFICER: ['ai.invoke'],
};

const ROLE_RATE_LIMIT_PER_MIN: Record<string, number> = {
  SUPER_ADMIN: 600,
  PLATFORM_ADMIN: 600,
  OWNER: 240,
  ADMIN: 120,
  USER: 60,
  AUDITOR: 60,
  SUPPORT: 60,
  SECURITY_OFFICER: 60,
};

const TIER_DEFAULT_AI_CREDITS: Record<string, number> = {
  COMMUNITY: 10_000,
  STARTER: 100_000,
  PRO: 2_000_000,
  ENTERPRISE: Number.MAX_SAFE_INTEGER,
};

const TIER_RANK: Record<string, number> = {
  COMMUNITY: 0,
  STARTER: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

const REQUIRED_TIER = 'COMMUNITY';
// Estimated RAG cost: ~600 input + ~800 output ≈ 1.4k tokens / call.
const RAG_TOKEN_ESTIMATE = 1_400;

@Injectable()
export class KnowledgeRagAskGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const dto = req.body as { question?: string } | undefined;
    const user = req.user;

    if (!user?.sub) {
      throw new ForbiddenException({
        code: 'KNOWLEDGE_RAG_UNAUTHENTICATED',
        message: 'Authentication required',
      });
    }
    if (!dto?.question || typeof dto.question !== 'string') {
      throw new BadRequestException({
        code: 'KNOWLEDGE_RAG_INVALID_REQUEST',
        message: 'Missing or invalid `question` in body',
      });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      throw new ForbiddenException({
        code: 'KNOWLEDGE_RAG_NO_TENANT',
        message: 'No tenant context for RAG ask',
      });
    }

    // 1. Kill-switch
    if (this.config.get<string>('DISABLE_AI_ACTIONS') === 'true') {
      throw new ForbiddenException({
        code: 'KNOWLEDGE_RAG_DISABLED',
        message: 'Knowledge RAG is temporarily disabled (kill-switch active).',
      });
    }

    // 2. Permission
    const userPermissions =
      ROLE_PERMISSIONS[user.role] ?? ROLE_PERMISSIONS.USER;
    if (!userPermissions.includes('ai.invoke')) {
      throw new ForbiddenException({
        code: 'KNOWLEDGE_RAG_PERMISSION_DENIED',
        message: 'ai.invoke permission required',
      });
    }

    // 3. Tier check
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

    const tenantTier = (tenant.tier.slug ?? 'community').toUpperCase();
    if ((TIER_RANK[tenantTier] ?? 0) < (TIER_RANK[REQUIRED_TIER] ?? 0)) {
      throw new ForbiddenException({
        code: 'TIER_TOO_LOW',
        message: `Knowledge RAG requires ${REQUIRED_TIER} tier.`,
        upgradeUrl: '/billing/upgrade',
      });
    }

    // 4. Credit cap (skip for ENTERPRISE)
    if (tenantTier !== 'ENTERPRISE') {
      const creditsMax =
        TIER_DEFAULT_AI_CREDITS[tenantTier] ??
        TIER_DEFAULT_AI_CREDITS.COMMUNITY;
      const usedThisMonth = await this.monthlyTokenUsage(tenantId);
      if (usedThisMonth + RAG_TOKEN_ESTIMATE > creditsMax) {
        throw new ForbiddenException({
          code: 'AI_CREDITS_EXHAUSTED',
          message: 'Knowledge RAG credit cap reached for this month.',
          used: usedThisMonth,
          max: creditsMax,
          upgradeUrl: '/billing/upgrade',
        });
      }
    }

    // 5. Rate limit (Redis sliding-window)
    const cap = ROLE_RATE_LIMIT_PER_MIN[user.role] ?? 60;
    const count = await this.redis.incr(
      `knowledge_rag_rl:${tenantId}:${user.sub}`,
    );
    if (count === 1) {
      await this.redis.expire(`knowledge_rag_rl:${tenantId}:${user.sub}`, 60);
    }
    if (count > cap) {
      throw new ForbiddenException({
        code: 'AI_RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded (${cap}/min for role ${user.role}).`,
        limit: cap,
        windowSec: 60,
      });
    }

    req.knowledgeRagContext = {
      tenantId,
      user,
      tokenEstimate: RAG_TOKEN_ESTIMATE,
    };
    return true;
  }

  private async monthlyTokenUsage(tenantId: string): Promise<number> {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const agg = await this.prisma.aIActionInvocation.aggregate({
      where: {
        tenantId,
        status: { in: ['COMPLETED', 'RUNNING'] },
        startedAt: { gte: start },
      },
      _sum: { tokensUsed: true },
    });
    return agg._sum.tokensUsed ?? 0;
  }
}