/**
 * Models Read Controller
 *
 * Read-only endpoints that surface AI Gateway health + cost data to the
 * admin UI. Mutations live in `models-admin.controller.ts`.
 *
 * SOLID: ISP — read consumers get a minimal API; writes are segregated.
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AiGatewayService } from '../ai-gateway.service';

@Controller({ path: 'admin/models', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN')
export class ModelsReadController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AiGatewayService,
  ) {}

  @Get('health')
  health() {
    return {
      circuit: this.gateway.circuitSnapshot(),
      booted: true,
    };
  }

  @Get('cost-summary')
  async costSummary(@Query('days') daysRaw?: string) {
    const days = clampInt(daysRaw, 1, 365, 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.costRecord.groupBy({
      by: ['provider', 'model'],
      where: { createdAt: { gte: since } },
      _sum: {
        costCents: true,
        inputTokens: true,
        outputTokens: true,
      },
      _count: { _all: true },
    });
    return { days, rows: grouped };
  }
}

function clampInt(
  raw: string | undefined,
  min: number,
  max: number,
  def: number,
): number {
  if (!raw) return def;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return def;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
