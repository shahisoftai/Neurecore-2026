import { Injectable } from '@nestjs/common';
import { IFeatureStore } from '../interfaces/IFeatureStore';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaFeatureStore implements IFeatureStore {
  constructor(private readonly prisma: PrismaService) {}

  async save(tenantId: string, features: Record<string, unknown>, timestamp?: string): Promise<void> {
    await this.prisma.analyticsFeature.create({
      data: {
        tenantId,
        features: features as Prisma.InputJsonValue,
        recordedAt: timestamp ? new Date(timestamp) : new Date(),
      },
    });
  }

  async getLatest(tenantId: string): Promise<{ features: Record<string, unknown>; timestamp: string } | null> {
    const row = await this.prisma.analyticsFeature.findFirst({
      where: { tenantId },
      orderBy: { recordedAt: 'desc' },
    });
    if (!row) return null;
    return {
      features: row.features as Record<string, unknown>,
      timestamp: row.recordedAt.toISOString(),
    };
  }

  async list(tenantId: string, limit = 50): Promise<Array<{ features: Record<string, unknown>; timestamp: string }>> {
    const rows = await this.prisma.analyticsFeature.findMany({
      where: { tenantId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      features: r.features as Record<string, unknown>,
      timestamp: r.recordedAt.toISOString(),
    }));
  }
}
