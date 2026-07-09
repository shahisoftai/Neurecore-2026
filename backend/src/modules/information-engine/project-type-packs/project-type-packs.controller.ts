/**
 * ProjectTypePacks — Controller (Phase 2B)
 */

import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ProjectTypePacksService } from './project-type-packs.service';
import { IsArray, IsString } from 'class-validator';

class ReplaceProjectTypePacksDto {
  @IsArray()
  @IsString({ each: true })
  packIds!: string[];
}

@Controller({ path: 'project-types/:projectTypeId/packs', version: '1' })
@ApiCommon('information-engine-project-type-packs')
@UseGuards(JwtAuthGuard)
export class ProjectTypePacksController {
  constructor(private readonly service: ProjectTypePacksService) {}

  @Get()
  async list(@Param('projectTypeId') projectTypeId: string) {
    return this.service.listForProjectType(projectTypeId);
  }

  @Put()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  @UseGuards(RolesGuard)
  async replace(
    @Param('projectTypeId') projectTypeId: string,
    @Body() dto: ReplaceProjectTypePacksDto,
  ) {
    return this.service.replaceForProjectType(projectTypeId, dto.packIds);
  }
}
