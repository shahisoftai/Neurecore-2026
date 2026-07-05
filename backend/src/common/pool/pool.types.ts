/**
 * Pool Types — Shared contracts for the six business-composition pools.
 *
 * Phase 10 — Admin Business Composition Refactor.
 * Each pool (AI Employees, Departments, Industries, Tiers, Features, Packages)
 * implements IPoolAdminService<TEntity, TCreate, TUpdate> so callers depend
 * only on this interface (Dependency Inversion + Liskov Substitution).
 */

export interface PoolListOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface PoolPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * ISP / DIP — every pool CRUD surface conforms to this contract.
 * Concrete services (AgentsPoolService, IndustriesPoolService, …) implement
 * it. Callers depend on this interface, never on a concrete class.
 */
export interface IPoolAdminService<TEntity, TCreate, TUpdate> {
  list(options?: PoolListOptions): Promise<PoolPage<TEntity>>;
  getById(id: string): Promise<TEntity>;
  getBySlug(slug: string): Promise<TEntity>;
  create(payload: TCreate): Promise<TEntity>;
  update(id: string, payload: TUpdate): Promise<TEntity>;
  remove(id: string): Promise<void>;
}

/** Recognized pool identifiers — single source of truth on the backend. */
export type PoolKey =
  | 'agents-pool'
  | 'departments-pool'
  | 'industries'
  | 'tier-templates'
  | 'features'
  | 'packages';
