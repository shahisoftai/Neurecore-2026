/**
 * FeaturesController — REST surface for /api/v1/features.
 */

import { Body, Controller, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
@Roles('SUPER_ADMIN', 'PLATFORM_ADMIN', 'OWNER', 'ADMIN')
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

  @Post()
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Create a feature' })
  async create(@Body() body: CreateFeatureDto) {
    return super.create(body);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Update a feature' })
  async update(@Param('id') id: string, @Body() body: UpdateFeatureDto) {
    return super.update(id, body);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  @ApiOperation({ summary: 'Delete a feature' })
  async remove(@Param('id') id: string) {
    return super.remove(id);
  }
}
