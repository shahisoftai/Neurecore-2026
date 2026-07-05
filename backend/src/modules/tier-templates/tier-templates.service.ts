/**
 * TierTemplatesService — manages the Tier Pool (Pool #4).
 *
 * Phase 10 — Admin Business Composition.
 */

import { Injectable } from '@nestjs/common';
import { Prisma, TierTemplate, TierTemplateStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PoolListOptions } from '../../common/pool/pool.types';
import {
  PoolModelConfig,
  PoolService,
} from '../../common/pool/pool.service';
import type { CreateTierTemplateDto } from './dto/create-tier-template.dto';
import type { UpdateTierTemplateDto } from './dto/update-tier-template.dto';

@Injectable()
export class TierTemplatesService extends PoolService<
  TierTemplate,
  CreateTierTemplateDto,
  UpdateTierTemplateDto
> {
  protected readonly uniqueKey: 'id' | 'slug' | 'key' = 'slug';

  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  protected get config(): PoolModelConfig<
    TierTemplate,
    CreateTierTemplateDto,
    UpdateTierTemplateDto
  > {
    return {
      delegate: this.prismaService.tierTemplate as unknown as PoolModelConfig<
        TierTemplate,
        CreateTierTemplateDto,
        UpdateTierTemplateDto
      >['delegate'],
      defaultSortBy: 'sortOrder',
      useSoftDelete: true,
      buildWhere: (opts: PoolListOptions): Prisma.TierTemplateWhereInput => {
        const where: Prisma.TierTemplateWhereInput = {};
        if (
          opts.status &&
          (opts.status === 'DRAFT' ||
            opts.status === 'PUBLISHED' ||
            opts.status === 'ARCHIVED')
        ) {
          where.status = opts.status as TierTemplateStatus;
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
