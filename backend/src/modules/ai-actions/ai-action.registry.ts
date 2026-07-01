/**
 * AIActionRegistry — singleton registry of every AI Action available
 * in the current runtime. Phase 5, Task 5.1.
 *
 * Per `EAOS-implementation-plan.md` §4.6:
 *   - AI Actions are installable, discoverable, and governable.
 *   - The registry is the system of record (analogous to `EntityTypeRegistry`).
 *   - `getAvailable()` implements ISP: caller only sees fields they need
 *     (entity, permissions, tier).
 *   - `validateInvocation()` enforces DIP: registry validates, the
 *     executor doesn't.
 *
 * Lifecycle:
 *   - Built-in actions are registered at module init (`BUILT_IN_ACTIONS`).
 *   - Solution Packs (Phase 7) register / deprecate actions at install/uninstall.
 *
 * Thread-safety: the registry is read-mostly after boot. Writes happen at
 * module init and (later) during pack install. We guard writes with a lock
 * so a concurrent install never reads a half-applied set.
 *
 * SOLID:
 * - SRP — registry owns only the catalog + discovery/validation queries.
 * - OCP — new actions are added by registering a new `AIActionDefinition`;
 *   no changes to the registry itself.
 * - DIP — guards depend on this registry; they never hardcode action ids.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type {
  AIActionCategory,
  AIActionDefinition,
  AIActionTierRequired,
  AIActionPermission,
} from './action-definition';
import { registerBuiltInActions } from './built-in.actions';

export interface AIActionValidationResult {
  allowed: boolean;
  reason?: string;
  missingPermissions?: AIActionPermission[];
  action?: AIActionDefinition;
}

export interface AIActionCostEstimate {
  estimatedTokens: number;
  estimatedLatencyMs: number;
  tierRequired: AIActionTierRequired;
}

@Injectable()
export class AIActionRegistry implements OnModuleInit {
  private readonly logger = new Logger(AIActionRegistry.name);

  /** id → definition (read-mostly, write-guarded). */
  private readonly byId = new Map<string, AIActionDefinition>();
  private readonly writeLock = { locked: false };

  onModuleInit(): void {
    registerBuiltInActions(this);
    this.logger.log(
      `AIActionRegistry bootstrapped — ${this.byId.size} built-in actions registered`,
    );
  }

  /**
   * Register a new AI Action. Used by built-in init and Solution Packs.
   * Throws if the id is already taken (caller must `deprecate` first).
   */
  register(action: AIActionDefinition): void {
    this.acquireLock();
    try {
      if (this.byId.has(action.id)) {
        throw new Error(
          `AIActionRegistry: duplicate registration for "${action.id}"`,
        );
      }
      this.byId.set(action.id, action);
    } finally {
      this.writeLock.locked = false;
    }
  }

  /**
   * Mark an action as deprecated; superseded by `supersededBy`.
   * The definition remains in the registry but is filtered out of
   * `getAvailable()`.
   */
  deprecate(actionId: string, _supersededBy?: string): void {
    this.acquireLock();
    try {
      const existing = this.byId.get(actionId);
      if (!existing) return;
      this.byId.set(actionId, { ...existing, status: 'deprecated' });
    } finally {
      this.writeLock.locked = false;
    }
  }

  /**
   * Patch an existing action. Used for hot-fixes (e.g. costModel tweaks).
   * Replace-with-immutable: writes a new object, readers always see the
   * latest snapshot.
   */
  update(actionId: string, patch: Partial<AIActionDefinition>): void {
    this.acquireLock();
    try {
      const existing = this.byId.get(actionId);
      if (!existing) {
        throw new Error(`AIActionRegistry: unknown action "${actionId}"`);
      }
      this.byId.set(actionId, { ...existing, ...patch });
    } finally {
      this.writeLock.locked = false;
    }
  }

  getAll(): AIActionDefinition[] {
    return Array.from(this.byId.values());
  }

  getById(id: string): AIActionDefinition | undefined {
    return this.byId.get(id);
  }

  getByEntity(entityType: string): AIActionDefinition[] {
    return this.getAll().filter(
      (a) =>
        a.supportedEntities.includes('*') ||
        a.supportedEntities.includes(entityType),
    );
  }

  getByCapability(
    capability: AIActionDefinition['capability'],
  ): AIActionDefinition[] {
    return this.getAll().filter((a) => a.capability === capability);
  }

  getByCategory(category: AIActionCategory): AIActionDefinition[] {
    return this.getAll().filter((a) => a.category === category);
  }

  /**
   * Return only the actions a user with `permissions` and `tier` can invoke
   * against `entityType`. This is the function the Command Palette / panel
   * surfaces call.
   *
   * Filters:
   *   - status === 'deprecated' → out
   *   - supportedEntities doesn't include `entityType` → out
   *   - requiredPermissions ⊄ userPermissions → out
   *   - tier below action.costModel.tierRequired → out
   */
  getAvailable(
    entityType: string | undefined,
    userPermissions: AIActionPermission[],
    tier: AIActionTierRequired,
  ): AIActionDefinition[] {
    return this.getAll().filter((a) => {
      if (a.status !== 'stable' && a.status !== 'draft') return false;
      if (
        entityType &&
        !a.supportedEntities.includes('*') &&
        !a.supportedEntities.includes(entityType)
      ) {
        return false;
      }
      if (!a.requiredPermissions.every((p) => userPermissions.includes(p))) {
        return false;
      }
      if (!tierMeetsRequirement(tier, a.costModel.tierRequired)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Validate a candidate invocation. Returns a structured result the
   * guard consumes to surface a typed HTTP error.
   */
  validateInvocation(args: {
    actionId: string;
    entityType?: string;
    userPermissions: AIActionPermission[];
    tier: AIActionTierRequired;
  }): AIActionValidationResult {
    const action = this.byId.get(args.actionId);
    if (!action) {
      return { allowed: false, reason: `Unknown AI Action: ${args.actionId}` };
    }
    if (action.status === 'deprecated') {
      return {
        allowed: false,
        reason: `AI Action deprecated: ${args.actionId}`,
      };
    }
    if (
      args.entityType &&
      !action.supportedEntities.includes('*') &&
      !action.supportedEntities.includes(args.entityType)
    ) {
      return {
        allowed: false,
        reason: `Action ${args.actionId} does not support ${args.entityType}`,
        action,
      };
    }
    const missing = action.requiredPermissions.filter(
      (p) => !args.userPermissions.includes(p),
    );
    if (missing.length > 0) {
      return {
        allowed: false,
        reason: `Missing permissions: ${missing.join(', ')}`,
        missingPermissions: missing,
        action,
      };
    }
    if (!tierMeetsRequirement(args.tier, action.costModel.tierRequired)) {
      return {
        allowed: false,
        reason: `Tier ${args.tier} below required ${action.costModel.tierRequired}`,
        action,
      };
    }
    return { allowed: true, action };
  }

  estimateCost(actionId: string): AIActionCostEstimate | undefined {
    const action = this.byId.get(actionId);
    if (!action) return undefined;
    return {
      estimatedTokens: action.costModel.tokensEstimate,
      estimatedLatencyMs: action.timeoutMs,
      tierRequired: action.costModel.tierRequired,
    };
  }

  // ── Internals ───────────────────────────────────────────────────────

  private acquireLock(): void {
    if (this.writeLock.locked) {
      throw new Error('AIActionRegistry: concurrent mutation attempt');
    }
    this.writeLock.locked = true;
  }
}

/**
 * Tier ordering. Higher index = more capable.
 * Per `EAOS-rbac-model.md` §6.2.
 */
const TIER_ORDER: AIActionTierRequired[] = [
  'COMMUNITY',
  'STARTER',
  'PRO',
  'ENTERPRISE',
];

export function tierMeetsRequirement(
  tenantTier: AIActionTierRequired,
  required: AIActionTierRequired,
): boolean {
  const tIdx = TIER_ORDER.indexOf(tenantTier);
  const rIdx = TIER_ORDER.indexOf(required);
  return tIdx >= 0 && rIdx >= 0 && tIdx >= rIdx;
}

export const TIER_LIST = TIER_ORDER;
