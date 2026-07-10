import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface TimelineEntry {
  id: string;
  type: string;
  title: string;
  description: string | null;
  actorId: string;
  actorType: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  metadata: Record<string, unknown>;
}

export interface ActivityTimeline {
  projectId: string;
  entries: TimelineEntry[];
  totalCount: number;
  hasMore: boolean;
}

@Injectable()
export class ActivityTimelineService {
  private readonly logger = new Logger(ActivityTimelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getTimeline(
    projectId: string,
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      types?: string[];
      severity?: string;
    } = {},
  ): Promise<ActivityTimeline> {
    const { limit = 20, offset = 0, types, severity } = options;

    const where: Record<string, unknown> = {
      tenantId,
      contextId: projectId,
    };

    if (types && types.length > 0) {
      where['type'] = { in: types };
    }

    if (severity) {
      where['severity'] = severity;
    }

    const [events, totalCount] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.activityEvent.count({ where }),
    ]);

    const entries: TimelineEntry[] = events.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      description: e.description,
      actorId: e.actorId,
      actorType: e.actorType,
      timestamp: e.createdAt.toISOString(),
      severity: e.severity as 'info' | 'warning' | 'error' | 'success',
      metadata: (e.payload as Record<string, unknown>) ?? {},
    }));

    return {
      projectId,
      entries,
      totalCount,
      hasMore: offset + entries.length < totalCount,
    };
  }

  async recordActivity(params: {
    tenantId: string;
    projectId: string;
    type: string;
    title: string;
    description?: string;
    actorType: 'USER' | 'AI_AGENT' | 'SYSTEM' | 'WORKFLOW' | 'EXTERNAL';
    actorId: string;
    severity?: 'info' | 'warning' | 'error' | 'success';
    payload?: Record<string, unknown>;
  }): Promise<TimelineEntry> {
    const event = await this.prisma.activityEvent.create({
      data: {
        tenantId: params.tenantId,
        type: params.type,
        title: params.title,
        description: params.description ?? null,
        actorType: params.actorType as never,
        actorId: params.actorId,
        severity: params.severity ?? 'info',
        contextType: 'PROJECT',
        contextId: params.projectId,
        payload: (params.payload ?? {}) as never,
        visibility: 'tenant',
      },
    });

    return {
      id: event.id,
      type: event.type,
      title: event.title,
      description: event.description,
      actorId: event.actorId,
      actorType: event.actorType,
      timestamp: event.createdAt.toISOString(),
      severity: event.severity as 'info' | 'warning' | 'error' | 'success',
      metadata: (event.payload as Record<string, unknown>) ?? {},
    };
  }
}
