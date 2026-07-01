import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { NotificationType } from '@prisma/client';
import type {
  IInboxRepository,
  InboxItem,
  InboxItemInput,
  FindInboxOptions,
  InboxKind,
} from '../interfaces/inbox.interface';

@Injectable()
export class PrismaInboxRepository implements IInboxRepository {
  private readonly logger = new Logger(PrismaInboxRepository.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(userId: string, tenantId: string, input: InboxItemInput): Promise<InboxItem> {
    const notificationType = this.mapKindToNotificationType(input.kind);

    const notification = await this.prisma.notification.create({
      data: {
        tenantId,
        userId,
        type: notificationType,
        title: input.title,
        message: input.body ?? '',
        payload: {
          kind: input.kind,
          entityType: input.entityType,
          entityId: input.entityId,
          priority: input.priority ?? 'MEDIUM',
          actionUrl: input.actionUrl,
          ...input.metadata,
        },
      },
    });

    return this.mapToInboxItem(notification);
  }

  async findByUser(
    userId: string,
    tenantId: string,
    options?: FindInboxOptions,
  ): Promise<InboxItem[]> {
    const where: Record<string, unknown> = {
      tenantId,
      userId,
    };

    if (options?.status === 'UNREAD') {
      where.isRead = false;
    } else if (options?.status === 'READ') {
      where.isRead = true;
    }

    if (options?.kind) {
      where.payload = {
        path: ['kind'],
        equals: options.kind,
      };
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });

    return notifications.map((n) => this.mapToInboxItem(n));
  }

  async findById(id: string): Promise<InboxItem | null> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    return notification ? this.mapToInboxItem(notification) : null;
  }

  async markRead(id: string, userId: string, tenantId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId, tenantId },
      data: { isRead: true },
    });
  }

  async markArchived(id: string, userId: string, tenantId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId, tenantId },
      data: {
        isRead: true,
        payload: {
          path: ['archivedAt'],
          value: new Date().toISOString(),
        },
      },
    });
  }

  async markAllRead(userId: string, tenantId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { tenantId, userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string, tenantId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { tenantId, userId, isRead: false },
    });
  }

  async cleanupOldItems(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }

  private mapKindToNotificationType(kind: InboxKind): NotificationType {
    const mapping: Record<InboxKind, NotificationType> = {
      APPROVAL: 'APPROVAL_REQUEST',
      FAILED_TASK: 'ERROR',
      AGENT_ALERT: 'AGENT_ALERT',
      BUDGET_ALERT: 'BILLING_ALERT',
      MENTION: 'INFO',
      SYSTEM: 'INFO',
    };
    return mapping[kind] ?? 'INFO';
  }

  private mapToInboxItem(notification: {
    id: string;
    tenantId: string | null;
    userId: string | null;
    type: string;
    title: string;
    message: string | null;
    isRead: boolean;
    payload: unknown;
    createdAt: Date;
  }): InboxItem {
    const payload = (notification.payload as Record<string, unknown>) ?? {};
    return {
      id: notification.id,
      tenantId: notification.tenantId ?? '',
      userId: notification.userId ?? '',
      kind: (payload.kind as InboxKind) ?? 'SYSTEM',
      title: notification.title,
      body: notification.message ?? undefined,
      priority:
        (payload.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') ?? 'MEDIUM',
      status: notification.isRead ? 'READ' : 'UNREAD',
      entityType: (payload.entityType as string) ?? '',
      entityId: (payload.entityId as string) ?? '',
      actionUrl: payload.actionUrl as string | undefined,
      metadata: payload,
      readAt: notification.isRead ? notification.createdAt : undefined,
      createdAt: notification.createdAt,
    };
  }
}