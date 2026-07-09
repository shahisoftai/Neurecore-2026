import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { IDependencyGraph } from '../interfaces/IDependencyGraph';
import type { EntityType, RelationshipType } from '@prisma/client';

/**
 * DependencyGraph — Phase 9d (§16.4.2).
 * Pure read-only queries on `EntityRelationship`. Used by
 * EnterpriseEventBusService for dependency-aware alert fan-out.
 */
@Injectable()
export class DependencyGraphService implements IDependencyGraph {
  constructor(private readonly prisma: PrismaService) {}

  async findDependents(
    tenantId: string,
    targetType: EntityType,
    targetId: string,
  ): Promise<Array<{ type: EntityType; id: string }>> {
    const edges = await this.prisma.entityRelationship.findMany({
      where: {
        tenantId,
        toType: targetType,
        toId: targetId,
        type: 'DEPENDS_ON' as RelationshipType,
      },
      select: { fromType: true, fromId: true },
    });
    return edges.map((e) => ({ type: e.fromType, id: e.fromId }));
  }
}
