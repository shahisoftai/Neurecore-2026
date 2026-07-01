/**
 * AutomationCapability — Phase 3 capability surface for the Automation panel.
 *
 * CONTEXTUAL capability — hidden when empty per EAOS-NUWS-principles.md §1.2.
 * Returns: automations, triggers, schedules, integrations, webhooks.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EntityResolverService } from './entity-resolver.service';
import type { EaosEntityType } from '../dto/entity.dto';

export interface AutomationPanel {
  id: string;
  type: string;
  automations: Array<{
    id: string;
    name: string;
    isActive: boolean;
    trigger: string | null;
  }>;
  routines: Array<{ id: string; name: string; isActive: boolean }>;
  integrations: Array<{ id: string; name: string; isActive: boolean }>;
}

@Injectable()
export class AutomationCapability {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: EntityResolverService,
  ) {}

  async get(
    type: EaosEntityType,
    id: string,
    tenantId: string,
  ): Promise<AutomationPanel> {
    await this.resolver.resolve(type, id, tenantId);

    const routines = await this.prisma.routine.findMany({
      where: { tenantId },
      select: { id: true, name: true, status: true },
      take: 20,
    });

    const integrations = await this.prisma.toolIntegration.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      select: { id: true, name: true, isActive: true },
      take: 20,
    });

    return {
      id,
      type,
      automations: routines.map((r) => ({
        id: r.id,
        name: r.name,
        isActive: r.status === 'ACTIVE',
        trigger: null,
      })),
      routines: routines.map((r) => ({
        id: r.id,
        name: r.name,
        isActive: r.status === 'ACTIVE',
      })),
      integrations: integrations.map((i) => ({
        id: i.id,
        name: i.name,
        isActive: i.isActive,
      })),
    };
  }
}
