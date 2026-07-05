/**
 * Pool contracts — shared across the admin frontend.
 *
 * Phase 10 — Admin Business Composition.
 *
 * Mirrors backend/src/common/pool/pool.types.ts (no shared code).
 *
 * SOLID:
 *   DIP — pages depend on IPoolAdminService, not on axios.
 *   OCP — adding a 7th pool = new service implementing this interface.
 *   ISP — narrow surface (list/get/create/update/remove) — no coupling to
 *         pool-specific implementation details.
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

export interface IPoolAdminService<TEntity, TCreate, TUpdate = Partial<TEntity>> {
  list(opts?: PoolListOptions): Promise<PoolPage<TEntity>>;
  get(id: string): Promise<TEntity>;
  getBySlug(slug: string): Promise<TEntity>;
  create(payload: TCreate): Promise<TEntity>;
  update(id: string, payload: TUpdate): Promise<TEntity>;
  remove(id: string): Promise<void>;
}

/** Recognized pool identifiers on the frontend. Single source of truth. */
export type PoolKey =
  | 'agents-pool'
  | 'departments-pool'
  | 'industries'
  | 'tier-templates'
  | 'features'
  | 'packages';
