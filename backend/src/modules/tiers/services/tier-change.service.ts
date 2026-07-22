/**
 * TierChangeService — explicit tier upgrade / downgrade flow.
 *
 * INDUSTRY-SETUP-CONCEPT.md §3.3 Phase 3 / TIER-SYSTEM-CONCEPT.md §6.3.
 *
 * Wraps and extends `TenantsService.changeTier` to add:
 *   - TierAuditLog row (the schema has the table but nothing wrote to it).
 *   - TierChangeRequest row (also empty until now).
 *   - Direction detection (UPGRADE / DOWNGRADE / SAME_TIER) via
 *     TierResolver.compareTierDirection.
 *   - Pre-flight validation against the new tier's agent + user cap.
 *   - Optional TierUpgradeService hook so dormant agents in the new
 *     tier's pool auto-activate on upgrade (and conversely required
 *     agents stay selected on downgrade where possible).
 *
 * SRP: this service only handles the explicit change flow. Ongoing
 *      provisioning / deselection rules belong to TierProvisioningService.
 * DIP: depends on TierResolver for comparisons + PrismaService for
 *      audit log persistence.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import type { Tier, Tenant } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TierResolver } from './tier-resolver.service';
import { TierUpgradeService } from './tier-upgrade.service';

export interface TierChangeRequestInput {
  tenantId: string;
  toTierId: string;
  requestedBy: string;
  reason?: string;
  /**
   * When true, downgrade flows are executed immediately instead of
   * creating a PENDING TierChangeRequest. The TIER-SYSTEM-CONCEPT.md
   * suggests downgrades need admin approval; we keep that path open by
   * leaving this false by default.
   */
  immediateDowngrade?: boolean;
}

export interface TierChangeResult {
  tenant: Tenant & { tier: Tier };
  fromTier: Pick<Tier, 'id' | 'slug' | 'name'> | null;
  toTier: Pick<Tier, 'id' | 'slug' | 'name'>;
  direction: 'UPGRADE' | 'DOWNGRADE' | 'SAME_TIER';
  changeRequestId: string | null;
  /** Agents auto-activated on upgrade (or untouched on downgrade). */
  activatedAgentIds: string[];
}

@Injectable()
export class TierChangeService {
  private readonly logger = new Logger(TierChangeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: TierResolver,
    @Optional()
    private readonly upgradeService?: TierUpgradeService,
  ) {}

  /**
   * Main entry point — execute an explicit tier change. Records audit
   * log + change request, pre-flights against the new tier's caps, and
   * delegates auto-activation to TierUpgradeService when upgrading.
   */
  async changeTier(input: TierChangeRequestInput): Promise<TierChangeResult> {
    const { tenantId, toTierId, requestedBy, reason, immediateDowngrade } = input;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tier: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const newTier = await this.prisma.tier.findUnique({
      where: { id: toTierId },
    });
    if (!newTier) {
      throw new NotFoundException(`Tier ${toTierId} not found`);
    }

    const direction = tenant.tier
      ? TierResolver.compareTierDirection(tenant.tier.slug, newTier.slug)
      : 'SAME_TIER';

    // ─── Pre-flight ─────────────────────────────────────────────────
    // Reject if the tenant already exceeds the new tier's caps (cannot
    // downgrade past a hard limit without first deselecting agents).
    await this.preflight(tenant.id, newTier);

    // Downgrades go through a change-request workflow by default; upgrades
    // are immediate. This mirrors TIER-SYSTEM-CONCEPT.md §6.3.
    let changeRequestId: string | null = null;
    if (direction === 'DOWNGRADE' && !immediateDowngrade) {
      const req = await this.prisma.tierChangeRequest.create({
        data: {
          tenantId: tenant.id,
          fromTierId: tenant.tierId ?? newTier.id,
          toTierId: newTier.id,
          requestedBy,
          status: 'PENDING',
          direction,
          reason: reason ?? null,
        },
      });
      changeRequestId = req.id;
      this.logger.log(
        `Tier downgrade requested for tenant ${tenantId} → ${newTier.slug}: changeRequestId=${changeRequestId}`,
      );
      // The change request is PENDING; do not mutate Tenant.tierId yet.
      return {
        tenant: { ...tenant, tier: newTier },
        fromTier: tenant.tier
          ? { id: tenant.tier.id, slug: tenant.tier.slug, name: tenant.tier.name }
          : null,
        toTier: { id: newTier.id, slug: newTier.slug, name: newTier.name },
        direction,
        changeRequestId,
        activatedAgentIds: [],
      };
    }

    // ─── Execute change (upgrade or immediate downgrade) ────────────
    const updated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { tierId: newTier.id },
      include: { tier: true },
    });

    await this.prisma.tierAuditLog.create({
      data: {
        tierId: newTier.id,
        changedBy: requestedBy,
        action: 'update',
        beforeJson: tenant.tier
          ? (tenant.tier as unknown as object as never)
          : undefined,
        afterJson: newTier as unknown as object as never,
        reason: reason ?? null,
      },
    });

    const req = await this.prisma.tierChangeRequest.create({
      data: {
        tenantId: tenant.id,
        fromTierId: tenant.tierId ?? newTier.id,
        toTierId: newTier.id,
        requestedBy,
        status: 'COMPLETED',
        direction,
        effectiveAt: new Date(),
        reason: reason ?? null,
      },
    });
    changeRequestId = req.id;

    // ─── Auto-activate dormant agents on upgrade ─────────────────────
    let activatedAgentIds: string[] = [];
    if (direction === 'UPGRADE' && this.upgradeService) {
      activatedAgentIds = await this.upgradeService.activateDormantAgentsForTier(
        tenant.id,
        newTier.id,
      );
    }

    this.logger.log(
      `Tenant ${tenantId} changed tier: ${tenant.tier?.slug ?? 'NONE'} → ${newTier.slug} (direction=${direction}, activatedAgents=${activatedAgentIds.length})`,
    );

    return {
      tenant: updated,
      fromTier: tenant.tier
        ? { id: tenant.tier.id, slug: tenant.tier.slug, name: tenant.tier.name }
        : null,
      toTier: { id: newTier.id, slug: newTier.slug, name: newTier.name },
      direction,
      changeRequestId,
      activatedAgentIds,
    };
  }

  /**
   * Reject the change when the tenant already exceeds the new tier's
   * hard caps. This is what makes "downgrade" safe — you can't drop to
   * Basic while sitting on 50 selected agents.
   */
  private async preflight(tenantId: string, newTier: Tier): Promise<void> {
    const selectedAgents = await this.prisma.agent.count({
      where: { tenantId, isSelected: true },
    });
    const departments = await this.prisma.department.count({
      where: { tenantId },
    });
    const activeUsers = await this.prisma.user.count({
      where: { tenantId, isActive: true },
    });

    const errors: string[] = [];
    if (newTier.maxAgents !== 9999 && selectedAgents > newTier.maxAgents) {
      errors.push(
        `selected agents (${selectedAgents}) exceeds tier limit (${newTier.maxAgents})`,
      );
    }
    if (
      newTier.maxDepartments !== 9999 &&
      departments > newTier.maxDepartments
    ) {
      errors.push(
        `departments (${departments}) exceeds tier limit (${newTier.maxDepartments})`,
      );
    }
    if (newTier.maxUsers !== 9999 && activeUsers > newTier.maxUsers) {
      errors.push(
        `active users (${activeUsers}) exceeds tier limit (${newTier.maxUsers})`,
      );
    }
    if (errors.length > 0) {
      throw new ConflictException({
        message: `Cannot change tier: ${errors.join('; ')}. Deselect agents or remove departments/users first.`,
        code: 'TIER_CHANGE_PREFLIGHT_FAILED',
        details: errors,
      });
    }
  }

  /**
   * Approve a pending downgrade request. Used by the admin approve flow
   * (kept minimal here — UI for the request lifecycle lives separately).
   */
  async approveChangeRequest(
    changeRequestId: string,
    approverId: string,
  ): Promise<TierChangeResult> {
    const req = await this.prisma.tierChangeRequest.findUnique({
      where: { id: changeRequestId },
    });
    if (!req) {
      throw new NotFoundException(`TierChangeRequest ${changeRequestId} not found`);
    }
    if (req.status !== 'PENDING') {
      throw new BadRequestException(
        `TierChangeRequest ${changeRequestId} is ${req.status}, not PENDING`,
      );
    }
    return this.changeTier({
      tenantId: req.tenantId,
      toTierId: req.toTierId,
      requestedBy: approverId,
      reason: `Approved from changeRequest=${changeRequestId}`,
      immediateDowngrade: true,
    }).then(async (result) => {
      await this.prisma.tierChangeRequest.update({
        where: { id: changeRequestId },
        data: { status: 'APPROVED', approvedBy: approverId },
      });
      return result;
    });
  }
}
