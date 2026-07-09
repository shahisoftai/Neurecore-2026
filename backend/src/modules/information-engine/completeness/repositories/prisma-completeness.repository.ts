/**
 * Completeness — Prisma Repository (Phase 2B)
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type {
  ICompletenessRepository,
  EntityCompletenessRow,
  UpsertCompletenessInput,
} from '../interfaces/completeness.interface';
import type { InformationEntityType } from '../../common/types';

@Injectable()
export class PrismaCompletenessRepository implements ICompletenessRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: UpsertCompletenessInput): Promise<EntityCompletenessRow> {
    const row = await this.prisma.entityCompleteness.upsert({
      where: {
        entityType_entityId: {
          entityType: input.entityType,
          entityId: input.entityId,
        },
      },
      create: {
        entityType: input.entityType,
        entityId: input.entityId,
        score: clampScore(input.score),
        totalRequired: input.totalRequired,
        totalResolved: input.totalResolved,
        missingJson: input.missing as unknown as object,
        lastAssessedAt: input.lastAssessedAt,
      },
      update: {
        score: clampScore(input.score),
        totalRequired: input.totalRequired,
        totalResolved: input.totalResolved,
        missingJson: input.missing as unknown as object,
        lastAssessedAt: input.lastAssessedAt,
      },
    });
    return mapToRow(row);
  }

  async findByEntity(
    entityType: InformationEntityType,
    entityId: string,
  ): Promise<EntityCompletenessRow | null> {
    const found = await this.prisma.entityCompleteness.findUnique({
      where: {
        entityType_entityId: {
          entityType: entityType,
          entityId,
        },
      },
    });
    return found ? mapToRow(found) : null;
  }
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function mapToRow(raw: {
  id: string;
  entityType: string;
  entityId: string;
  score: number;
  totalRequired: number;
  totalResolved: number;
  missingJson: unknown;
  lastAssessedAt: Date;
}): EntityCompletenessRow {
  return {
    id: raw.id,
    entityType: raw.entityType as EntityCompletenessRow['entityType'],
    entityId: raw.entityId,
    score: raw.score,
    totalRequired: raw.totalRequired,
    totalResolved: raw.totalResolved,
    missing: Array.isArray(raw.missingJson)
      ? (raw.missingJson as EntityCompletenessRow['missing'])
      : [],
    lastAssessedAt: raw.lastAssessedAt,
  };
}
