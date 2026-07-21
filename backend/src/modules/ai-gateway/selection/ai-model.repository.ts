/**
 * AI Model Repository
 *
 * Read-side cache over the Prisma `model_providers`, `ai_models`, and
 * `tenant_model_overrides` tables. Cache is FIFO with TTL (60s default).
 * Mutations through the admin endpoints call `invalidate()` so changes
 * propagate within the TTL.
 *
 * SOLID: SRP — the repo is the only place that reads catalog tables
 * outside of the seed script.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface CatalogModel {
  id: string;
  modelId: string;
  displayName: string;
  capabilities: string[];
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  priority: number;
  isDefault: boolean;
  isAvailable: boolean;
  provider: {
    id: string;
    slug: string;
    name: string;
    apiBaseUrl: string;
    apiKeyEnv: string;
    isActive: boolean;
  };
}

interface CacheEntry {
  expiresAt: number;
  models: CatalogModel[];
}

@Injectable()
export class AiModelRepository {
  private readonly logger = new Logger(AiModelRepository.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs: number;
  private readonly maxEntries: number;
  constructor(
    private readonly prisma: PrismaService,
    @Optional() cacheTtlSeconds = 60,
    @Optional() maxEntries = 256,
  ) {
    this.cacheTtlMs = cacheTtlSeconds * 1000;
    this.maxEntries = maxEntries;
  }

  /**
   * List every available model. Cached for `cacheTtlMs` ms. Invalidated
   * by `invalidate()` after admin writes.
   */
  async listAvailable(): Promise<CatalogModel[]> {
    return this.getOrLoad('available', () =>
      this.prisma.aiModel
        .findMany({
          where: {
            isAvailable: true,
            provider: { isActive: true },
          },
          include: { provider: true },
          orderBy: [
            { isDefault: 'desc' },
            { priority: 'asc' },
            { createdAt: 'asc' },
          ],
        })
        .then((rows) => rows.map(toCatalogModel)),
    );
  }

  /**
   * Find the canonical active model for a public `modelId`. With the
   * `(providerId, modelId) @@unique` index, the same `modelId` may
   * exist under multiple providers — we deterministically pick the
   * highest-priority active match.
   *
   * Phase 2.2: replaces the previous `findFirst({ where: { modelId } })`
   * which returned nondeterministic results across providers.
   */
  async findByModelId(modelId: string): Promise<CatalogModel | null> {
    // Use the same active-catalog list as `listAvailable()` — already
    // filtered, ordered, and provider-validated.
    const all = await this.listAvailable();
    return all.find((m) => m.modelId === modelId) ?? null;
  }

  async findByCapability(capability: string): Promise<CatalogModel[]> {
    const all = await this.listAvailable();
    return all.filter((m) => m.capabilities.includes(capability));
  }

  async findById(id: string): Promise<CatalogModel | null> {
    const row = await this.prisma.aiModel.findUnique({
      where: { id },
      include: { provider: true },
    });
    return row ? toCatalogModel(row) : null;
  }

  /** Drop every cached list. Called after admin mutations. */
  invalidate(): void {
    this.cache.clear();
  }

  private async getOrLoad(
    key: string,
    loader: () => Promise<CatalogModel[]>,
  ): Promise<CatalogModel[]> {
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.models;
    }
    const models = await loader();
    if (this.cache.size >= this.maxEntries) {
      // Evict the oldest entry by insertion order. `Map` iterates
      // in insertion order, so the first key is the FIFO candidate.
      for (const k of this.cache.keys()) {
        this.cache.delete(k);
        break;
      }
    }
    this.cache.set(key, {
      expiresAt: now + this.cacheTtlMs,
      models,
    });
    return models;
  }
}

function toCatalogModel(row: {
  id: string;
  modelId: string;
  displayName: string;
  capabilities: string[];
  contextWindow: number;
  costPer1kInput: Prisma.Decimal | number;
  costPer1kOutput: Prisma.Decimal | number;
  priority: number;
  isDefault: boolean;
  isAvailable: boolean;
  provider: {
    id: string;
    slug: string;
    name: string;
    apiBaseUrl: string;
    apiKeyEnv: string;
    isActive: boolean;
  };
}): CatalogModel {
  return {
    id: row.id,
    modelId: row.modelId,
    displayName: row.displayName,
    capabilities: row.capabilities,
    contextWindow: row.contextWindow,
    costPer1kInput: decimalToNumber(row.costPer1kInput),
    costPer1kOutput: decimalToNumber(row.costPer1kOutput),
    priority: row.priority,
    isDefault: row.isDefault,
    isAvailable: row.isAvailable,
    provider: row.provider,
  };
}

function decimalToNumber(v: Prisma.Decimal | number): number {
  if (typeof v === 'number') return v;
  return v.toNumber();
}
