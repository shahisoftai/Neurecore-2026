/**
 * OperationsCapability — Phase 3 capability surface for the Operations panel.
 *
 * Returns: tasks, workflows, projects, goals, routines, milestones,
 * dependencies, workload, calendar. Per EAOS-implementation-plan.md §1.5.
 *
 * In Phase 3 this returns counts + the top-N items. Rich aggregations
 * arrive in Phase 4 (Widgets).
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EntityResolverService } from './entity-resolver.service';
import type { EaosEntityType } from '../dto/entity.dto';

export interface OperationsPanel {
  id: string;
  type: string;
  counts: {
    tasks: number;
    workflows: number;
    goals: number;
    routines: number;
  };
  tasks: Array<{ id: string; title: string; status: string }>;
  workflows: Array<{ id: string; name: string; status: string }>;
  goals: Array<{ id: string; title: string; status: string }>;
  routines: Array<{ id: string; name: string; isActive: boolean }>;
}

@Injectable()
export class OperationsCapability {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: EntityResolverService,
  ) {}

  async get(
    type: EaosEntityType,
    id: string,
    tenantId: string,
  ): Promise<OperationsPanel> {
    await this.resolver.resolve(type, id, tenantId);

    // Cross-entity relationships of type REFERENCES / DEPENDS_ON give us
    // the "what does this entity touch" graph.
    const rels = await this.prisma.entityRelationship.findMany({
      where: {
        tenantId,
        OR: [
          { fromType: type, fromId: id },
          { toType: type, toId: id },
        ],
      },
      take: 50,
    });

    const relatedIds = new Set<string>();
    for (const r of rels) {
      relatedIds.add(r.fromId);
      relatedIds.add(r.toId);
    }
    relatedIds.delete(id);

    const ids = Array.from(relatedIds);
    const [tasks, workflows, goals, routines] = await Promise.all([
      this.prisma.task.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true, title: true, status: true },
        take: 20,
      }),
      this.prisma.workflow.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true, name: true, status: true },
        take: 20,
      }),
      this.prisma.goal.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true, title: true, status: true },
        take: 20,
      }),
      this.prisma.routine.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true, name: true, status: true },
        take: 20,
      }),
    ]);

    return {
      id,
      type,
      counts: {
        tasks: tasks.length,
        workflows: workflows.length,
        goals: goals.length,
        routines: routines.length,
      },
      tasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status })),
      workflows: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        status: w.status,
      })),
      goals: goals.map((g) => ({ id: g.id, title: g.title, status: g.status })),
      routines: routines.map((r) => ({
        id: r.id,
        name: r.name,
        isActive: r.status === 'ACTIVE',
      })),
    };
  }
}
