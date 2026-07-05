/**
 * IndustriesController — REST surface for /api/v1/industries.
 *
 * Phase 10 — Admin Business Composition.
 * SOLID: thin controller; delegates to IndustriesService.
 */

import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PoolController } from '../../common/pool/pool.controller';
import type { Industry } from '@prisma/client';
import type { CreateIndustryDto } from './dto/create-industry.dto';
import type { UpdateIndustryDto } from './dto/update-industry.dto';
import { IndustriesService } from './industries.service';

@ApiTags('industries')
@ApiBearerAuth()
@Controller({ path: 'industries', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
export class IndustriesController extends PoolController<Industry, CreateIndustryDto, UpdateIndustryDto> {
  protected readonly service: IndustriesService;

  constructor(service: IndustriesService) {
    super();
    this.service = service;
  }
}
