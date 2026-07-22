/**
 * IndustriesService — manages the Industry Pool (Pool #3).
 *
 * Phase 10 — Admin Business Composition.
 * SOLID:
 *   S — owns only Industry CRUD.
 *   O — extends the abstract PoolService without modifying it.
 *   L — substitutable for IPoolAdminService<Industry,…>.
 *   D — depends on PrismaService abstraction + PoolService base.
 */

import { Injectable } from '@nestjs/common';
import { Industry, IndustryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PoolListOptions } from '../../common/pool/pool.types';
import { PoolModelConfig, PoolService } from '../../common/pool/pool.service';
import type { CreateIndustryDto } from './dto/create-industry.dto';
import type { UpdateIndustryDto } from './dto/update-industry.dto';

@Injectable()
export class IndustriesService extends PoolService<
  Industry,
  CreateIndustryDto,
  UpdateIndustryDto
> {
  protected readonly uniqueKey: 'id' | 'slug' | 'key' = 'slug';

  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  protected get config(): PoolModelConfig<
    Industry,
    CreateIndustryDto,
    UpdateIndustryDto
  > {
    return {
      delegate: this.prismaService.industry as unknown as PoolModelConfig<
        Industry,
        CreateIndustryDto,
        UpdateIndustryDto
      >['delegate'],
      defaultSortBy: 'sortOrder',
      useSoftDelete: true,
      buildWhere: (opts: PoolListOptions): Prisma.IndustryWhereInput => {
        const where: Prisma.IndustryWhereInput = {};
        if (
          opts.status &&
          (opts.status === 'ACTIVE' || opts.status === 'ARCHIVED')
        ) {
          where.status = opts.status as IndustryStatus;
        }
        if (opts.search) {
          where.OR = [
            { slug: { contains: opts.search, mode: 'insensitive' } },
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
