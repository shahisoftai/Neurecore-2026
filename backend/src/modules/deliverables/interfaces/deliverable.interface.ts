/**
 * Deliverables Module — Interface Definitions
 *
 * Following SOLID:
 * - Interface Segregation: focused interfaces for repository patterns
 * - Dependency Inversion: module depends on abstractions
 */

export type DeliverableStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH';

export type Deliverable = {
  id: string;
  projectId: string;
  taskId: string | null;
  goalId: string | null;
  name: string;
  description: string | null;
  status: DeliverableStatus;
  riskTier: RiskTier | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DeliverableVersion = {
  id: string;
  deliverableId: string;
  version: number;
  content: Record<string, unknown>;
  summary: string | null;
  producedBy: string | null;
  producedByTaskId: string | null;
  createdAt: Date;
};

export type DeliverableWithVersions = Deliverable & {
  versions: DeliverableVersion[];
};

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface CreateDeliverableInput {
  projectId: string;
  taskId?: string | null;
  goalId?: string | null;
  name: string;
  description?: string;
  status?: DeliverableStatus;
  riskTier?: RiskTier;
}

export interface UpdateDeliverableInput {
  name?: string;
  description?: string;
  status?: DeliverableStatus;
  riskTier?: RiskTier | null;
}

export interface CreateDeliverableVersionInput {
  content: Record<string, unknown>;
  summary?: string;
  producedBy?: string | null;
  producedByTaskId?: string | null;
}

export interface ListDeliverablesOptions {
  projectId?: string;
  goalId?: string;
  status?: DeliverableStatus;
  page?: number;
  limit?: number;
}

// ─── Repository Interface ─────────────────────────────────────────────────────

export interface IDeliverableRepository {
  create(data: CreateDeliverableInput): Promise<Deliverable>;
  findById(id: string, tenantId: string): Promise<Deliverable | null>;
  findAll(options: ListDeliverablesOptions, tenantId: string): Promise<{ data: Deliverable[]; total: number }>;
  update(id: string, tenantId: string, data: UpdateDeliverableInput): Promise<Deliverable>;
  delete(id: string, tenantId: string): Promise<void>;

  // Version operations
  createVersion(deliverableId: string, data: CreateDeliverableVersionInput): Promise<DeliverableVersion>;
  findVersionsByDeliverableId(deliverableId: string): Promise<DeliverableVersion[]>;
  getLatestVersion(deliverableId: string): Promise<DeliverableVersion | null>;
}

export const DELIVERABLE_REPOSITORY = 'DELIVERABLE_REPOSITORY';
