/**
 * Fallback Chain
 *
 * Resolves the ordered list of (provider.slug, model.modelId) pairs the
 * gateway should try, in priority order, when the primary is unavailable.
 *
 * The chain is computed by:
 *   1. The capability's hard-coded fallback chain (see `capabilities.ts`),
 *      resolved against the live DB to swap `modelId` → `(provider, model)`.
 *   2. A "soft" fallback that walks the catalog for any model advertising
 *      the capability, ordered by `isDefault DESC, priority ASC`.
 *
 * SOLID: OCP — adding a new capability or new model is purely data; the
 * chain builder does not change.
 */

import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class FallbackChainBuilder {
  private readonly logger = new Logger(FallbackChainBuilder.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build the chain of models the gateway will try, in order, for the
   * given (tenantId, capability, optional explicit modelId) tuple.
   *
   * Order:
   *   1. TenantModelOverride (if any) → first link, `reason='tenant-override'`.
   *   2. Capability's hard-coded chain → resolve each `modelId` to a
   *      `(provider, model)` pair from the catalog. Marks each as
   *      `reason='fallback'` or, for the first one that exists AND
   *      matches `isDefault`, `reason='capability-default'`.
   *   3. Soft fallback: any other `AiModel` whose capabilities include
   *      `capability`, ordered by `isDefault DESC, priority ASC`, marked
   *      `reason='catalog'`.
   */
  async build(
    tenantId: string | null,
    capability: Capability,
    explicitModelId?: string,
  ): Promise<ChainLink[]> {
    const result: ChainLink[] = [];
    const seen = new Set<string>();

    // 1. Tenant override
    if (tenantId) {
      const override = await this.prisma.tenantModelOverride.findUnique({
        where: { tenantId_capability: { tenantId, capability } },
        include: { aiModel: { include: { provider: true } } },
      });
      if (override && override.aiModel.isAvailable) {
        const key = `${override.aiModel.provider.slug}/${override.aiModel.modelId}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({
            providerId: override.aiModel.providerId,
            providerSlug: override.aiModel.provider.slug,
            providerName: override.aiModel.provider.name,
            apiBaseUrl: override.aiModel.provider.apiBaseUrl,
            apiKeyEnv: override.aiModel.provider.apiKeyEnv,
            aiModelId: override.aiModel.id,
            modelId: override.aiModel.modelId,
            priorityHint: override.priority,
            reason: 'tenant-override',
          });
        }
      }
    }

    // 2. Explicit override (free-form Agent.model field)
    if (explicitModelId) {
      const explicit = await this.prisma.aiModel.findFirst({
        where: {
          modelId: explicitModelId,
          isAvailable: true,
          capabilities: { has: capability },
        },
        include: { provider: true },
      });
      if (explicit) {
        const key = `${explicit.provider.slug}/${explicit.modelId}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({
            providerId: explicit.providerId,
            providerSlug: explicit.provider.slug,
            providerName: explicit.provider.name,
            apiBaseUrl: explicit.provider.apiBaseUrl,
            apiKeyEnv: explicit.provider.apiKeyEnv,
            aiModelId: explicit.id,
            modelId: explicit.modelId,
            priorityHint: explicit.priority,
            reason: 'fallback',
          });
        }
      } else {
        this.logger.warn(
          `Explicit modelId ${explicitModelId} for capability ${capability} not found in catalog`,
        );
      }
    }

    // 3. Hard-coded fallback chain
    const chain = ALL_FALLBACK_CHAINS[capability] ?? [];
    for (const modelId of chain) {
      const m = await this.prisma.aiModel.findFirst({
        where: {
          modelId,
          isAvailable: true,
          capabilities: { has: capability },
        },
        include: { provider: true },
      });
      if (!m) continue;
      const key = `${m.provider.slug}/${m.modelId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        providerId: m.providerId,
        providerSlug: m.provider.slug,
        providerName: m.provider.name,
        apiBaseUrl: m.provider.apiBaseUrl,
        apiKeyEnv: m.provider.apiKeyEnv,
        aiModelId: m.id,
        modelId: m.modelId,
        priorityHint: m.priority,
        reason: result.length === 0 ? 'capability-default' : 'fallback',
      });
    }

    // 4. Soft fallback: anything else that advertises the capability
    const others = await this.prisma.aiModel.findMany({
      where: {
        isAvailable: true,
        capabilities: { has: capability },
        provider: { isActive: true },
      },
      include: { provider: true },
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }],
    });
    for (const m of others) {
      const key = `${m.provider.slug}/${m.modelId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        providerId: m.providerId,
        providerSlug: m.provider.slug,
        providerName: m.provider.name,
        apiBaseUrl: m.provider.apiBaseUrl,
        apiKeyEnv: m.provider.apiKeyEnv,
        aiModelId: m.id,
        modelId: m.modelId,
        priorityHint: m.priority,
        reason: 'catalog',
      });
    }
    return result;
  }
}
