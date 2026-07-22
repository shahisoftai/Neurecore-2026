/**
 * Healthcare & Life Sciences Approval Addon
 *
 * Stage 2 Phase 2A: Healthcare-specific approval escalation chains.
 *
 * SOLID: SRP — handles ONLY healthcare industry overrides.
 */

import { Injectable } from '@nestjs/common';
import type { ApprovalAddon, ApprovalRoute } from './approval-addon.interface';

@Injectable()
export class HealthcareApprovalAddon implements ApprovalAddon {
  readonly industrySlugs = ['healthcare-life-sciences'];

  async getRoutes(_tenantId: string): Promise<ApprovalRoute[]> {
    return [
      {
        slug: 'patient-record-access',
        label: 'Patient Record Access Approval',
        description:
          'Approval chain for accessing sensitive patient records beyond routine care.',
        stages: [
          { role: 'Clinician', order: 1, action: 'verify' },
          { role: 'ChiefMedical', order: 2, action: 'approve' },
          { role: 'ComplianceOfficer', order: 3, action: 'sign-off' },
        ],
        triggers: [{ event: 'patient.record.access.requested' }],
      },
      {
        slug: 'clinical-trial-protocol',
        label: 'Clinical Trial Protocol Approval',
        description: 'Multi-stage approval for new clinical trial protocols.',
        stages: [
          { role: 'PrincipalInvestigator', order: 1, action: 'review' },
          { role: 'IRBCommittee', order: 2, action: 'approve' },
          { role: 'ChiefMedical', order: 3, action: 'sign-off' },
        ],
        triggers: [{ event: 'clinical.trial.protocol.created' }],
      },
      {
        slug: 'high-cost-treatment',
        label: 'High-Cost Treatment Authorization',
        description:
          'Authorization chain for treatments exceeding cost thresholds.',
        stages: [
          { role: 'Clinician', order: 1, action: 'assess' },
          { role: 'MedicalReview', order: 2, action: 'review' },
          { role: 'ChiefMedical', order: 3, action: 'approve' },
          { role: 'ComplianceOfficer', order: 4, action: 'sign-off' },
        ],
        triggers: [
          {
            event: 'treatment.authorization.requested',
            conditions: { amount: { gt: 10000 } },
          },
        ],
      },
      {
        slug: 'breach-notification',
        label: 'Data Breach Notification Approval',
        description: 'Escalation chain for PHI breach notifications.',
        stages: [
          { role: 'PrivacyOfficer', order: 1, action: 'assess' },
          { role: 'ComplianceOfficer', order: 2, action: 'review' },
          { role: 'ChiefMedical', order: 3, action: 'approve' },
          { role: 'LegalCounsel', order: 4, action: 'sign-off' },
        ],
        triggers: [{ event: 'security.breach.detected' }],
      },
    ];
  }

  async getRoutesForEvent(
    _tenantId: string,
    event: string,
  ): Promise<ApprovalRoute[]> {
    const routes = await this.getRoutes(_tenantId);
    return routes.filter((r) => r.triggers.some((t) => t.event === event));
  }
}
