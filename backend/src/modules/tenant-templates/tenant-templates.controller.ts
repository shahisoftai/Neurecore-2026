import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TemplateType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../../common/decorators/roles.decorator';
import { TenantTemplateService } from './tenant-template.service';
import { TenantTemplateSeederService } from './tenant-template-seeder.service';
import { CreateTenantTemplateDto } from './dto/create-tenant-template.dto';
import { UpdateTenantTemplateDto } from './dto/update-tenant-template.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

@Controller({ path: 'tenant-templates', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantTemplatesController {
  constructor(
    private readonly templateService: TenantTemplateService,
    private readonly seederService: TenantTemplateSeederService,
  ) {}

  @Get()
  async list(@CurrentUser() user: JwtPayload, @Query('type') templateType?: TemplateType) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.templateService.list(user.tenantId, templateType);
  }

  @Public()
  @Get('system-seeds')
  async listSystemSeeds(@Query('industrySlug') industrySlug?: string) {
    return this.templateService.listSystemSeeds(industrySlug);
  }

  @Get(':id')
  async get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.templateService.get(user.tenantId, id);
  }

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTenantTemplateDto) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.templateService.create(user.tenantId, dto);
  }

  @Patch(':id')
  async update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateTenantTemplateDto) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.templateService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  async archive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    await this.templateService.archive(user.tenantId, id);
    return { success: true };
  }

  @Post(':id/clone')
  async clone(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.templateService.clone(user.tenantId, id);
  }

  @Post('system-seeds/:id/clone')
  async cloneSystemSeed(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.templateService.cloneSystemSeed(user.tenantId, id);
  }

  @Post('reseed')
  async reseed(@CurrentUser() user: JwtPayload, @Body('industrySlug') industrySlug: string) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const count = await this.seederService.reseedForTenant(
      user.tenantId,
      industrySlug,
    );
    return { count };
  }

  @Post(':id/restore-from-seed')
  async restoreFromSeed(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.templateService.reseedFromSeed(user.tenantId, id);
  }
}
