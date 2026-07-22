/**
 * Compliance Acceptance Controller — tenant-scoped acceptance tracking.
 *
 * Endpoints:
 *   GET  /api/v1/compliance/acceptance              — get current AUP/DPA/residency state
 *   POST /api/v1/compliance/acceptance/aup         — accept AUP (idempotent)
 *   POST /api/v1/compliance/acceptance/dpa         — accept DPA (idempotent)
 *   PATCH /api/v1/compliance/residency             — set data residency region
 *   PATCH /api/v1/compliance/retention             — set retention days
 *
 * Persistence: Tenant.defaultsJson (already exists on the schema) holds
 *   { dataResidency?, retentionDays?, aupAcceptedAt?, dpaAcceptedAt? }
 *
 * Each acceptance writes an AuditLog row (action: 'compliance.{aup|dpa}.accept')
 * with the actor's userId for compliance trail.
 */

import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { IsIn, IsInt, Max, Min } from 'class-validator';

const DATA_RESIDENCY_VALUES = ['auto', 'us', 'eu', 'uk', 'asia'] as const;
type DataResidency = (typeof DATA_RESIDENCY_VALUES)[number];

const RETENTION_VALUES = [30, 90, 180, 365, 730, 0] as const;

class SetResidencyDto {
  @IsIn(DATA_RESIDENCY_VALUES as unknown as string[])
  dataResidency!: DataResidency;
}

class SetRetentionDto {
  @IsInt()
  @Min(0)
  @Max(3650)
  /** 0 = indefinite */
  retentionDays!: number;
}

/**
 * ComplianceAcceptanceService — read/write to Tenant.defaultsJson.
 * Kept inline rather than as a separate service since the data model is one column.
 */
@Controller({ path: 'compliance/acceptance', version: '1' })
@ApiCommon('compliance-acceptance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.SECURITY_OFFICER,
)
export class ComplianceAcceptanceController {
  private readonly logger = new Logger(ComplianceAcceptanceController.name);

  constructor(private readonly prisma: PrismaService) {}

  private async loadDefaults(
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { defaultsJson: true },
    });
    return (t?.defaultsJson ?? {}) as Record<string, unknown>;
  }

  private async writeDefaults(
    tenantId: string,
    userId: string,
    action: string,
    next: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { defaultsJson: next as never },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actor: userId,
        action,
        resource: 'compliance',
        result: 'success',
        details: next as never,
      },
    });
  }

  @Get()
  async get(@CurrentUser() user: JwtPayload) {
    const def = await this.loadDefaults(user.tenantId!);
    return {
      dataResidency: (def.dataResidency as DataResidency) ?? 'auto',
      retentionDays: Number(def.retentionDays ?? 90),
      aupAcceptedAt: def.aupAcceptedAt ?? null,
      dpaAcceptedAt: def.dpaAcceptedAt ?? null,
      aupRequiredBy: 'v2026.07',
      dpaRequiredBy: 'v2026.07',
    };
  }

  @Post('aup')
  async acceptAup(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new BadRequestException('No tenant context');
    const def = await this.loadDefaults(user.tenantId);
    const next = { ...def, aupAcceptedAt: new Date().toISOString() };
    await this.writeDefaults(
      user.tenantId,
      user.sub,
      'compliance.aup.accept',
      next,
    );
    this.logger.log(`Tenant ${user.tenantId} accepted AUP by user ${user.sub}`);
    return { aupAcceptedAt: next.aupAcceptedAt };
  }

  @Post('dpa')
  async acceptDpa(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new BadRequestException('No tenant context');
    const def = await this.loadDefaults(user.tenantId);
    const next = { ...def, dpaAcceptedAt: new Date().toISOString() };
    await this.writeDefaults(
      user.tenantId,
      user.sub,
      'compliance.dpa.accept',
      next,
    );
    this.logger.log(`Tenant ${user.tenantId} accepted DPA by user ${user.sub}`);
    return { dpaAcceptedAt: next.dpaAcceptedAt };
  }

  @Patch('residency')
  async setResidency(
    @Body() dto: SetResidencyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new BadRequestException('No tenant context');
    const def = await this.loadDefaults(user.tenantId);
    const next = { ...def, dataResidency: dto.dataResidency };
    await this.writeDefaults(
      user.tenantId,
      user.sub,
      'compliance.residency.set',
      next,
    );
    return { dataResidency: dto.dataResidency };
  }

  @Patch('retention')
  async setRetention(
    @Body() dto: SetRetentionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new BadRequestException('No tenant context');
    if (
      dto.retentionDays !== 0 &&
      !RETENTION_VALUES.includes(dto.retentionDays as never)
    ) {
      // Allow any int 0..3650 — not only the canned values — for flexibility.
      // (ComplianceWizard offers canned values, but admins/API users may pick any.)
    }
    const def = await this.loadDefaults(user.tenantId);
    const next = { ...def, retentionDays: dto.retentionDays };
    await this.writeDefaults(
      user.tenantId,
      user.sub,
      'compliance.retention.set',
      next,
    );
    return { retentionDays: dto.retentionDays };
  }
}
