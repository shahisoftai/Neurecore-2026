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
  OnModuleInit,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
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
import { ProjectAutomationService } from '../project-automation/project-automation.service';
import { GoalTemplateService } from '../project-automation/services/goal-template.service';
import { DerivedShapeApplier } from './services/derived-shape-applier.service';
import {
  ProjectShapeSchema,
  type ProjectShape,
} from '../project-shape/project-shape.types';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class ProjectsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectsService.name);

  // These deps are resolved lazily via ModuleRef in onModuleInit() because
  // NestJS's DI order puts ProjectsModule before ProjectAutomationModule, so
  // @Optional() constructor injection leaves them undefined. Lazy resolution
  // after the application is fully booted sidesteps the init-order issue.
  private projectAutomation: ProjectAutomationService | undefined;
  private goalTemplateService: GoalTemplateService | undefined;

  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly repository: IProjectRepository,
    @Inject('PROJECT_TYPES_SERVICE')
    private readonly projectTypesService: ProjectTypesService,
    @Optional()
    @Inject('PROJECTS_ADAPTER')
    private readonly projectsAdapter?: ProjectsAdapter,
    @Optional()
    private readonly moduleRef?: ModuleRef,
    @Optional()
    private readonly derivedShapeApplier?: DerivedShapeApplier,
    @Optional()
    private readonly prisma?: PrismaService,
  ) {}

  onModuleInit(): void {
    // Resolve @Global()-exported services via ModuleRef after all modules are loaded.
    try {
      this.projectAutomation =
        this.moduleRef?.get(ProjectAutomationService, { strict: false }) ??
        undefined;
      this.goalTemplateService =
        this.moduleRef?.get(GoalTemplateService, { strict: false }) ??
        undefined;
      this.logger.log(
        `ProjectsService resolved: projectAutomation=${this.projectAutomation ? 'yes' : 'no'}, goalTemplateService=${this.goalTemplateService ? 'yes' : 'no'}`,
      );
    } catch (err) {
      this.logger.warn(
        `ProjectsService.onModuleInit: lazy resolution failed (${err instanceof Error ? err.message : String(err)})`,
      );
    }
  }

  async create(input: CreateProjectInput, tenantId: string): Promise<Project> {
    if (!input.name || input.name.trim().length === 0) {
      throw new BadRequestException('Project name is required');
    }

    // Validate that exactly one of projectTypeId / derivedShape is provided.
    // SRP: ProjectsService owns the contract for what constitutes a valid
    // project creation request. Phase 8/3A pipeline is gated on projectTypeId;
    // the AI-derived path is gated on derivedShape.
    //
    // EXCEPTION: `allowBareProject: true` lets chat-driven callers create a
    // minimal project when synthesis fails. This is used by the
    // CreateProjectTool's "fallback to bare project" path. The project will
    // be created without automation (no goals, members, stages) — chat users
    // can add them later via the UI or follow-up actions.
    const hasTemplate = !!input.projectTypeId;
    let validatedShape: ProjectShape | undefined;
    if (input.derivedShape !== undefined && input.derivedShape !== null) {
      const shapeResult = ProjectShapeSchema.safeParse(input.derivedShape);
      if (!shapeResult.success) {
        throw new BadRequestException(
          `derivedShape failed validation: ${shapeResult.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ')}`,
        );
      }
      validatedShape = shapeResult.data;
    }
    const hasShape = !!validatedShape;
    if (!hasTemplate && !hasShape && !input.allowBareProject) {
      throw new BadRequestException(
        'Either projectTypeId or derivedShape is required to create a project',
      );
    }
    if (!hasTemplate && !hasShape && input.allowBareProject) {
      this.logger.warn(
        `Creating bare project "${input.name}" — no template and no derived shape. ` +
          'Automation (goals, stages, members) will NOT be applied.',
      );
    }
    if (hasTemplate && hasShape) {
      // Both provided — template wins (legacy behavior), ignore derivedShape.
      // We do NOT throw here because callers (the prior CreateProjectTool)
      // may pass both; the template is the source of truth.
      this.logger.warn(
        `Both projectTypeId and derivedShape provided for project "${input.name}"; using projectTypeId (template wins)`,
      );
    }

    this.logger.debug(
      `[DEBUG-SVC-CREATE] entering create(): name=${input.name}, hasProjectTypeId=${!!input.projectTypeId}, hasDerivedShape=${!!input.derivedShape}, hasValidatedShape=${!!validatedShape}`,
    );
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

    this.logger.debug(`[DEBUG-SVC-CREATE] calling repository.create()`);
    // INDUSTRY-SETUP-CONCEPT.md §3.1 G2 — resolve the project-level industry
    // tag once here so the repo writes a single, deterministic value. Prefer
    // the synthesised shape (Hermes is authoritative); fall back to the
    // tenant's industry; explicit input.industry wins over both when the
    // caller is the admin "change project industry" flow.
    const resolvedIndustry = await this.resolveProjectIndustry(
      validatedShape,
      input,
      tenantId,
    );
    const project = await this.repository.create(
      { ...input, industry: resolvedIndustry },
      tenantId,
    );
    this.logger.debug(
      `[DEBUG-SVC-CREATE] repository.create returned: project.id=${project.id}, status=${project.status}, hasProjectTypeId=${!!project.projectTypeId}, hasDerivedShape=${!!(project as any).derivedShape}, industry=${project.industry ?? 'null'}`,
    );

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

    this.logger.debug(
      `[DEBUG-SVC-CREATE] Phase 2-HERMES check: validatedShape=${!!validatedShape}, derivedShapeApplier=${this.derivedShapeApplier ? 'injected' : 'NOT_INJECTED'}`,
    );
    // Applies stages/goals/members/CoS inline from the synthesized ProjectShape.
    // This is the Hermes-driven path — by default, CreateProjectTool synthesizes
    // a shape via ProjectShapeSynthesisService before calling create().
    // SRP: only this branch handles derivedShape; the template-driven branch
    // (Phase 8 + Phase 3A below) is gated on projectTypeId and skipped here.
    if (validatedShape && this.derivedShapeApplier) {
      this.logger.debug(
        `Phase 2-HERMES: applying derivedShape for ${project.id} (industry=${validatedShape.industry}, stages=${validatedShape.stages.length}, goals=${validatedShape.goals.length}, members=${validatedShape.members.length})`,
      );
      try {
        const applyResult = await this.derivedShapeApplier.apply(
          project.id,
          validatedShape,
          tenantId,
        );
        if (applyResult.errors.length > 0) {
          this.logger.warn(
            `Phase 2-HERMES: ${applyResult.errors.length} error(s) applying derivedShape for ${project.id}: ${applyResult.errors.join('; ')}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Phase 2-HERMES: derivedShape application failed for ${project.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Phase 8: Synchronously create goals from goalTemplate so the project is
    // guaranteed to have its goals by the time create() returns. The rest of
    // automation (agent spawning, task planning, memory seeding, CoS) remains
    // fire-and-forget via ProjectAutomationService — those are longer-running
    // and not part of the create contract. Goal creation is short and the
    // foundation of the project, so we make it synchronous.
    //
    // Skipped when derivedShape was already applied (Phase 2-HERMES above).
    if (validatedShape) {
      // Derived shape path — Phase 8/3A already done inline.
    } else if (input.projectTypeId && this.goalTemplateService) {
      this.logger.debug(
        `Phase 8: seeding goals from goalTemplate for ${project.id}`,
      );
      try {
        const goalResult =
          await this.goalTemplateService.createGoalsFromTemplate(
            project.id,
            input.projectTypeId,
            tenantId,
          );
        if (goalResult.errors.length > 0) {
          this.logger.warn(
            `Phase 8: ${goalResult.errors.length} goal(s) failed to seed for project ${project.id}: ${goalResult.errors.join('; ')}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Phase 8: goal seeding failed for project ${project.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else if (input.projectTypeId && !this.goalTemplateService) {
      this.logger.warn(
        `Phase 8: GoalTemplateService is NOT injected — goal seeding skipped for project ${project.id}`,
      );
    }

    // Phase 3A: Fire-and-forget project automation.
    // Never blocks project creation. Errors are logged to ProjectAutomationLog.
    //
    // Skipped when derivedShape was already applied (Phase 2-HERMES above)
    // — the applier already spawned agents, CoS, and seeded memory.
    if (validatedShape) {
      // Derived shape path — automation already applied.
    } else if (this.projectAutomation) {
      this.logger.debug(
        `Phase 3A: invoking ProjectAutomationService.onProjectCreated for ${project.id} (projectTypeId=${input.projectTypeId ?? 'none'})`,
      );
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
    } else {
      this.logger.warn(
        `Phase 3A: ProjectAutomationService is NOT injected — automation skipped for project ${project.id}`,
      );
    }

    return project;
  }

  /**
   * INDUSTRY-SETUP-CONCEPT.md §3.1 G2 — pick the deterministic industry tag
   * to stamp onto a new Project row.
   *
   * Resolution order:
   *   1. Explicit `input.industry` (admin override path).
   *   2. `validatedShape.industry` (Hermes-synthesised — the canonical
   *      source for AI-created projects).
   *   3. `Tenant.industry` (fallback so template-driven projects still get
   *      a tag even when synthesis isn't involved).
   *   4. `null` (tenant has no industry yet; the column is nullable on
   *      purpose so we never block creation on missing metadata).
   *
   * Synchronous except for step 3, which is cached on the input to avoid
   * an extra round-trip on every create().
   */
  private async resolveProjectIndustry(
    validatedShape: ProjectShape | undefined,
    input: CreateProjectInput,
    tenantId: string,
  ): Promise<string | null> {
    if (typeof input.industry === 'string' && input.industry.trim().length > 0) {
      return input.industry;
    }
    if (validatedShape?.industry) {
      return validatedShape.industry;
    }
    if (!this.prisma) return null;
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { industry: true },
    });
    return tenant?.industry ?? null;
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
