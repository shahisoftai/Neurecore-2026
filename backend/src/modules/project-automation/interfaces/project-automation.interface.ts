import { AutomationEventType, AutomationStatus, Prisma } from '@prisma/client';

export const PROJECT_AUTOMATION_REPOSITORY = 'PROJECT_AUTOMATION_REPOSITORY';

export interface ProjectAutomationLog {
  id: string;
  projectId: string;
  event: AutomationEventType;
  status: AutomationStatus;
  result: Prisma.JsonValue;
  error: string | null;
  triggeredBy: string | null;
  createdAt: Date;
}

export interface CreateAutomationLogInput {
  projectId: string;
  event: AutomationEventType;
  triggeredBy?: string;
}

export interface IProjectAutomationRepository {
  create(input: CreateAutomationLogInput): Promise<ProjectAutomationLog>;
  updateResult(id: string, result: Record<string, unknown>): Promise<ProjectAutomationLog>;
  updateError(id: string, error: string): Promise<ProjectAutomationLog>;
  findByProjectId(projectId: string): Promise<ProjectAutomationLog[]>;
  findLatest(projectId: string): Promise<ProjectAutomationLog | null>;
}
