/**
 * ContextIdentityResolver — resolves an organizational actor's identity and
 * effective authority/autonomy (ADR-002 §6).
 *
 * Resolution order (fail-safe):
 *   1. Resolve base identity: for AI_AGENT from Agent/HermesAgent; for HUMAN
 *      from User + membership. Department from Agent.departmentId / membership.
 *   2. Derive base authority/autonomy: from Agent config authority enum
 *      (AUTO|RECOMMEND|APPROVAL) → numeric; humans by role.
 *   3. Evaluate governance (IGovernanceEvaluator) → effective authority/autonomy.
 *
 * If identity cannot be resolved, callers MUST treat it as DENIED. This service
 * returns `null` on unresolved identity — it never fabricates a default
 * authority value.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  GOVERNANCE_EVALUATOR,
  type IGovernanceEvaluator,
} from '../../governance/interfaces/governance-evaluator.interface';
import type {
  AuthContext,
  ContextAuth,
  EmployeeType,
  ResolvedIdentity,
} from '../contracts/context-plane.interface';

// Authority enum (string, from Agent config) → numeric base authority.
const AUTHORITY_ENUM_TO_LEVEL: Record<string, number> = {
  AUTO: 90,
  APPROVE: 90,
  DELEGATE: 80,
  RECOMMEND: 50,
  RECOMMENDATION: 50,
  SUGGEST: 40,
  ASK: 30,
  OBSERVE: 10,
  APPROVAL: 30, // requires human approval → low autonomy
};

const HUMAN_ROLE_TO_AUTHORITY: Record<string, number> = {
  OWNER: 100,
  SUPER_ADMIN: 100,
  ADMIN: 90,
  MANAGER: 75,
  MEMBER: 40,
  VIEWER: 10,
};

@Injectable()
export class ContextIdentityResolver {
  private readonly logger = new Logger(ContextIdentityResolver.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(GOVERNANCE_EVALUATOR)
    private readonly governance: IGovernanceEvaluator,
  ) {}

  /**
   * Resolve full ContextAuth for an actor. Returns null if identity cannot be
   * resolved (caller must DENY).
   */
  async resolve(
    tenantId: string,
    actorId: string,
    actorType: EmployeeType,
  ): Promise<ContextAuth | null> {
    if (!tenantId || !actorId) return null;

    const identity =
      actorType === 'AI_AGENT'
        ? await this.resolveAgent(tenantId, actorId)
        : await this.resolveHuman(tenantId, actorId);

    if (!identity) {
      this.logger.warn(
        `Identity unresolved for ${actorType} ${actorId} in tenant ${tenantId} — will DENY`,
      );
      return null;
    }

    // Governance evaluation → effective authority/autonomy.
    let evalResult;
    try {
      evalResult = await this.governance.evaluate(tenantId, {
        'actor.id': identity.employeeId,
        'actor.type': identity.employeeType,
        'actor.role': identity.role,
        'actor.department': identity.departmentId ?? '',
        'actor.authority': identity.authorityLevel,
      });
    } catch (e) {
      // Governance failure → fail safe: no elevation, block autonomy.
      this.logger.warn(
        `Governance evaluate failed for ${actorId}: ${
          e instanceof Error ? e.message : String(e)
        } — failing safe`,
      );
      const authContext: AuthContext = {
        applicablePolicies: [],
        effectiveAuthority: 0,
        effectiveAutonomy: 0,
        governanceBlocked: true,
      };
      return { tenantId, identity, authContext };
    }

    const authContext: AuthContext = {
      applicablePolicies: evalResult.triggeredRules.map((r) => ({
        ruleId: r,
        effect: evalResult.allowed ? 'ALLOW' : 'BLOCK',
      })),
      effectiveAuthority: evalResult.allowed ? identity.authorityLevel : 0,
      effectiveAutonomy: evalResult.allowed
        ? evalResult.requiresApproval
          ? Math.min(identity.autonomyLevel, 30)
          : identity.autonomyLevel
        : 0,
      governanceBlocked: !evalResult.allowed,
    };

    return { tenantId, identity, authContext };
  }

  private async resolveAgent(
    tenantId: string,
    agentId: string,
  ): Promise<ResolvedIdentity | null> {
    // Try Agent (business entity) first — it carries departmentId + config.
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
      select: {
        id: true,
        name: true,
        departmentId: true,
        config: true,
        metadata: true,
        department: { select: { name: true } },
      },
    });

    if (agent) {
      const authorityEnum = this.extractAuthorityEnum(agent.config, agent.metadata);
      const authorityLevel = AUTHORITY_ENUM_TO_LEVEL[authorityEnum] ?? 20;
      return {
        employeeId: agent.id,
        employeeType: 'AI_AGENT',
        displayName: agent.name,
        role: 'AI_EMPLOYEE',
        departmentId: agent.departmentId ?? null,
        departmentName: agent.department?.name ?? null,
        authorityLevel,
        // Autonomy is not a first-class field; derive conservatively from authority.
        autonomyLevel: Math.max(0, authorityLevel - 20),
        resolvedFrom: 'agent.config.authorityLevel',
      };
    }

    // Fall back to HermesAgent (execution profile).
    const hermes = await this.prisma.hermesAgent.findFirst({
      where: { id: agentId, tenantId },
      select: { id: true, name: true, type: true, isActive: true },
    });
    if (hermes) {
      return {
        employeeId: hermes.id,
        employeeType: 'AI_AGENT',
        displayName: hermes.name,
        role: hermes.type,
        departmentId: null,
        departmentName: null,
        authorityLevel: 20, // conservative default for a bare execution profile
        autonomyLevel: 0,
        resolvedFrom: 'hermesAgent.type',
      };
    }

    return null;
  }

  private async resolveHuman(
    tenantId: string,
    userId: string,
  ): Promise<ResolvedIdentity | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, firstName: true, lastName: true, role: true },
    });
    if (!user) return null;
    const role = String(user.role ?? 'MEMBER');
    const authorityLevel = HUMAN_ROLE_TO_AUTHORITY[role] ?? 40;
    return {
      employeeId: user.id,
      employeeType: 'HUMAN',
      displayName:
        [user.firstName, user.lastName].filter(Boolean).join(' ') || user.id,
      role,
      departmentId: null,
      departmentName: null,
      authorityLevel,
      autonomyLevel: authorityLevel, // humans act at their own authority
      resolvedFrom: 'user.role',
    };
  }

  private extractAuthorityEnum(config: unknown, metadata: unknown): string {
    const fromObj = (o: unknown): string | undefined => {
      if (o && typeof o === 'object') {
        const v = (o as Record<string, unknown>).authorityLevel;
        if (typeof v === 'string') return v.toUpperCase();
      }
      return undefined;
    };
    return fromObj(config) ?? fromObj(metadata) ?? 'RECOMMEND';
  }
}
