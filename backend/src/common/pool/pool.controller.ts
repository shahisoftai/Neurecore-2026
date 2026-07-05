/**
 * Abstract PoolController — generic REST surface for a PoolService.
 *
 * Phase 10 — Admin Business Composition.
 *
 * Endpoints (standard CRUD):
 *   GET    /                → list
 *   GET    /:id             → getById
 *   GET    /by-slug/:slug   → getBySlug (when supported)
 *   POST   /                → create
 *   PATCH  /:id             → update
 *   DELETE /:id             → remove
 *
 * All routes require JWT auth (via global guard) and `@Roles(…)`.
 * Subclasses set the route prefix and required roles.
 */

import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PoolListOptions } from './pool.types';
import { PoolService } from './pool.service';

export abstract class PoolController<TEntity, TCreate, TUpdate> {
  protected abstract readonly service: PoolService<TEntity, TCreate, TUpdate>;

  @Get()
  async list(@Query() raw: Record<string, string | undefined>) {
    return this.service.list(this.parseList(raw));
  }

  @Get('by-slug/:slug')
  async bySlug(@Param('slug') slug: string) {
    return this.service.getBySlug(slug);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  async create(@Body() body: TCreate) {
    return this.service.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: TUpdate) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { ok: true };
  }

  private parseList(raw: Record<string, string | undefined>): PoolListOptions {
    const opts: PoolListOptions = {};
    if (raw.page) opts.page = parseInt(raw.page, 10);
    if (raw.limit) opts.limit = parseInt(raw.limit, 10);
    if (raw.search) opts.search = raw.search;
    if (raw.status) opts.status = raw.status;
    if (raw.sortBy) opts.sortBy = raw.sortBy;
    if (raw.sortDir === 'asc' || raw.sortDir === 'desc') opts.sortDir = raw.sortDir;
    return opts;
  }
}
