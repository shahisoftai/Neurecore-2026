/**
 * TierTemplatesController — REST surface for /api/v1/tier-templates.
 */

import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PoolController } from '../../common/pool/pool.controller';
import type { TierTemplate } from '@prisma/client';
import type { CreateTierTemplateDto } from './dto/create-tier-template.dto';
import type { UpdateTierTemplateDto } from './dto/update-tier-template.dto';
import { TierTemplatesService } from './tier-templates.service';

@ApiTags('tier-templates')
@ApiBearerAuth()
@Controller({ path: 'tier-templates', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
export class TierTemplatesController extends PoolController<
  TierTemplate,
  CreateTierTemplateDto,
  UpdateTierTemplateDto
> {
  protected readonly service: TierTemplatesService;

  constructor(service: TierTemplatesService) {
    super();
    this.service = service;
  }
}
