/**
 * Compliance Module — Interface Definitions
 *
 * Stage 2 Phase 2A: Compliance checklist engine.
 *
 * SOLID: ISP (focused contracts), DIP (services depend on interfaces).
 * Each industry group gets its own checklist definition.
 */

export type ChecklistFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'annual';

export type ChecklistItemStatus =
  | 'PASS'
  | 'FAIL'
  | 'PENDING'
  | 'NOT_APPLICABLE';

export interface ChecklistConditionData {
  kycCurrentRate?: number;
  amlTrainingRate?: number;
  regFilingsOnTime?: boolean;
  hipaaTrainingRate?: number;
  openBreaches?: number;
  lastAccessAuditDays?: number;
  outstandingFindingsCount?: number;
  documentsUpToDate?: boolean;
  riskAssessmentCompleted?: boolean;
  staffComplianceTrainingRate?: number;
  auditReadinessScore?: number;
  regulatoryUpdatesReviewed?: boolean;
  dataBreachesReported?: number;
  incidentResponseTime?: number;
  policyReviewCurrent?: boolean;
  thirdPartyRiskAssessed?: boolean;
  insurancePoliciesCurrent?: boolean;
  licenseRenewalUpToDate?: boolean;
  slasMet?: boolean;
  soc2Compliant?: boolean;
  iso27001Certified?: boolean;
  gdprComplianceVerified?: boolean;
  pciDssCompliant?: boolean;
  taxFilingsCurrent?: boolean;
  payrollCompliance?: boolean;
  workersCompInsured?: boolean;
  safetyInspectionsCompleted?: boolean;
  environmentalPermitsCurrent?: boolean;
  qualityControlPassRate?: number;
  inventoryAccuracy?: number;
  patientSatisfactionScore?: number;
  noShowRate?: number;
  clinicalTrialCompliance?: boolean;
  grantReportingCurrent?: boolean;
  volunteerClearanceRate?: number;
  curriculumAccreditationCurrent?: boolean;
  foodSafetyInspections?: boolean;
  organicCertificationCurrent?: boolean;
  livestockHealthChecks?: boolean;
}

export interface ChecklistItemDef {
  id: string;
  label: string;
  description?: string;
  frequency: ChecklistFrequency;
  condition: (data: ChecklistConditionData) => boolean;
  remediation?: string;
}

export interface ComplianceChecklistDef {
  industryGroup: string;
  items: ChecklistItemDef[];
}

export interface ComplianceChecklistItem {
  id: string;
  label: string;
  description?: string;
  frequency: ChecklistFrequency;
  status: ChecklistItemStatus;
  remediation?: string;
}

export interface ComplianceChecklist {
  industryGroup: string;
  industrySlug?: string;
  items: ComplianceChecklistItem[];
  summary: {
    total: number;
    pass: number;
    fail: number;
    pending: number;
    notApplicable: number;
    complianceScore: number;
  };
  lastUpdated: Date;
}

export interface ComplianceChecklistQuery {
  tenantId: string;
  industryGroup: string;
  industrySlug?: string;
}

export const COMPLIANCE_SERVICE = 'COMPLIANCE_SERVICE';

export interface IComplianceService {
  getChecklist(
    tenantId: string,
    industryGroup: string,
    industrySlug?: string,
  ): Promise<ComplianceChecklist>;
  getChecklistsForAllGroups(tenantId: string): Promise<ComplianceChecklist[]>;
  evaluateComplianceScore(
    tenantId: string,
    industryGroup: string,
  ): Promise<number>;
}

export interface CustomerStageCount {
  stage: string;
  count: number;
}
