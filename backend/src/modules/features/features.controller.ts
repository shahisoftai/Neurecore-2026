/**
 * FeaturesController — REST surface for /api/v1/features.
 */

import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PoolController } from '../../common/pool/pool.controller';
import type { Feature } from '@prisma/client';
import type { CreateFeatureDto } from './dto/create-feature.dto';
import type { UpdateFeatureDto } from './dto/update-feature.dto';
import { FeaturesService } from './features.service';

@ApiTags('features')
@ApiBearerAuth()
@Controller({ path: 'features', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
export class FeaturesController extends PoolController<
  Feature,
  CreateFeatureDto,
  UpdateFeatureDto
> {
  protected readonly service: FeaturesService;

  constructor(service: FeaturesService) {
    super();
    this.service = service;
  }
}
