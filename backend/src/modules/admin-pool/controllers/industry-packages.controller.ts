/**
 * IndustryPackagesController — admin CRUD for Industry × Tier packages.
 *
 * Paths (under /api/v1/admin/industry-packages):
 *   GET    /                     paginated list (?industry=&tierId=&isActive=)
 *   GET    /preview              recommend (?industry=&tierId=)
 *   GET    /:id                  one (with entries)
 *   POST   /                     create package shell
 *   PATCH  /:id                  rename / toggle active / recommended
 *   DELETE /:id                  cascade delete (entries go with it)
 *   PUT    /:id/entries          replace ALL entries atomically
 *
 * Auth: writes restricted to SUPER_ADMIN + PLATFORM_ADMIN. Reads available
 * to admin-tier roles that operate the FA `/pool/packages` page.
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  CreateIndustryPackageDto,
  PreviewIndustryPackageQueryDto,
  ReplaceIndustryPackageEntriesDto,
  UpdateIndustryPackageDto,
} from '../dto/admin-pool.dto';
import { IndustryPackagesService } from '../services/industry-packages.service';
import type {
  IndustryPackageDto,
  IndustryPackagePreview,
  Paginated,
} from '../interfaces/admin-pool.interface';

@ApiCommon('admin-industry-packages')
@Controller({ path: 'admin/industry-packages', version: '1' })
export class IndustryPackagesController {
  constructor(private readonly packages: IndustryPackagesService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  list(
    @Query() q: PreviewIndustryPackageQueryDto,
  ): Promise<Paginated<IndustryPackageDto>> {
    return this.packages.list({
      industry: q.industry,
      tierId: q.tierId,
    });
  }

  @Get('preview')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  preview(
    @Query() q: PreviewIndustryPackageQueryDto,
  ): Promise<IndustryPackagePreview | null> {
    if (!q.industry || !q.tierId) {
      return Promise.resolve(null);
    }
    return this.packages.recommend(q.industry, q.tierId);
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  getOne(@Param('id', ParseUUIDPipe) id: string): Promise<IndustryPackageDto> {
    return this.packages.getOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  create(@Body() dto: CreateIndustryPackageDto): Promise<IndustryPackageDto> {
    return this.packages.create({
      industry: dto.industry,
      tierId: dto.tierId,
      name: dto.name,
      description: dto.description,
    });
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIndustryPackageDto,
  ): Promise<IndustryPackageDto> {
    return this.packages.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.packages.remove(id);
  }

  @Put(':id/entries')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  replaceEntries(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceIndustryPackageEntriesDto,
  ): Promise<IndustryPackageDto> {
    return this.packages.replaceEntries(id, dto.entries);
  }
}
