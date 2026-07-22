/**
 * TierUpgradeService — auto-activate dormant agents on tier upgrade.
 *
 * INDUSTRY-SETUP-CONCEPT.md §3.3 Phase 3 / TIER-SYSTEM-CONCEPT.md §9.2.
 *
 * When a tenant upgrades from `basic → professional`, the new tier's
 * TierAgentPool contains agents the tenant has never been able to
 * instantiate. Two scenarios:
 *
 *   A. The agent DOESN'T exist yet on the tenant → no-op (the
 *      provisioning flow handles creation separately via
 *      `TierProvisioningService.provisionAgents`).
 *
 *   B. The agent EXISTS on the tenant (from a prior upgrade / manual
 *      add) but `isSelected: false` (dormant) → activate it via this
 *      service. This is the gap Phase 3 closes.
 *
 * The service is intentionally narrow: it ONLY flips dormant agents on.
 * It does not create agents (no role allocation logic) or deselect
 * them on downgrade — downgrades need explicit user choice via
 * TierChangeService.preflight validation.
 *
 * SRP: only flips isSelected / isActive flags on existing dormant agents.
 *      Persistent state changes are scoped to "agents already on this
 *      tenant whose pool entry belongs to the new tier".
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class TierUpgradeService {
  private readonly logger = new Logger(TierUpgradeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Activate dormant agents in the new tier's pool. Returns the IDs of
   * agents that were activated (for logging / response payload).
   *
   * Algorithm:
   *   1. Find the new tier's pool entries (TierAgentPool).
   *   2. For each entry, find any dormant Agent rows on this tenant
   *      that link to that pool entry.
   *   3. Flip isSelected + isActive to true.
   *   4. Honour the new tier's maxAgents cap — stop activating once
   *      we hit it.
   */
  async activateDormantAgentsForTier(
    tenantId: string,
    newTierId: string,
  ): Promise<string[]> {
    const newTier = await this.prisma.tier.findUnique({
      where: { id: newTierId },
      select: { id: true, slug: true, maxAgents: true },
    });
    if (!newTier) return [];

    // Currently selected count — we must not exceed the new tier cap.
    const currentSelected = await this.prisma.agent.count({
      where: { tenantId, isSelected: true },
    });
    const cap = newTier.maxAgents;
    const unlimited = cap >= 9999;
    let remaining = unlimited ? Number.POSITIVE_INFINITY : cap - currentSelected;
    if (remaining <= 0) {
      this.logger.debug(
        `TierUpgradeService: tenant ${tenantId} already at agent cap (${currentSelected}/${cap}); nothing to activate`,
      );
      return [];
    }

    // Find dormant agents that belong to pool entries of the new tier.
    const dormantAgents = await this.prisma.agent.findMany({
      where: {
        tenantId,
        isSelected: false,
        tierAgentPoolId: { not: null },
        tierAgentPool: { tierId: newTierId },
      },
      select: { id: true, name: true, tierAgentPoolId: true },
      // Prefer isRequired agents first (they were dormant only because
      // the tenant was below this tier); arbitrary stable order otherwise.
      orderBy: { createdAt: 'asc' },
    });

    const toActivate = dormantAgents.slice(0, remaining);
    if (!toActivate.length) return [];

    const result = await this.prisma.agent.updateMany({
      where: { id: { in: toActivate.map((a) => a.id) } },
      data: { isSelected: true, isActive: true },
    });

    this.logger.log(
      `TierUpgradeService: activated ${result.count} dormant agents for tenant ${tenantId} on tier ${newTier.slug} (${currentSelected} → ${currentSelected + result.count} selected / cap=${cap})`,
    );

    return toActivate.map((a) => a.id);
  }
}
