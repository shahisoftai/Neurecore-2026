/**
 * CollaborationCapability — Phase 3 capability surface for the Collaboration panel.
 *
 * Returns: conversations, meetings, comments, approvals, notifications,
 * mentions, sharing. WRITE surface only (read-only audit lives in Activity).
 * Per EAOS-NUWS-principles.md §3.4.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EntityResolverService } from './entity-resolver.service';
import type { EaosEntityType } from '../dto/entity.dto';

export interface CollaborationPanel {
  id: string;
  type: string;
  notifications: Array<{
    id: string;
    title: string;
    read: boolean;
    createdAt: string;
  }>;
  approvals: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }>;
  unreadCount: number;
}

@Injectable()
export class CollaborationCapability {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: EntityResolverService,
  ) {}

  async get(
    type: EaosEntityType,
    id: string,
    tenantId: string,
  ): Promise<CollaborationPanel> {
    await this.resolver.resolve(type, id, tenantId);

    const [notifications, approvals] = await Promise.all([
      this.prisma.notification.findMany({
        where: {
          tenantId,
          payload: { path: ['resourceId'], equals: id },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.approvalRequest.findMany({
        where: { tenantId, resourceId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      id,
      type,
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        read: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      approvals: approvals.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        createdAt: a.createdAt.toISOString(),
      })),
      unreadCount: notifications.filter((n) => !n.isRead).length,
    };
  }
}
