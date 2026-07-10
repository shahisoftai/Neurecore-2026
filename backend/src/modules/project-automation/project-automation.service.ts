import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RoleTemplateService } from './services/role-template.service';
import { GoalTemplateService } from './services/goal-template.service';
import { TaskPlannerService } from './services/task-planner.service';
import { ChiefOfStaffService } from './services/chief-of-staff.service';
import { MemorySeederService } from './services/memory-seeder.service';
import {
  PROJECT_AUTOMATION_REPOSITORY,
  type IProjectAutomationRepository,
  type ProjectAutomationLog,
} from './interfaces';

export interface AutomationResult {
  agentsSpawned: number;
  goalsCreated: number;
  tasksCreated: number;
  chiefOfStaffAssigned: boolean;
  memorySeeded: boolean;
  logId: string;
  errors: string[];
}

@Injectable()
export class ProjectAutomationService {
  private readonly logger = new Logger(ProjectAutomationService.name);

  constructor(
    private readonly roleTemplateService: RoleTemplateService,
    private readonly goalTemplateService: GoalTemplateService,
    private readonly taskPlannerService: TaskPlannerService,
    private readonly chiefOfStaffService: ChiefOfStaffService,
    private readonly memorySeederService: MemorySeederService,
    @Inject(PROJECT_AUTOMATION_REPOSITORY)
    private readonly automationRepo: IProjectAutomationRepository,
    private readonly prisma: PrismaService,
  ) {}

  async onProjectCreated(
    projectId: string,
    projectTypeId: string,
    projectName: string,
    tenantId: string,
    actorId: string = 'SYSTEM',
  ): Promise<AutomationResult> {
    const log = await this.automationRepo.create({
      projectId,
      event: 'PROJECT_CREATED',
      triggeredBy: actorId,
    });

    const errors: string[] = [];

    try {
      const roleResult = await this.roleTemplateService.spawnAgentsFromTemplate(
        projectId,
        projectTypeId,
        tenantId,
        actorId,
      );

      const cosResult = await this.chiefOfStaffService.autoAssign(
        projectId,
        tenantId,
        actorId,
      );

      const goalResult = await this.goalTemplateService.createGoalsFromTemplate(
        projectId,
        projectTypeId,
        tenantId,
      );

      let tasksCreated = 0;
      if (goalResult.goals.length > 0) {
        const taskResult = await this.taskPlannerService.decomposeAll(
          goalResult.goals,
          roleResult.spawned,
          tenantId,
          actorId,
        );
        tasksCreated = taskResult.totalTasks;
      }

      const memoryResult = await this.memorySeederService.seedInitialMemory(
        projectId,
        tenantId,
        projectName,
      );

      const result: AutomationResult = {
        agentsSpawned: roleResult.spawned.length,
        goalsCreated: goalResult.goals.length,
        tasksCreated,
        chiefOfStaffAssigned: cosResult.assigned,
        memorySeeded: memoryResult.seeded,
        logId: log.id,
        errors: [
          ...roleResult.errors,
          ...goalResult.errors,
          cosResult.error ? [cosResult.error] : [],
          memoryResult.error ? [memoryResult.error] : [],
        ].flat(),
      };

      await this.automationRepo.updateResult(log.id, result as unknown as Record<string, unknown>);
      this.logger.log(
        `Automation complete for project ${projectId}: ` +
          `${result.agentsSpawned} agents, ${result.goalsCreated} goals, ` +
          `${result.tasksCreated} tasks, CoS=${result.chiefOfStaffAssigned}`,
      );

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Automation failed for project ${projectId}: ${msg}`);
      errors.push(msg);
      await this.automationRepo.updateError(log.id, msg);

      await this.automationRepo.updateResult(log.id, {
        agentsSpawned: 0,
        goalsCreated: 0,
        tasksCreated: 0,
        chiefOfStaffAssigned: false,
        memorySeeded: false,
        logId: log.id,
        errors,
      } as unknown as Record<string, unknown>);

      return {
        agentsSpawned: 0,
        goalsCreated: 0,
        tasksCreated: 0,
        chiefOfStaffAssigned: false,
        memorySeeded: false,
        logId: log.id,
        errors,
      };
    }
  }

  async getLatestAutomation(projectId: string): Promise<ProjectAutomationLog | null> {
    return this.automationRepo.findLatest(projectId);
  }

  async getAutomationHistory(projectId: string): Promise<ProjectAutomationLog[]> {
    return this.automationRepo.findByProjectId(projectId);
  }

  async replan(projectId: string, tenantId: string, actorId: string = 'SYSTEM'): Promise<AutomationResult> {
    const log = await this.automationRepo.create({
      projectId,
      event: 'MANUAL_TRIGGER',
      triggeredBy: actorId,
    });

    const errors: string[] = [];
    let tasksCreated = 0;
    let goalsProcessed = 0;

    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, projectTypeId: true },
      });

      if (!project) {
        errors.push(`Project ${projectId} not found`);
      } else if (!project.projectTypeId) {
        errors.push('Project has no projectTypeId — cannot replan');
      } else {
        const goalsResult = await this.goalTemplateService.createGoalsFromTemplate(
          projectId,
          project.projectTypeId,
          tenantId,
        );
        goalsProcessed = goalsResult.goals.length;

        const existingMembers = await this.prisma.projectMember.findMany({
          where: { projectId, actorType: 'AI' },
          select: { actorId: true },
        });
        const spawnedAgents = existingMembers.map((m) => ({ id: m.actorId } as never));

        if (goalsResult.goals.length > 0) {
          const taskResult = await this.taskPlannerService.decomposeAll(
            goalsResult.goals,
            spawnedAgents as never,
            tenantId,
            actorId,
          );
          tasksCreated = taskResult.totalTasks;
          errors.push(...taskResult.results.flatMap((r) => r.errors));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Replan failed for project ${projectId}: ${msg}`);
      errors.push(msg);
    }

    const result: AutomationResult = {
      agentsSpawned: 0,
      goalsCreated: goalsProcessed,
      tasksCreated,
      chiefOfStaffAssigned: false,
      memorySeeded: false,
      logId: log.id,
      errors,
    };

    await this.automationRepo.updateResult(log.id, result as unknown as Record<string, unknown>);
    return result;
  }
}
