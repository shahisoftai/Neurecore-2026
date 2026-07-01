import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import { QuotaEvaluatorService } from '../services/quota-evaluator.service';
import { QuotaEnforcerService } from '../services/quota-enforcer.service';
import { SpendingCapService } from '../services/spending-cap.service';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

class SetLimitDto {
  @IsString() quotaKey!: string;
  @IsNumber() @Min(0) limit!: number;
}

class SetCapDto {
  @IsNumber() @Min(0) amountUsd!: number;
}

function resolveTenantId(user: JwtPayload, explicit?: string): string {
  if (user.role === UserRole.SUPER_ADMIN) {
    if (!explicit) throw new Error('tenantId is required for SUPER_ADMIN');
    return explicit;
  }
  return user.tenantId!;
}

/**
 * ReliabilityController — Phase 4.5
 * Exposes admin endpoints for quota management, spending cap configuration,
 * and circuit breaker introspection.
 */
@ApiCommon('reliability')
@Controller({ path: 'reliability', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReliabilityController {
  constructor(
    private readonly evaluator: QuotaEvaluatorService,
    private readonly enforcer: QuotaEnforcerService,
    private readonly spendingCap: SpendingCapService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  // ─── Quota ────────────────────────────────────────────────────────────────

  @Get('quota')
  async getQuota(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') qTenantId?: string,
    @Query('quotaKey') quotaKey?: string,
    @Query('period') period?: string,
  ) {
    const tenantId = resolveTenantId(user, qTenantId);
    return this.enforcer.check({
      tenantId,
      quotaKey: quotaKey ?? 'agent_executions',
      period,
    });
  }

  @Post('quota/set-limit')
  @Roles(UserRole.SUPER_ADMIN)
  async setQuotaLimit(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') tenantId: string,
    @Body() dto: SetLimitDto,
  ) {
    await this.evaluator.setLimit(
      { tenantId, quotaKey: dto.quotaKey },
      dto.limit,
    );
    return { tenantId, quotaKey: dto.quotaKey, limit: dto.limit };
  }

  @Delete('quota/reset')
  @Roles(UserRole.SUPER_ADMIN)
  async resetQuota(
    @Query('tenantId') tenantId: string,
    @Query('quotaKey') quotaKey: string,
    @Query('period') period = 'daily',
  ) {
    await this.evaluator.reset({ tenantId, quotaKey, period });
    return { reset: true, tenantId, quotaKey, period };
  }

  // ─── Spending caps ────────────────────────────────────────────────────────

  @Get('spending-cap')
  async getSpendingCap(
    @CurrentUser() user: JwtPayload,
    @Query('tenantId') qTenantId?: string,
  ) {
    const tenantId = resolveTenantId(user, qTenantId);
    return this.spendingCap.evaluate(tenantId);
  }

  @Post('spending-cap/soft')
  @Roles(UserRole.SUPER_ADMIN)
  async setSoftCap(
    @Query('tenantId') tenantId: string,
    @Body() dto: SetCapDto,
  ) {
    await this.spendingCap.setSoftCap(tenantId, dto.amountUsd);
    return { tenantId, softCapUsd: dto.amountUsd };
  }

  @Post('spending-cap/hard')
  @Roles(UserRole.SUPER_ADMIN)
  async setHardCap(
    @Query('tenantId') tenantId: string,
    @Body() dto: SetCapDto,
  ) {
    await this.spendingCap.setHardCap(tenantId, dto.amountUsd);
    return { tenantId, hardCapUsd: dto.amountUsd };
  }

  // ─── Circuit breakers ────────────────────────────────────────────────────

  @Get('circuit-breaker/:key')
  getCircuitStatus(@Param('key') key: string) {
    return this.circuitBreaker.getStatus(key);
  }

  @Delete('circuit-breaker/:key/reset')
  @Roles(UserRole.SUPER_ADMIN)
  resetCircuit(@Param('key') key: string) {
    this.circuitBreaker.reset(key);
    return { reset: true, key };
  }
}
