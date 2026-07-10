import { Injectable, Logger, Inject } from '@nestjs/common';
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

  async replan(projectId: string, tenantId: string): Promise<AutomationResult> {
    const log = await this.automationRepo.create({
      projectId,
      event: 'REPLAN',
      triggeredBy: 'SYSTEM',
    });

    return {
      agentsSpawned: 0,
      goalsCreated: 0,
      tasksCreated: 0,
      chiefOfStaffAssigned: false,
      memorySeeded: false,
      logId: log.id,
      errors: ['Replan not yet implemented'],
    };
  }
}
