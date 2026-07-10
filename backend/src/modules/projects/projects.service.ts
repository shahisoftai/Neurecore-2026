/**
 * Projects Module — Business Logic Service
 */

import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import type {
  IProjectRepository,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsOptions,
} from './interfaces/project.interface';
import { PROJECT_REPOSITORY } from './interfaces/project.interface';
// Re-export so consumers of ProjectsService keep a single import.
export { PROJECT_REPOSITORY };
import {
  canTransition,
  requiresLostReason,
  type ProjectStatus,
} from './common/project-lifecycle';
import type { ProjectTypesService } from '../project-types/project-types.service';
import type { ProjectsAdapter } from '../information-engine/clients/projects.adapter';
import type { ProjectAutomationService } from '../project-automation/project-automation.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repository: IProjectRepository,
    @Inject('PROJECT_TYPES_SERVICE')
    private readonly projectTypesService: ProjectTypesService,
    @Optional() private readonly projectsAdapter?: ProjectsAdapter,
    @Optional() private readonly projectAutomation?: ProjectAutomationService,
  ) {}

  async create(input: CreateProjectInput, tenantId: string): Promise<Project> {
    if (!input.name || input.name.trim().length === 0) {
      throw new BadRequestException('Project name is required');
    }

    // Phase 2: Validate customFieldValues against fieldSchema (backwards-compat).
    // The adapter delegates this to ProjectTypesService.validateCustomFields
    // for the fieldSchema path; this call is kept here so the 16 existing
    // unit tests on validateCustomFields continue to fire from create().
    if (input.projectTypeId && input.customFieldValues) {
      const version = await this.projectTypesService.getCurrentVersion(
        input.projectTypeId,
        tenantId,
      );
      if (version) {
        this.projectTypesService.validateCustomFields(
          version.fieldSchema,
          input.customFieldValues,
        );
      }
    }

    const project = await this.repository.create(input, tenantId);

    // Phase 2: Auto-generate stages from stageTemplate (unchanged behaviour).
    if (input.projectTypeId) {
      const version = await this.projectTypesService.getCurrentVersion(
        input.projectTypeId,
        tenantId,
      );
      if (
        version &&
        version.stageTemplate &&
        version.stageTemplate.length > 0
      ) {
        await this.repository.createStages(
          project.id,
          version.stageTemplate.map((s) => ({
            name: s.name,
            order: s.order,
            description: s.defaultDurationDays
              ? `${s.defaultDurationDays} day${s.defaultDurationDays === 1 ? '' : 's'}`
              : undefined,
          })),
        );
        this.logger.debug(
          `Created ${version.stageTemplate.length} stages for project ${project.id}`,
        );
      }
    }

    // Phase 2B: Delegate engine post-create work to the EIE via adapter.
    // This seeds InformationResponse rows from customFieldValues,
    // computes EntityCompleteness, and runs applyWhen-filtered resolve.
    // Adapter is optional so unit tests can construct ProjectsService
    // without the engine; production wiring always provides it.
    if (this.projectsAdapter) {
      await this.projectsAdapter.onProjectCreated(project, tenantId, input);
    }

    // Phase 3A: Fire-and-forget project automation.
    // Never blocks project creation. Errors are logged to ProjectAutomationLog.
    if (this.projectAutomation) {
      this.projectAutomation
        .onProjectCreated(
          project.id,
          input.projectTypeId ?? '',
          project.name,
          tenantId,
        )
        .catch((err: Error) =>
          this.logger.error(
            `Phase 3A automation failed for project ${project.id}: ${err.message}`,
          ),
        );
    }

    return project;
  }

  async findById(id: string, tenantId: string): Promise<Project> {
    const project = await this.repository.findById(id, tenantId);
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async findAll(tenantId: string, options: ListProjectsOptions = {}) {
    return this.repository.findAll(options, tenantId);
  }

  async findByDepartment(departmentId: string, tenantId: string) {
    return this.repository.findByDepartment(departmentId, tenantId);
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateProjectInput,
  ): Promise<Project> {
    await this.findById(id, tenantId);
    return this.repository.update(id, tenantId, input);
  }

  async delete(id: string, tenantId: string): Promise<void> {
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

  async cloneFromProject(
    sourceProjectId: string,
    newName: string,
    tenantId: string,
  ) {
    await this.findById(sourceProjectId, tenantId);
    return this.repository.cloneFromProject(sourceProjectId, newName, tenantId);
  }

  /**
   * Transition a project through its lifecycle using the state machine.
   * Direct writes to Project.status are forbidden by design — use this method.
   */
  async transitionStatus(
    id: string,
    tenantId: string,
    to: ProjectStatus,
    reason?: string,
  ): Promise<Project> {
    const project = await this.findById(id, tenantId);
    const from = project.status;

    if (!canTransition(from, to)) {
      throw new BadRequestException(`Invalid transition: ${from} → ${to}.`);
    }
    if (requiresLostReason(to) && !reason) {
      throw new BadRequestException(
        'lostReason is required when transitioning to LOST',
      );
    }

    return this.repository.setStatus(id, tenantId, to, {
      lostReason: to === 'LOST' ? (reason ?? null) : undefined,
      completedAt: to === 'COMPLETED' ? new Date() : undefined,
    });
  }

  async getProjectStats(tenantId: string) {
    const { data: allProjects, total } = await this.repository.findAll(
      { limit: 1000 },
      tenantId,
    );

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
