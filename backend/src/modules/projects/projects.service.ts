import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { IProjectRepository } from './interfaces/project.interface';

export const PROJECT_REPOSITORY = 'PROJECT_REPOSITORY';

export interface CreateProjectInput {
  name: string;
  description?: string;
  departmentId?: string;
  targetDate?: Date;
  goalIds?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  departmentId?: string;
  targetDate?: Date;
  goalIds?: string[];
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repository: IProjectRepository,
  ) {}

  async create(input: CreateProjectInput, tenantId: string) {
    this.logger.log(`Creating project: ${input.name}`);

    if (!input.name || input.name.trim().length === 0) {
      throw new BadRequestException('Project name is required');
    }

    return this.repository.create(input, tenantId);
  }

  async findById(id: string, tenantId: string) {
    const project = await this.repository.findById(id, tenantId);

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return project;
  }

  async findAll(
    tenantId: string,
    options?: {
      status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
      departmentId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.repository.findAll(options ?? {}, tenantId);
  }

  async findByDepartment(departmentId: string, tenantId: string) {
    return this.repository.findByDepartment(departmentId, tenantId);
  }

  async update(id: string, tenantId: string, input: UpdateProjectInput) {
    await this.findById(id, tenantId);

    return this.repository.update(id, input);
  }

  async delete(id: string, tenantId: string) {
    await this.findById(id, tenantId);

    await this.repository.delete(id, tenantId);
    this.logger.log(`Deleted project ${id}`);
  }

  async addGoal(projectId: string, goalId: string, tenantId: string) {
    await this.findById(projectId, tenantId);

    return this.repository.addGoal(projectId, goalId, tenantId);
  }

  async removeGoal(projectId: string, goalId: string, tenantId: string) {
    await this.findById(projectId, tenantId);

    return this.repository.removeGoal(projectId, goalId, tenantId);
  }

  async getProjectStats(tenantId: string) {
    const { data: allProjects, total } = await this.repository.findAll({
      limit: 1000,
    }, tenantId);

    const activeProjects = allProjects.filter((p) => p.status === 'ACTIVE');
    const completedProjects = allProjects.filter(
      (p) => p.status === 'COMPLETED',
    );
    const archivedProjects = allProjects.filter((p) => p.status === 'ARCHIVED');

    return {
      totalProjects: total,
      activeProjects: activeProjects.length,
      completedProjects: completedProjects.length,
      archivedProjects: archivedProjects.length,
      byDepartment: this.groupByDepartment(allProjects),
      upcomingDeadlines: this.getUpcomingDeadlines(allProjects),
    };
  }

  private groupByDepartment(projects: { departmentId: string | null }[]) {
    const grouped: Record<string, number> = {};
    for (const project of projects) {
      const deptId = project.departmentId || 'unassigned';
      grouped[deptId] = (grouped[deptId] || 0) + 1;
    }
    return grouped;
  }

  private getUpcomingDeadlines(projects: { targetDate: Date | null }[]) {
    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    return projects
      .filter(
        (p) =>
          p.targetDate &&
          new Date(p.targetDate) > now &&
          new Date(p.targetDate) <= thirtyDaysFromNow,
      )
      .map((p) => p.targetDate);
  }
}
