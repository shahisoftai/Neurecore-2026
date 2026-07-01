/**
 * EntityGraphService — supports the Mini-Graph feature (NUWS §5.6).
 *
 * Returns the 1-hop relationship neighborhood of an entity. Pure read;
 * relationships are written by EntityOwnership/EntityRelationship modules.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { EaosEntityType } from '../dto/entity.dto';

export interface MiniGraphNode {
  id: string;
  type: string;
  name: string | null;
  relationship: string;
  direction: 'in' | 'out';
}

export interface MiniGraph {
  center: { id: string; type: string };
  nodes: MiniGraphNode[];
}

@Injectable()
export class EntityGraphService {
  constructor(private readonly prisma: PrismaService) {}

  async oneHop(
    type: EaosEntityType,
    id: string,
    tenantId: string,
  ): Promise<MiniGraph> {
    const [outgoing, incoming] = await Promise.all([
      this.prisma.entityRelationship.findMany({
        where: { tenantId, fromType: type, fromId: id },
      }),
      this.prisma.entityRelationship.findMany({
        where: { tenantId, toType: type, toId: id },
      }),
    ]);

    // Build lightweight node references — name lookups would require a
    // dynamic Prisma call per node; Phase 3 returns ids+types only and
    // the frontend lazy-resolves names via the existing detail hooks.
    const nodes: MiniGraphNode[] = [
      ...outgoing.map((r) => ({
        id: r.toId,
        type: r.toType,
        name: null,
        relationship: r.type,
        direction: 'out' as const,
      })),
      ...incoming.map((r) => ({
        id: r.fromId,
        type: r.fromType,
        name: null,
        relationship: r.type,
        direction: 'in' as const,
      })),
    ];

    return {
      center: { id, type },
      nodes,
    };
  }
}
