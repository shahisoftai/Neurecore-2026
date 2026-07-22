/**
 * Agriculture & Food Approval Addon
 *
 * Stage 2 Phase 2A: Agriculture/Food-specific approval escalation chains.
 *
 * SOLID: SRP — handles ONLY agriculture & food industry overrides.
 */

import { Injectable } from '@nestjs/common';
import type { ApprovalAddon, ApprovalRoute } from './approval-addon.interface';

@Injectable()
export class AgricultureFoodApprovalAddon implements ApprovalAddon {
  readonly industrySlugs = ['agriculture-food-systems'];

  async getRoutes(_tenantId: string): Promise<ApprovalRoute[]> {
    return [
      {
        slug: 'pesticide-application',
        label: 'Pesticide Application Approval',
        description: 'Approval chain for pesticide and chemical applications.',
        stages: [
          { role: 'FarmManager', order: 1, action: 'assess' },
          { role: 'Agronomist', order: 2, action: 'review' },
          { role: 'ComplianceOfficer', order: 3, action: 'approve' },
        ],
        triggers: [{ event: 'pesticide.application.requested' }],
      },
      {
        slug: 'livestock-treatment',
        label: 'Livestock Treatment Authorization',
        description: 'Approval chain for livestock medical treatments.',
        stages: [
          { role: 'LivestockSpecialist', order: 1, action: 'assess' },
          { role: 'Veterinarian', order: 2, action: 'approve' },
          { role: 'FarmManager', order: 3, action: 'sign-off' },
        ],
        triggers: [{ event: 'livestock.treatment.requested' }],
      },
      {
        slug: 'harvest-schedule',
        label: 'Harvest Schedule Change Approval',
        description:
          'Approval chain for significant harvest schedule deviations.',
        stages: [
          { role: 'HarvestCoordinator', order: 1, action: 'assess' },
          { role: 'OperationsManager', order: 2, action: 'approve' },
          { role: 'FarmManager', order: 3, action: 'sign-off' },
        ],
        triggers: [{ event: 'harvest.schedule.changed' }],
      },
      {
        slug: 'recall-decision',
        label: 'Product Recall Decision',
        description: 'Approval chain for food product recall decisions.',
        stages: [
          { role: 'QualityManager', order: 1, action: 'assess' },
          { role: 'OperationsDirector', order: 2, action: 'approve' },
          { role: 'LegalCounsel', order: 3, action: 'sign-off' },
        ],
        triggers: [{ event: 'product.recall.triggered' }],
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
