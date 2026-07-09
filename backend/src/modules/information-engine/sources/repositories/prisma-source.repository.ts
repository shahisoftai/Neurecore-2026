/**
 * Sources — Prisma Repository (Phase 2B)
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type {
  ISourceRepository,
  CreateSourceInput,
  InformationSource,
} from '../interfaces/source.interface';
import type { InformationSourceType } from '../../common/types';

@Injectable()
export class PrismaSourceRepository implements ISourceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSourceInput): Promise<InformationSource> {
    const created = await this.prisma.informationSource.create({
      data: {
        type: input.type,
        label: input.label,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        confidence: clampConfidence(input.confidence),
      },
    });
    return mapToSource(created);
  }

  async findById(id: string): Promise<InformationSource | null> {
    const found = await this.prisma.informationSource.findUnique({
      where: { id },
    });
    return found ? mapToSource(found) : null;
  }

  async markVerified(id: string, actorId: string): Promise<InformationSource> {
    const updated = await this.prisma.informationSource.update({
      where: { id },
      data: {
        verified: true,
        verifiedBy: actorId,
        verifiedAt: new Date(),
      },
    });
    return mapToSource(updated);
  }
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function mapToSource(raw: {
  id: string;
  type: string;
  label: string;
  refType: string | null;
  refId: string | null;
  confidence: number;
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
}): InformationSource {
  return {
    id: raw.id,
    type: raw.type as InformationSource['type'],
    label: raw.label,
    refType: raw.refType,
    refId: raw.refId,
    confidence: raw.confidence,
    verified: raw.verified,
    verifiedBy: raw.verifiedBy,
    verifiedAt: raw.verifiedAt,
    createdAt: raw.createdAt,
  };
}
