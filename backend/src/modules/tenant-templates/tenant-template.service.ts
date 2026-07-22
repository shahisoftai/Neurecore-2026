import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  Prisma,
  TemplateType,
  TenantTemplate as TenantTemplateRow,
} from '@prisma/client';
import { CreateTenantTemplateDto } from './dto/create-tenant-template.dto';
import { UpdateTenantTemplateDto } from './dto/update-tenant-template.dto';
import { TemplateValidator } from './validators/template-validator.interface';

@Injectable()
export class TenantTemplateService {
  private readonly logger = new Logger(TenantTemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly validators: TemplateValidator[],
  ) {}

  private getValidator(type: TemplateType): TemplateValidator | undefined {
    return this.validators.find((v) => v.templateType === type);
  }

  private assertValidConfig(type: TemplateType, config: unknown): void {
    const validator = this.getValidator(type);
    if (!validator) return;
    const result = validator.validate(config);
    if (!result.valid) {
      throw new BadRequestException({
        message: `Invalid ${type} config`,
        errors: result.errors,
      });
    }
  }

  async list(tenantId: string, templateType?: TemplateType) {
    return this.prisma.tenantTemplate.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(templateType ? { templateType } : {}),
      },
      orderBy: [{ templateType: 'asc' }, { name: 'asc' }],
    });
  }

  async listSystemSeeds(industrySlug?: string) {
    return this.prisma.tenantTemplate.findMany({
      where: {
        tenantId: null,
        isActive: true,
        ...(industrySlug ? { industrySlug } : {}),
      },
      orderBy: [{ templateType: 'asc' }, { name: 'asc' }],
    });
  }

  async get(tenantId: string, id: string) {
    return this.prisma.tenantTemplate.findFirst({
      where: { id, tenantId },
    });
  }

  async getBySlug(tenantId: string, slug: string, templateType: TemplateType) {
    return this.prisma.tenantTemplate.findUnique({
      where: {
        tenantId_slug_templateType: { tenantId, slug, templateType },
      },
    });
  }

  async create(tenantId: string, dto: CreateTenantTemplateDto) {
    this.assertValidConfig(dto.templateType, dto.config);

    return this.prisma.tenantTemplate.create({
      data: {
        tenantId,
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        templateType: dto.templateType,
        industrySlug: dto.industrySlug,
        config: dto.config as Prisma.InputJsonValue,
        sourceSeedId: null,
        isActive: true,
        version: 1,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTenantTemplateDto) {
    const existing = await this.prisma.tenantTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Template not found');

    if (dto.config !== undefined) {
      this.assertValidConfig(existing.templateType, dto.config);
    }

    return this.prisma.tenantTemplate.update({
      where: { id },
      data: {
        ...dto,
        config: dto.config as Prisma.InputJsonValue | undefined,
        version: { increment: 1 },
      },
    });
  }

  async clone(tenantId: string, sourceId: string) {
    const source = await this.prisma.tenantTemplate.findFirst({
      where: { id: sourceId, tenantId },
    });
    if (!source) throw new NotFoundException('Source template not found');

    return this.prisma.tenantTemplate.create({
      data: {
        tenantId,
        slug: `${source.slug}-copy-${Date.now()}`,
        name: `${source.name} (Copy)`,
        description: source.description,
        templateType: source.templateType,
        industrySlug: source.industrySlug,
        config: source.config as Prisma.InputJsonValue,
        sourceSeedId: source.sourceSeedId,
        isActive: true,
        version: 1,
      },
    });
  }

  async cloneSystemSeed(tenantId: string, seedId: string) {
    const seed = await this.prisma.tenantTemplate.findFirst({
      where: { id: seedId, tenantId: null },
    });
    if (!seed) throw new NotFoundException('System seed not found');

    const existing = await this.prisma.tenantTemplate.findUnique({
      where: {
        tenantId_slug_templateType: {
          tenantId,
          slug: seed.slug,
          templateType: seed.templateType,
        },
      },
    });
    if (existing) return existing;

    return this.prisma.tenantTemplate.create({
      data: {
        tenantId,
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        templateType: seed.templateType,
        industrySlug: seed.industrySlug,
        config: seed.config as Prisma.InputJsonValue,
        sourceSeedId: seed.id,
        isActive: true,
        version: 1,
      },
    });
  }

  async reseedFromSeed(
    tenantId: string,
    templateId: string,
  ): Promise<TenantTemplateRow> {
    const tpl = await this.prisma.tenantTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!tpl) throw new NotFoundException('Template not found');
    if (!tpl.sourceSeedId) {
      throw new BadRequestException(
        'Template was not cloned from a system seed; cannot restore defaults',
      );
    }
    const seed = await this.prisma.tenantTemplate.findFirst({
      where: { id: tpl.sourceSeedId, tenantId: null },
    });
    if (!seed)
      throw new NotFoundException('Source system seed no longer exists');

    return this.prisma.tenantTemplate.update({
      where: { id: tpl.id },
      data: {
        name: seed.name,
        description: seed.description,
        industrySlug: seed.industrySlug,
        config: seed.config as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
  }

  async archive(tenantId: string, id: string) {
    const existing = await this.prisma.tenantTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Template not found');

    await this.prisma.tenantTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
