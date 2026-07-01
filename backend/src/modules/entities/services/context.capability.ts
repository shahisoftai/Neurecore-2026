/**
 * ContextCapability — Phase 3 capability surface for the Context panel.
 *
 * Returns: parent, children, ancestors, siblings, location, relationships,
 * industry, departmentType. Per `EAOS-implementation-plan.md` §1.5 Context.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EntityResolverService } from './entity-resolver.service';
import type { EaosEntityType } from '../dto/entity.dto';

export interface ContextPanel {
  id: string;
  type: string;
  parents: Array<{ type: string; id: string }>;
  children: Array<{ type: string; id: string; name: string | null }>;
  relationships: Array<{
    direction: 'in' | 'out';
    type: string;
    other: { type: string; id: string };
  }>;
  industry: string | null;
  departmentType: string | null;
  metadata: Record<string, unknown>;
}

@Injectable()
export class ContextCapability {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: EntityResolverService,
  ) {}

  async get(
    type: EaosEntityType,
    id: string,
    tenantId: string,
  ): Promise<ContextPanel> {
    const entity = await this.resolver.resolve(type, id, tenantId);

    const [outgoing, incoming] = await Promise.all([
      this.prisma.entityRelationship.findMany({
        where: { tenantId, fromType: type, fromId: id },
      }),
      this.prisma.entityRelationship.findMany({
        where: { tenantId, toType: type, toId: id },
      }),
    ]);

    const relationships: ContextPanel['relationships'] = [
      ...outgoing.map((r) => ({
        direction: 'out' as const,
        type: r.type,
        other: { type: r.toType, id: r.toId },
      })),
      ...incoming.map((r) => ({
        direction: 'in' as const,
        type: r.type,
        other: { type: r.fromType, id: r.fromId },
      })),
    ];

    // Derive parents/children from PARENT_OF / CHILD_OF edges.
    const parents = incoming
      .filter((r) => r.type === 'PARENT_OF')
      .map((r) => ({ type: r.fromType, id: r.fromId }));
    const children = outgoing
      .filter((r) => r.type === 'PARENT_OF')
      .map((r) => ({ type: r.toType, id: r.toId, name: null }));

    const metadata = (entity.raw.metadata as Record<string, unknown> | null) ?? {};

    return {
      id: entity.id,
      type: entity.type,
      parents,
      children,
      relationships,
      industry:
        typeof metadata.industry === 'string' ? metadata.industry : null,
      departmentType:
        typeof metadata.departmentType === 'string'
          ? metadata.departmentType
          : null,
      metadata,
    };
  }
}
