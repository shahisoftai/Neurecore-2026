export type ProjectEventType =
  | 'TaskCompleted'
  | 'TaskCreated'
  | 'GoalAchieved'
  | 'GoalProgressUpdated'
  | 'StageCompleted'
  | 'HealthScoreDropped'
  | 'HealthScoreImproved'
  | 'InformationGapsFound'
  | 'AgentSpawned'
  | 'DeliverableSubmitted'
  | 'ApprovalGranted'
  | 'ApprovalRejected';

export interface DomainEvent<T = unknown> {
  type: ProjectEventType;
  projectId: string;
  tenantId: string;
  timestamp: Date;
  payload: T;
}

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => void | Promise<void>;
