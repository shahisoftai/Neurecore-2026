/**
 * Approval Addon Registry
 *
 * Stage 2 Phase 2A: Registry pattern for industry-specific approval addons.
 *
 * Follows the same pattern as ConnectorRegistry: addons register themselves
 * via onModuleInit. This avoids NestJS multi-provider type complications
 * with NestJS v11's Provider type definitions.
 *
 * SOLID:
 * - SRP: This registry only collects and queries addons.
 * - OCP: New addon = new file + register in module. Zero changes here.
 * - DIP: ApprovalChainsService depends on this registry (abstraction).
 */

import { Injectable, Logger } from '@nestjs/common';
import type { ApprovalAddon, ApprovalRoute } from './approval-addon.interface';

@Injectable()
export class ApprovalAddonRegistry {
  private readonly logger = new Logger(ApprovalAddonRegistry.name);
  private readonly addons: Map<string, ApprovalAddon> = new Map();

  register(addon: ApprovalAddon): void {
    for (const slug of addon.industrySlugs) {
      if (this.addons.has(slug)) {
        this.logger.warn(
          `Approval addon for industry "${slug}" already registered; overwriting`,
        );
      }
      this.addons.set(slug, addon);
    }
    this.logger.log(
      `Registered approval addon for industries: [${addon.industrySlugs.join(', ')}]`,
    );
  }

  getForIndustry(industrySlug: string): ApprovalAddon | undefined {
    return this.addons.get(industrySlug);
  }

  getForGroup(groupSlug: string): ApprovalAddon[] {
    const seen = new Set<ApprovalAddon>();
    for (const [industry, addon] of this.addons) {
      if (industry === groupSlug || industry.startsWith(groupSlug)) {
        seen.add(addon);
      }
    }
    return [...seen];
  }

  list(): string[] {
    return [...this.addons.keys()];
  }

  async getRoutesForIndustry(
    tenantId: string,
    industrySlug: string,
  ): Promise<ApprovalRoute[]> {
    const addon = this.addons.get(industrySlug);
    if (!addon) return [];
    return addon.getRoutes(tenantId);
  }

  async getRoutesForEvent(
    tenantId: string,
    industrySlug: string,
    event: string,
  ): Promise<ApprovalRoute[]> {
    const addon = this.addons.get(industrySlug);
    if (!addon) return [];
    return addon.getRoutesForEvent(tenantId, event);
  }
}
