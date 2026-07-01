import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import type { NotificationType } from '@prisma/client';

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  tenantId?: string;
  userId?: string;
  payload?: Record<string, unknown>;
}

/**
 * NotificationsService — SRP: handles creation, retrieval, and delivery of notifications.
 * DIP: Depends on EventsGateway abstraction for real-time delivery.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        type: input.type,
        title: input.title,
        message: input.message,
        tenantId: input.tenantId,
        userId: input.userId,
        payload: (input.payload ?? {}) as never,
      },
    });

    // Real-time delivery via WebSocket
    if (input.tenantId) {
      this.eventsGateway.emitToTenant(
        input.tenantId,
        'notification:new',
        notification,
      );
    }

    this.logger.log(
      `[Notification] Created: ${input.title} for tenant=${input.tenantId}`,
    );
    return notification;
  }

  async findAll(
    userId: string,
    tenantId: string,
    opts: { unreadOnly?: boolean; page?: number; limit?: number } = {},
  ) {
    const { unreadOnly = false, page = 1, limit = 20 } = opts;
    const skip = (page - 1) * limit;

    const where = {
      OR: [{ userId }, { tenantId, userId: null }],
      ...(unreadOnly && { isRead: false }),
    };

    const [data, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, isRead: false } }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string, tenantId: string) {
    return this.prisma.notification.updateMany({
      where: { OR: [{ userId }, { tenantId, userId: null }], isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string, tenantId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { OR: [{ userId }, { tenantId, userId: null }], isRead: false },
    });
  }

  /** Broadcast a system alert to all users of a tenant */
  async broadcastAlert(
    tenantId: string,
    level: 'info' | 'warn' | 'error',
    message: string,
  ) {
    const typeMap: Record<string, NotificationType> = {
      info: 'INFO',
      warn: 'WARNING',
      error: 'ERROR',
    };

    await this.create({
      type: typeMap[level] ?? 'INFO',
      title: `System ${level.toUpperCase()}`,
      message,
      tenantId,
    });

    this.eventsGateway.emitToTenant(tenantId, 'system:alert', {
      level,
      message,
    });
  }
}
