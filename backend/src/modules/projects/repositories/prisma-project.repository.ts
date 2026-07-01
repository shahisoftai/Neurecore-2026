/**
 * Projects Module - Prisma Repository Implementation
 *
 * Following SOLID:
 * - Single Responsibility: Only handles Project data access
 * - Dependency Inversion: Implements IProjectRepository interface
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IProjectRepository,
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsOptions,
  Project,
} from '../interfaces/project.interface';

@Injectable()
export class PrismaProjectRepository implements IProjectRepository {
  private readonly logger = new Logger(PrismaProjectRepository.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(data: CreateProjectInput, tenantId: string): Promise<Project> {
    this.logger.debug(`Creating project: ${data.name}`);
    const project = await this.prisma.project.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        departmentId: data.departmentId,
        targetDate: data.targetDate,
        status: 'ACTIVE',
        metadata: {},
        goalIds: data.goalIds || [],
      },
    });
    return this.mapToProject(project);
  }

  async findById(id: string, tenantId: string): Promise<Project | null> {
    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
    });
    return project ? this.mapToProject(project) : null;
  }

  async findAll(
    options: ListProjectsOptions,
    tenantId: string,
  ): Promise<{ data: Project[]; total: number }> {
    const where: Record<string, unknown> = {
      tenantId,
    };

    if (options.status) {
      where.status = options.status;
    }

    if (options.departmentId) {
      where.departmentId = options.departmentId;
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const page = options.page || 1;
    const limit = options.limit || 20;

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects.map((p) => this.mapToProject(p)),
      total,
    };
  }

  async findByDepartment(departmentId: string, tenantId: string): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      where: { departmentId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return projects.map((p) => this.mapToProject(p));
  }

  async update(
    id: string,
    data: UpdateProjectInput,
  ): Promise<Project> {
    this.logger.debug(`Updating project: ${id}`);

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.departmentId !== undefined)
      updateData.departmentId = data.departmentId;
    if (data.targetDate !== undefined) {
      updateData.targetDate = data.targetDate
        ? new Date(data.targetDate)
        : null;
    }
    if (data.metadata !== undefined) updateData.metadata = data.metadata;
    if (data.goalIds !== undefined) updateData.goalIds = data.goalIds;

    const project = await this.prisma.project.update({
      where: { id },
      data: updateData,
    });
    return this.mapToProject(project);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    this.logger.debug(`Deleting project: ${id}`);

    const project = await this.prisma.project.findFirst({
      where: { id, tenantId },
    });

    if (!project) {
      throw new Error(`Project ${id} not found for tenant ${tenantId}`);
    }

    await this.prisma.project.delete({ where: { id } });
    this.logger.log(`Deleted project ${id}`);
  }

  async addGoal(projectId: string, goalId: string, tenantId: string): Promise<Project> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const currentGoalIds = project.goalIds || [];
    if (!currentGoalIds.includes(goalId)) {
      const updated = await this.prisma.project.update({
        where: { id: projectId },
        data: { goalIds: [...currentGoalIds, goalId] },
      });
      return this.mapToProject(updated);
    }

    return this.mapToProject(project);
  }

  async removeGoal(projectId: string, goalId: string, tenantId: string): Promise<Project> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const currentGoalIds = project.goalIds || [];
    const newGoalIds = currentGoalIds.filter((id) => id !== goalId);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { goalIds: newGoalIds },
    });

    return this.mapToProject(updated);
  }

  private mapToProject(prismaProject: {
    id: string;
    tenantId: string;
    name: string;
    description: string | null;
    status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
    goalIds: string[];
    departmentId: string | null;
    targetDate: Date | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): Project {
    return {
      id: prismaProject.id,
      tenantId: prismaProject.tenantId,
      name: prismaProject.name,
      description: prismaProject.description,
      status: prismaProject.status,
      goalIds: prismaProject.goalIds || [],
      departmentId: prismaProject.departmentId,
      targetDate: prismaProject.targetDate,
      metadata: prismaProject.metadata,
      createdAt: prismaProject.createdAt,
      updatedAt: prismaProject.updatedAt,
    };
  }
}