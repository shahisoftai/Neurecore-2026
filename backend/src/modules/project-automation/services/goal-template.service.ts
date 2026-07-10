import { Injectable, Logger } from '@nestjs/common';
import { GoalsService } from '../../goals/goals.service';
import { ProjectTypesService } from '../../project-types/project-types.service';
import type { Goal } from '../../goals/interfaces/goal.interface';

export interface GoalTemplateEntry {
  title: string;
  measurableCriteria?: string;
}

export interface CreateGoalsResult {
  goals: Goal[];
  skipped: string[];
  errors: string[];
}

@Injectable()
export class GoalTemplateService {
  private readonly logger = new Logger(GoalTemplateService.name);

  constructor(
    private readonly goalsService: GoalsService,
    private readonly projectTypesService: ProjectTypesService,
  ) {}

  async createGoalsFromTemplate(
    projectId: string,
    projectTypeId: string,
    tenantId: string,
  ): Promise<CreateGoalsResult> {
    const version = await this.projectTypesService.getCurrentVersion(
      projectTypeId,
      tenantId,
    );

    const result: CreateGoalsResult = { goals: [], skipped: [], errors: [] };

    if (!version || !version.goalTemplate || (version.goalTemplate as unknown[]).length === 0) {
      this.logger.debug(`No goalTemplate found for projectType ${projectTypeId} — skipping goal creation`);
      return result;
    }

    const goalEntries = version.goalTemplate as GoalTemplateEntry[];

    for (const entry of goalEntries) {
      if (!entry.title || !entry.title.trim()) {
        result.skipped.push(`(empty title entry)`);
        continue;
      }

      try {
        const goal = await this.goalsService.create(
          {
            title: entry.title.trim(),
            description: entry.measurableCriteria ?? undefined,
            projectId,
          },
          tenantId,
        );

        result.goals.push(goal);
        this.logger.debug(`Created goal "${goal.title}" (${goal.id}) for project ${projectId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to create goal "${entry.title}": ${msg}`);
        result.errors.push(`${entry.title}: ${msg}`);
      }
    }

    return result;
  }
}
