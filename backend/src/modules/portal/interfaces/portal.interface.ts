import type { Project, Customer, CustomerContact, Deliverable, ProjectStage } from '@prisma/client';

export const DOCUMENT_VISIBILITY = {
  CLIENT: 'CLIENT',
  INTERNAL: 'INTERNAL',
} as const;
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITY)[keyof typeof DOCUMENT_VISIBILITY];

export const DELIVERABLE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export interface PortalDeliverable {
  id: string;
  name: string;
  description: string | null;
  status: string;
  clientFacing: boolean;
  createdAt: Date;
  latestVersion: {
    version: number;
    summary: string | null;
    createdAt: Date;
  } | null;
}

export interface PortalStage {
  id: string;
  name: string;
  status: string;
  order: number;
}

export interface PortalProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  customerName: string | null;
  targetDate: Date | null;
  startDate: Date | null;
  budgetType: string | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  stages: PortalStage[];
  deliverables: PortalDeliverable[];
}

export interface PortalTokenPayload {
  contactId: string;
  projectId: string;
  email: string;
  exp: number;
}

export interface IPortalRepository {
  findProjectForPortal(
    projectId: string,
    contactId: string,
  ): Promise<PortalProject | null>;

  validatePortalToken(
    contactId: string,
    token: string,
  ): Promise<CustomerContact | null>;

  createPortalToken(contactId: string, projectId: string): Promise<string>;
}
