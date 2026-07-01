import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  IDepartmentTemplateService,
  CreateDeptTemplateInput,
} from './interfaces/department-template.interface';

/**
 * DepartmentTemplatesService
 *
 * SRP : Manages CRUD for DepartmentTemplate records only.
 *       Does NOT perform deployment — that is DeploymentService's concern.
 * OCP : New filter/sort options can be added via opts without changing callers.
 * DIP : Controller depends on this service through constructor injection only.
 */
@Injectable()
export class DepartmentTemplatesService implements IDepartmentTemplateService {
  private readonly logger = new Logger(DepartmentTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Query ──────────────────────────────────────────────────────────────────

  async findAll(opts?: { category?: string; page?: number; limit?: number }) {
    const { category, page = 1, limit = 20 } = opts ?? {};
    const skip = (page - 1) * limit;
    const where = {
      isPublic: true,
      ...(category && { category }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.departmentTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.departmentTemplate.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const tmpl = await this.prisma.departmentTemplate.findUnique({
      where: { id },
    });
    if (!tmpl)
      throw new NotFoundException(`Department template ${id} not found`);
    return tmpl;
  }

  async findBySlug(slug: string) {
    const tmpl = await this.prisma.departmentTemplate.findUnique({
      where: { slug },
    });
    if (!tmpl)
      throw new NotFoundException(`Department template "${slug}" not found`);
    return tmpl;
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  async create(dto: CreateDeptTemplateInput) {
    // Enforce unique slug at service layer (distinct from DB constraint error)
    const existing = await this.prisma.departmentTemplate.findUnique({
      where: { slug: dto.slug },
    });
    if (existing)
      throw new ConflictException(`Slug "${dto.slug}" is already taken`);

    const tmpl = await this.prisma.departmentTemplate.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        structure: (dto.structure ?? []) as never,
        category: dto.category ?? 'general',
        tags: (dto.tags ?? []) as never,
        isPublic: dto.isPublic ?? true,
      },
    });

    this.logger.log(`Created department template "${tmpl.slug}"`);
    return tmpl;
  }

  async update(id: string, dto: Partial<CreateDeptTemplateInput>) {
    await this.findOne(id); // throws if missing

    return this.prisma.departmentTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.structure !== undefined && {
          structure: dto.structure as never,
        }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.tags !== undefined && { tags: dto.tags as never }),
        ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // throws if missing
    await this.prisma.departmentTemplate.delete({ where: { id } });
    this.logger.log(`Deleted department template ${id}`);
  }
}
