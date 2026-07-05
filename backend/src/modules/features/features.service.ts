/**
 * FeaturesService — manages the Feature Pool (Pool #5).
 *
 * Phase 10 — Admin Business Composition.
 */

import { Injectable } from '@nestjs/common';
import { Feature, FeatureCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PoolListOptions } from '../../common/pool/pool.types';
import {
  PoolModelConfig,
  PoolService,
} from '../../common/pool/pool.service';
import type { CreateFeatureDto } from './dto/create-feature.dto';
import type { UpdateFeatureDto } from './dto/update-feature.dto';

@Injectable()
export class FeaturesService extends PoolService<
  Feature,
  CreateFeatureDto,
  UpdateFeatureDto
> {
  protected readonly uniqueKey: 'id' | 'slug' | 'key' = 'key';

  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  protected get config(): PoolModelConfig<
    Feature,
    CreateFeatureDto,
    UpdateFeatureDto
  > {
    return {
      delegate: this.prismaService.feature as unknown as PoolModelConfig<
        Feature,
        CreateFeatureDto,
        UpdateFeatureDto
      >['delegate'],
      defaultSortBy: 'sortOrder',
      useSoftDelete: false,
      buildWhere: (opts: PoolListOptions): Prisma.FeatureWhereInput => {
        const where: Prisma.FeatureWhereInput = {};
        const validCategories = Object.values(FeatureCategory);
        if (opts.status && validCategories.includes(opts.status as FeatureCategory)) {
          where.category = opts.status as FeatureCategory;
        }
        if (opts.search) {
          where.OR = [
            { key: { contains: opts.search, mode: 'insensitive' } },
            { name: { contains: opts.search, mode: 'insensitive' } },
          ];
        }
        return where;
      },
      buildOrderBy: (opts: PoolListOptions) => {
        const key = opts.sortBy ?? 'sortOrder';
        const dir = opts.sortDir ?? 'asc';
        return { [key]: dir };
      },
    };
  }
}
