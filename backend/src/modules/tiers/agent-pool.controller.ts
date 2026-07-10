/**
 * AgentPoolController - SOLID: Interface Segregation
 *
 * SRP: Only handles tier agent pool operations
 * OCP: Extends via service interface
 * DIP: Depends on AgentPoolService abstraction
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import {
  AgentPoolService,
  AddToPoolInput,
  UpdatePoolEntryInput,
} from './services/agent-pool.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';

class AddToPoolDto implements AddToPoolInput {
  @IsString()
  tierId!: string;

  @IsString()
  templateId!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  slot?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultBudgetPerDay?: number;

  @IsOptional()
  @IsString()
  defaultModel?: string;

  @IsOptional()
  @IsBoolean()
  isDefaultSelected?: boolean;
}

class UpdatePoolEntryDto implements UpdatePoolEntryInput {
  @IsOptional()
  @IsNumber()
  @Min(1)
  slot?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultBudgetPerDay?: number;

  @IsOptional()
  @IsString()
  defaultModel?: string;

  @IsOptional()
  @IsBoolean()
  isDefaultSelected?: boolean;
}

class ReorderPoolDto {
  @IsString({ each: true })
  orderedIds!: string[];
}

@Controller({ path: 'tiers', version: '1' })
@ApiCommon('tiers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentPoolController {
  constructor(private readonly agentPoolService: AgentPoolService) {}

  // ─── Tenant-facing: View available agents ────────────────────────────────

  @Get('me/pool')
  getAvailableAgentsForTenant(@Body('tenantId') tenantId: string) {
    // Note: In production, tenantId would come from JWT, not body
    return this.agentPoolService.findByTierId(tenantId);
  }

  // ─── Platform Admin: Pool Management ─────────────────────────────────────

  @Get(':tierId/pool')
  @Roles(UserRole.SUPER_ADMIN)
  getPoolByTier(@Param('tierId', ParseUUIDPipe) tierId: string) {
    return this.agentPoolService.findByTierId(tierId);
  }

  @Post('pool')
  @Roles(UserRole.SUPER_ADMIN)
  addToPool(@Body() dto: AddToPoolDto) {
    return this.agentPoolService.addToPool(dto);
  }

  @Patch('pool/:id')
  @Roles(UserRole.SUPER_ADMIN)
  updatePoolEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePoolEntryDto,
  ) {
    return this.agentPoolService.updatePoolEntry(id, dto);
  }

  @Delete('pool/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeFromPool(@Param('id', ParseUUIDPipe) id: string) {
    return this.agentPoolService.removeFromPool(id);
  }

  @Post(':tierId/pool/reorder')
  @Roles(UserRole.SUPER_ADMIN)
  reorderPool(
    @Param('tierId', ParseUUIDPipe) tierId: string,
    @Body() dto: ReorderPoolDto,
  ) {
    return this.agentPoolService.reorderPool(tierId, dto.orderedIds);
  }
}
