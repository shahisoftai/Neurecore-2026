/**
 * ActivityCapability — Phase 3 capability surface for the Activity panel.
 *
 * Returns the read-only, audit-grade timeline per EAOS-NUWS-principles.md §2.9.
 * Filter chips: All / Human / AI / Workflow / State Changes.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EntityResolverService } from './entity-resolver.service';
import type { EaosEntityType } from '../dto/entity.dto';
import type { Prisma } from '@prisma/client';

export interface ActivityEntry {
  id: string;
  type: string;
  actor: string | null;
  action: string;
  target: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
  isAi: boolean;
}

export interface ActivityPanel {
  id: string;
  type: string;
  timeline: ActivityEntry[];
  filters: string[];
}

@Injectable()
export class ActivityCapability {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: EntityResolverService,
  ) {}

  async get(
    type: EaosEntityType,
    id: string,
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      type?: string;
    } = {},
  ): Promise<{
    entries: ActivityEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    await this.resolver.resolve(type, id, tenantId);

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));

    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      resourceId: id,
      ...(options.type ? { action: { contains: options.type } } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const entries: ActivityEntry[] = rows.map((r) => ({
      id: r.id,
      type: (r.details as Record<string, unknown> | null)?.['type'] as string ?? 'event',
      actor: r.actor,
      action: r.action,
      target: r.resource ?? null,
      metadata: (r.details as Record<string, unknown>) ?? {},
      timestamp: r.createdAt.toISOString(),
      isAi: (r.details as Record<string, unknown> | null)?.['isAi'] === true,
    }));

    return {
      entries,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
