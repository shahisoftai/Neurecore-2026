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
import { TenantContextService } from '../../common/context/tenant-context.service';
import { TenantTemplateService } from './tenant-template.service';
import { TenantTemplateSeederService } from './tenant-template-seeder.service';
import { CreateTenantTemplateDto } from './dto/create-tenant-template.dto';
import { UpdateTenantTemplateDto } from './dto/update-tenant-template.dto';

@Controller({ path: 'tenant-templates', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantTemplatesController {
  constructor(
    private readonly templateService: TenantTemplateService,
    private readonly seederService: TenantTemplateSeederService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  async list(@Query('type') templateType?: TemplateType) {
    const tenantId = this.tenantContext.tenantId;
    return this.templateService.list(tenantId, templateType);
  }

  @Public()
  @Get('system-seeds')
  async listSystemSeeds(@Query('industrySlug') industrySlug?: string) {
    return this.templateService.listSystemSeeds(industrySlug);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const tenantId = this.tenantContext.tenantId;
    return this.templateService.get(tenantId, id);
  }

  @Post()
  async create(@Body() dto: CreateTenantTemplateDto) {
    const tenantId = this.tenantContext.tenantId;
    return this.templateService.create(tenantId, dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTenantTemplateDto) {
    const tenantId = this.tenantContext.tenantId;
    return this.templateService.update(tenantId, id, dto);
  }

  @Delete(':id')
  async archive(@Param('id') id: string) {
    const tenantId = this.tenantContext.tenantId;
    await this.templateService.archive(tenantId, id);
    return { success: true };
  }

  @Post(':id/clone')
  async clone(@Param('id') id: string) {
    const tenantId = this.tenantContext.tenantId;
    return this.templateService.clone(tenantId, id);
  }

  @Post('system-seeds/:id/clone')
  async cloneSystemSeed(@Param('id') id: string) {
    const tenantId = this.tenantContext.tenantId;
    return this.templateService.cloneSystemSeed(tenantId, id);
  }

  @Post('reseed')
  async reseed(@Body('industrySlug') industrySlug: string) {
    const tenantId = this.tenantContext.tenantId;
    const count = await this.seederService.reseedForTenant(
      tenantId,
      industrySlug,
    );
    return { count };
  }

  @Post(':id/restore-from-seed')
  async restoreFromSeed(@Param('id') id: string) {
    const tenantId = this.tenantContext.tenantId;
    return this.templateService.reseedFromSeed(tenantId, id);
  }
}
