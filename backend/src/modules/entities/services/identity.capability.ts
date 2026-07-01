/**
 * IdentityCapability — Phase 3 capability surface for the Identity panel.
 *
 * Returns: name, description, type, owner, labels, health summary, and
 * universal state. Per `EAOS-implementation-plan.md` §1.5 Identity.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EntityResolverService, ResolvedEntity } from './entity-resolver.service';

export interface IdentityPanel {
  id: string;
  type: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
  state: string;
  subState: string | null;
  health: {
    severity: string;
    trend: string;
    score: number;
    openAlerts: number;
    signals: Record<string, unknown>;
  };
  labels: Array<{ key: string; value: string; color: string | null }>;
  isWatched: boolean;
  isFavorite: boolean;
}

@Injectable()
export class IdentityCapability {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: EntityResolverService,
  ) {}

  async get(
    type: string,
    id: string,
    tenantId: string,
    userId: string,
  ): Promise<IdentityPanel> {
    const entity = await this.resolver.resolve(
      type as never,
      id,
      tenantId,
    );

    const [state, health, labels, favorite, watcher] = await Promise.all([
      this.prisma.entityState.findUnique({
        where: {
          tenantId_entityType_entityId: { tenantId, entityType: type as never, entityId: id },
        },
      }),
      this.prisma.entityHealth.findUnique({
        where: {
          tenantId_entityType_entityId: { tenantId, entityType: type as never, entityId: id },
        },
      }),
      this.prisma.entityLabel.findMany({
        where: { tenantId, entityType: type as never, entityId: id },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.userFavorite.findUnique({
        where: {
          userId_entityType_entityId: { userId, entityType: type as never, entityId: id },
        },
      }),
      this.prisma.entityWatcher.findUnique({
        where: {
          watcherId_entityType_entityId: { watcherId: userId, entityType: type as never, entityId: id },
        },
      }),
    ]);

    return {
      id: entity.id,
      type: entity.type,
      name: entity.name,
      description: entity.description,
      ownerId: entity.ownerId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      state: state?.currentState ?? 'DRAFT',
      subState: state?.subState ?? null,
      health: {
        severity: health?.severity ?? 'HEALTHY',
        trend: health?.trend ?? 'STABLE',
        score: health?.score ?? 100,
        openAlerts: health?.openAlerts ?? 0,
        signals: (health?.signals as Record<string, unknown>) ?? {},
      },
      labels: labels.map((l) => ({
        key: l.key,
        value: l.value,
        color: l.color,
      })),
      isFavorite: !!favorite,
      isWatched: !!watcher,
    };
  }
}
