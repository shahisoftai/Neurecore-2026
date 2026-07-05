/**
 * Abstract PoolService — generic CRUD over a Prisma model delegate.
 *
 * Phase 10 — Admin Business Composition.
 *
 * Solid:
 *   OCP — new pool = new module that subclasses this with the right Prisma
 *         delegate + sort/status fields. No existing code changes.
 *   LSP — every subclass can be swapped in for the contract defined here.
 *   DIP — controllers depend on this abstraction, not on Prisma directly.
 *
 * Subclasses provide a static `modelName` and the per-pool `delegate` accessor.
 * Optional override: `defaultSortBy`, `searchFields`, `softDelete`.
 */

import { NotFoundException } from '@nestjs/common';
import {
  PoolListOptions,
  PoolPage,
} from './pool.types';

export interface PrismaDelegateLike<TEntity, TCreate, TUpdate> {
  findMany(args: unknown): Promise<TEntity[]>;
  findFirst(args: unknown): Promise<TEntity | null>;
  findUnique(args: unknown): Promise<TEntity | null>;
  count(args: unknown): Promise<number>;
  create(args: unknown): Promise<TEntity>;
  update(args: unknown): Promise<TEntity>;
  delete(args: unknown): Promise<TEntity>;
}

export type PoolOrderBy = Record<string, 'asc' | 'desc'>;

export interface PoolModelConfig<TEntity, TCreate, TUpdate> {
  /** Prisma delegate (typed via subclass) */
  readonly delegate: PrismaDelegateLike<TEntity, TCreate, TUpdate>;
  /** Map of LIST options → Prisma where clause */
  buildWhere(opts: PoolListOptions): Record<string, unknown>;
  /** Map of LIST options → Prisma orderBy clause */
  buildOrderBy(opts: PoolListOptions): PoolOrderBy;
  /** Default orderBy key when none provided */
  readonly defaultSortBy: string;
  /** Whether the model uses soft-delete (delegates should ignore those). */
  readonly useSoftDelete: boolean;
}

export abstract class PoolService<TEntity, TCreate, TUpdate> {
  protected abstract readonly config: PoolModelConfig<TEntity, TCreate, TUpdate>;
  protected abstract readonly uniqueKey: 'id' | 'slug' | 'key';

  async list(options: PoolListOptions = {}): Promise<PoolPage<TEntity>> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const skip = (page - 1) * limit;
    const where = this.config.buildWhere(options);
    const orderBy = this.config.buildOrderBy(options);

    const [items, total] = await Promise.all([
      this.config.delegate.findMany({ where, orderBy, skip, take: limit }),
      this.config.delegate.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getById(id: string): Promise<TEntity> {
    const item = await this.config.delegate.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`${this.uniqueKey} not found: ${id}`);
    return item;
  }

  async getBySlug(slug: string): Promise<TEntity> {
    if (this.uniqueKey === 'slug' || this.uniqueKey === 'key') {
      const item = await this.config.delegate.findUnique({ where: { [this.uniqueKey]: slug } });
      if (!item) throw new NotFoundException(`${this.uniqueKey} not found: ${slug}`);
      return item;
    }
    throw new Error(`getBySlug not supported on pool keyed by ${this.uniqueKey}`);
  }

  async create(payload: TCreate): Promise<TEntity> {
    return this.config.delegate.create({ data: payload });
  }

  async update(id: string, payload: TUpdate): Promise<TEntity> {
    const existing = await this.getById(id);
    if (!existing) throw new NotFoundException(`${this.uniqueKey} not found: ${id}`);
    return this.config.delegate.update({ where: { id }, data: payload });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) throw new NotFoundException(`${this.uniqueKey} not found: ${id}`);
    await this.config.delegate.delete({ where: { id } });
  }
}
