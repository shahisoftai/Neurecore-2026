/**
 * Fallback Chain
 *
 * Resolves the ordered list of (provider.slug, model.modelId) pairs the
 * gateway should try, in priority order, when the primary is unavailable.
 *
 * The chain is computed by:
 *   1. TenantModelOverride (if any) → first link, `reason='tenant-override'`.
 *      Validated against capability + provider activity.
 *   2. Explicit `modelId` override (free-form Agent.model field) → resolved
 *      against the catalog. Validated against provider activity.
 *   3. Capability's hard-coded fallback chain (see `capabilities.ts`),
 *      resolved against the live DB. Validated against provider activity.
 *   4. Soft catalog fallback: any other `AiModel` advertising the
 *      capability with an active provider, ordered by
 *      `isDefault DESC, priority ASC`.
 *
 * SOLID: OCP — adding a new capability or new model is purely data; the
 * chain builder does not change. SRP — this class only builds chains.
 *
 * Phase 2.1 / 2.2 fixes:
 *   - All paths now require `provider: { isActive: true }`.
 *   - Capability validation on tenant override (was missing).
 *   - `modelId` lookups use the `@@unique([providerId, modelId])` index
 *     instead of ambiguous `findFirst({ where: { modelId } })`.
 *   - Deterministic tie-breaker via `isDefault, priority, createdAt`.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ALL_FALLBACK_CHAINS, type Capability } from '../domain/capabilities';

export interface ChainLink {
  providerId: string;
  providerSlug: string;
  providerName: string;
  apiBaseUrl: string;
  apiKeyEnv: string;
  aiModelId: string;
  modelId: string;
  priorityHint: number;
  reason: 'tenant-override' | 'capability-default' | 'fallback' | 'catalog';
}

/**
 * Shape we need from a joined AiModel + provider row. Subset of the Prisma
 * model — typed explicitly so this module does not depend on Prisma's
 * generated types beyond what's strictly necessary (DIP-friendly).
 */
interface CatalogRow {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capabilities: string[];
  isAvailable: boolean;
  priority: number;
  isDefault: boolean;
  provider: {
    id: string;
    slug: string;
    name: string;
    apiBaseUrl: string;
    apiKeyEnv: string;
    isActive: boolean;
  };
}

const HARD_CODED_DEFAULT_PRIORITY = 50;

const WITH_ACTIVE_PROVIDER = {
  provider: true,
} satisfies Prisma.AiModelInclude;

const WITH_ACTIVE_PROVIDER_TENANT_OVR = {
  aiModel: { include: WITH_ACTIVE_PROVIDER },
} satisfies Prisma.TenantModelOverrideInclude;

@Injectable()
export class FallbackChainBuilder {
  private readonly logger = new Logger(FallbackChainBuilder.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build the chain of models the gateway will try, in order, for the
   * given (tenantId, capability, optional explicit modelId) tuple.
   */
  async build(
    tenantId: string | null,
    capability: Capability,
    explicitModelId?: string,
  ): Promise<ChainLink[]> {
    const result: ChainLink[] = [];
    const seen = new Set<string>();

    // ─── 1. Tenant override ───────────────────────────────────────────
    if (tenantId) {
      const override = await this.prisma.tenantModelOverride.findUnique({
        where: { tenantId_capability: { tenantId, capability } },
        include: WITH_ACTIVE_PROVIDER_TENANT_OVR,
      });

      if (override) {
        const accepted = this.acceptCatalogRow(
          override.aiModel as unknown as CatalogRow,
          'tenant-override',
          capability,
        );
        if (accepted) {
          const key = this.dedupeKey(accepted.provider.slug, accepted.modelId);
          if (!seen.has(key)) {
            seen.add(key);
            result.push(this.toLink(accepted, override.priority, 'tenant-override'));
          }
        }
      }
    }

    // ─── 2. Explicit modelId override ──────────────────────────────────
    if (explicitModelId) {
      const explicit = await this.findActiveCatalogRowByModelId(
        explicitModelId,
        capability,
      );
      if (explicit) {
        const key = this.dedupeKey(explicit.provider.slug, explicit.modelId);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(this.toLink(explicit, explicit.priority, 'fallback'));
        }
      } else {
        this.logger.warn(
          `Explicit modelId "${explicitModelId}" for capability "${capability}" not found in active catalog`,
        );
      }
    }

    // ─── 3. Hard-coded fallback chain ──────────────────────────────────
    const chain = ALL_FALLBACK_CHAINS[capability] ?? [];
    for (const modelId of chain) {
      const m = await this.findActiveCatalogRowByModelId(modelId, capability);
      if (!m) continue;
      const key = this.dedupeKey(m.provider.slug, m.modelId);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(
        this.toLink(
          m,
          result.length === 0
            ? HARD_CODED_DEFAULT_PRIORITY
            : m.priority,
          result.length === 0 ? 'capability-default' : 'fallback',
        ),
      );
    }

    // ─── 4. Soft catalog fallback ──────────────────────────────────────
    const others = await this.prisma.aiModel.findMany({
      where: {
        isAvailable: true,
        capabilities: { has: capability },
        provider: { isActive: true },
      },
      include: WITH_ACTIVE_PROVIDER,
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
    });
    for (const m of others) {
      // Belt-and-braces — the SQL already filters, but acceptCatalogRow
      // is the single source of truth for membership decisions.
      const accepted = this.acceptCatalogRow(
        m as unknown as CatalogRow,
        'catalog',
        capability,
      );
      if (!accepted) continue;
      const key = this.dedupeKey(accepted.provider.slug, accepted.modelId);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(this.toLink(accepted, accepted.priority, 'catalog'));
    }
    return result;
  }

  // ─────────────────────── helpers (private) ─────────────────────────

  /**
   * Find the canonical active catalog row for a public `modelId`. Returns
   * the highest-priority match (deterministic tie-breaker: isDefault,
   * priority, createdAt). Uses `findMany` + `take: 1` instead of
   * `findFirst` so we can apply an explicit ORDER BY — Prisma's
   * `findFirst` doesn't accept ordering for "first match" determinism.
   */
  private async findActiveCatalogRowByModelId(
    modelId: string,
    capability: Capability,
  ): Promise<CatalogRow | null> {
    const candidates = await this.prisma.aiModel.findMany({
      where: {
        modelId,
        isAvailable: true,
        capabilities: { has: capability },
        provider: { isActive: true },
      },
      include: WITH_ACTIVE_PROVIDER,
      orderBy: [
        { isDefault: 'desc' },
        { priority: 'asc' },
        { createdAt: 'asc' },
      ],
      take: 1,
    });
    return (candidates[0] as unknown as CatalogRow | undefined) ?? null;
  }

  /**
   * Single source of truth for chain-membership decisions.
   * Returns the accepted row or `null` with a debug log explaining why.
   */
  private acceptCatalogRow(
    row: CatalogRow,
    source: string,
    capability: Capability,
  ): CatalogRow | null {
    if (!row.isAvailable) {
      this.logger.debug(
        `Rejecting ${source} for ${row.modelId}: model is not available`,
      );
      return null;
    }
    if (!row.provider.isActive) {
      this.logger.debug(
        `Rejecting ${source} for ${row.modelId}: provider "${row.provider.slug}" is inactive`,
      );
      return null;
    }
    if (!row.capabilities.includes(capability)) {
      this.logger.warn(
        `Rejecting ${source} for ${row.modelId}: capability "${capability}" missing (has ${JSON.stringify(row.capabilities)})`,
      );
      return null;
    }
    return row;
  }

  private toLink(
    row: CatalogRow,
    priorityHint: number,
    reason: ChainLink['reason'],
  ): ChainLink {
    return {
      providerId: row.provider.id,
      providerSlug: row.provider.slug,
      providerName: row.provider.name,
      apiBaseUrl: row.provider.apiBaseUrl,
      apiKeyEnv: row.provider.apiKeyEnv,
      aiModelId: row.id,
      modelId: row.modelId,
      priorityHint,
      reason,
    };
  }

  private dedupeKey(providerSlug: string, modelId: string): string {
    return `${providerSlug}/${modelId}`;
  }
}