/**
 * ProjectStages — Interface Definitions
 */

export type StageStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'AT_RISK'
  | 'COMPLETED'
  | 'SKIPPED';

export interface ProjectStage {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  order: number;
  status: StageStatus;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStageInput {
  name: string;
  description?: string;
  order: number;
  status?: StageStatus;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

export interface UpdateStageInput {
  name?: string;
  description?: string;
  status?: StageStatus;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

export interface IProjectStageRepository {
  listForProject(projectId: string): Promise<ProjectStage[]>;
  createBulk(
    projectId: string,
    stages: CreateStageInput[],
  ): Promise<ProjectStage[]>;
  create(projectId: string, dto: CreateStageInput): Promise<ProjectStage>;
  update(
    projectId: string,
    stageId: string,
    dto: UpdateStageInput,
  ): Promise<ProjectStage>;
  delete(projectId: string, stageId: string): Promise<void>;
  /**
   * Reorder stages. `orderedIds` MUST be exactly the set of stage ids belonging
   * to `projectId` — duplicates are silently deduplicated by the repo.
   * Repository must validate membership and reject if the set differs.
   */
  reorder(projectId: string, orderedIds: string[]): Promise<ProjectStage[]>;
  /** Returns true if a stage with this id exists for the project. */
  existsForProject(projectId: string, stageId: string): Promise<boolean>;
}

export const PROJECT_STAGE_REPOSITORY = 'PROJECT_STAGE_REPOSITORY';
