/**
 * Industrial & Infrastructure Approval Addon
 *
 * Stage 2 Phase 2A: Industrial/Infrastructure-specific approval escalation chains.
 *
 * SOLID: SRP — handles ONLY industrial & infrastructure industry overrides.
 */

import { Injectable } from '@nestjs/common';
import type { ApprovalAddon, ApprovalRoute } from './approval-addon.interface';

@Injectable()
export class IndustrialInfraApprovalAddon implements ApprovalAddon {
  readonly industrySlugs = [
    'manufacturing-industrial',
    'construction-engineering-infrastructure',
    'energy-utilities-natural-resources',
    'logistics-transportation-supply-chain',
  ];

  async getRoutes(_tenantId: string): Promise<ApprovalRoute[]> {
    return [
      {
        slug: 'safety-incident',
        label: 'Safety Incident Investigation Approval',
        description:
          'Approval chain for workplace safety incident investigations.',
        stages: [
          { role: 'SafetyOfficer', order: 1, action: 'assess' },
          { role: 'SiteManager', order: 2, action: 'review' },
          { role: 'OperationsDirector', order: 3, action: 'approve' },
          { role: 'LegalCounsel', order: 4, action: 'sign-off' },
        ],
        triggers: [{ event: 'safety.incident.reported' }],
      },
      {
        slug: 'capital-expenditure',
        label: 'Capital Expenditure Approval (>$50,000)',
        description:
          'Approval chain for capital expenditures exceeding $50,000.',
        stages: [
          { role: 'ProjectManager', order: 1, action: 'review' },
          { role: 'FinanceManager', order: 2, action: 'assess' },
          { role: 'OperationsDirector', order: 3, action: 'approve' },
          { role: 'CFO', order: 4, action: 'sign-off' },
        ],
        triggers: [
          {
            event: 'capex.requested',
            conditions: { amount: { gt: 50000 } },
          },
        ],
      },
      {
        slug: 'environmental-permit',
        label: 'Environmental Permit Deviation',
        description:
          'Escalation chain when operations deviate from environmental permit conditions.',
        stages: [
          { role: 'EnvironmentalOfficer', order: 1, action: 'assess' },
          { role: 'ComplianceManager', order: 2, action: 'review' },
          { role: 'OperationsDirector', order: 3, action: 'approve' },
          { role: 'LegalCounsel', order: 4, action: 'sign-off' },
        ],
        triggers: [{ event: 'environmental.deviation.detected' }],
      },
      {
        slug: 'work-order',
        label: 'Emergency Work Order Approval',
        description:
          'Fast-track approval for emergency maintenance and repair work orders.',
        stages: [
          { role: 'MaintenanceSupervisor', order: 1, action: 'assess' },
          { role: 'OperationsManager', order: 2, action: 'approve' },
        ],
        triggers: [{ event: 'workorder.emergency.created' }],
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
