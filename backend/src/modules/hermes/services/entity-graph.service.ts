import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { EntityType } from '@prisma/client';

export interface SubgraphParams {
  entityType: EntityType;
  entityId: string;
  tenantId: string;
  depth?: number;
  edgeTypes?: string[];
}

export interface SubgraphResult {
  entities: Array<{ type: EntityType; id: string }>;
  edges: Array<{
    from: { type: EntityType; id: string };
    to: { type: EntityType; id: string };
    type: string;
  }>;
}

@Injectable()
export class EntityGraphService {
  constructor(private readonly prisma: PrismaService) {}

  async getSubgraph(params: SubgraphParams): Promise<SubgraphResult> {
    const visited = new Set<string>();
    const entities: SubgraphResult['entities'] = [];
    const edges: SubgraphResult['edges'] = [];

    const keyOf = (t: EntityType, id: string) => `${t}:${id}`;
    const parseKey = (k: string): { type: EntityType; id: string } => {
      const idx = k.indexOf(':');
      return { type: k.slice(0, idx) as EntityType, id: k.slice(idx + 1) };
    };

    let queue = [keyOf(params.entityType, params.entityId)];

    for (let d = 0; d < (params.depth ?? 2) && queue.length > 0; d++) {
      const next: string[] = [];
      for (const key of queue) {
        if (visited.has(key)) continue;
        visited.add(key);
        const { type, id } = parseKey(key);
        entities.push({ type, id });

        const outgoing = await this.prisma.entityRelationship.findMany({
          where: {
            tenantId: params.tenantId,
            fromType: type,
            fromId: id,
            ...(params.edgeTypes?.length
              ? { type: { in: params.edgeTypes as never } }
              : {}),
          },
        });
        for (const rel of outgoing) {
          edges.push({
            from: { type: rel.fromType, id: rel.fromId },
            to: { type: rel.toType, id: rel.toId },
            type: rel.type,
          });
          const targetKey = keyOf(rel.toType, rel.toId);
          if (!visited.has(targetKey)) next.push(targetKey);
        }
      }
      queue = next;
    }
    return { entities, edges };
  }
}
