import type { EntityType } from '@prisma/client';

export interface IDependencyGraph {
  /** Find entities that depend on the given target via DEPENDS_ON edges. */
  findDependents(
    tenantId: string,
    targetType: EntityType,
    targetId: string,
  ): Promise<Array<{ type: EntityType; id: string }>>;
}

export const DEPENDENCY_GRAPH = Symbol('DEPENDENCY_GRAPH');
