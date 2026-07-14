/**
 * Enterprise Event Fabric — observability + admin diagnostics (Phase 2 §15).
 *
 * Authorized diagnostic surface for fabric operators. Exposes counters and
 * tenant-scoped dead-letter inspection + replay. Guarded by JwtAuthGuard;
 * replay + dead-letter inspection additionally require the caller's tenant to
 * match the record's tenant (enforced in the transport for replay).
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { EVENT_TRANSPORT } from './contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from './contracts/enterprise-event-transport.interface';

interface RequestWithUser {
  user?: { tenantId?: string; role?: string; roles?: string[] };
}

@Controller({ path: 'admin/enterprise-events', version: '1' })
@UseGuards(JwtAuthGuard)
export class EnterpriseEventsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_TRANSPORT)
    private readonly transport: IEnterpriseEventTransport,
  ) {}

  /** Fabric-wide stats, scoped to the caller's tenant. */
  @Get('stats')
  async stats(@Req() req: RequestWithUser) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new ForbiddenException('tenant context required');

    const [
      published,
      pendingOutbox,
      pendingInbox,
      processing,
      processed,
      failed,
      deadLettered,
      oldestPending,
    ] = await Promise.all([
      this.prisma.enterpriseEventOutbox.count({ where: { tenantId } }),
      this.prisma.enterpriseEventOutbox.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.enterpriseEventInbox.count({
        where: { tenantId, status: 'PENDING' },
      }),
      this.prisma.enterpriseEventInbox.count({
        where: { tenantId, status: 'PROCESSING' },
      }),
      this.prisma.enterpriseEventInbox.count({
        where: { tenantId, status: 'PROCESSED' },
      }),
      this.prisma.enterpriseEventInbox.count({
        where: { tenantId, status: 'FAILED' },
      }),
      this.prisma.enterpriseEventInbox.count({
        where: { tenantId, status: 'DEAD_LETTER' },
      }),
      this.prisma.enterpriseEventOutbox.findFirst({
        where: { tenantId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      tenantId,
      published,
      pendingOutbox,
      pendingInbox,
      processing,
      processed,
      failed,
      deadLettered,
      oldestPendingAgeMs: oldestPending
        ? Date.now() - oldestPending.createdAt.getTime()
        : 0,
    };
  }

  /** Events grouped by type for the caller's tenant. */
  @Get('by-type')
  async byType(@Req() req: RequestWithUser) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new ForbiddenException('tenant context required');
    const grouped = await this.prisma.enterpriseEventOutbox.groupBy({
      by: ['eventType'],
      where: { tenantId },
      _count: { _all: true },
    });
    return grouped.map((g) => ({ eventType: g.eventType, count: g._count._all }));
  }

  /** Tenant-scoped dead-letter inspection (authorization-protected). */
  @Get('dead-letters')
  async deadLetters(
    @Req() req: RequestWithUser,
    @Query('replayStatus') replayStatus?: string,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new ForbiddenException('tenant context required');
    return this.prisma.enterpriseEventDeadLetter.findMany({
      where: {
        tenantId,
        ...(replayStatus ? { replayStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /** Administrative, tenant-scoped replay of a dead-lettered delivery. */
  @Post('dead-letters/:id/replay')
  async replay(@Param('id') id: string, @Req() req: RequestWithUser) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new ForbiddenException('tenant context required');
    const ok = await this.transport.replayDeadLetter(id, tenantId);
    if (!ok) {
      throw new ForbiddenException(
        'dead-letter not found for tenant or not replayable',
      );
    }
    return { replayed: true, id };
  }
}
