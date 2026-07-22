/**
 * Default Approval Addon
 *
 * Stage 2 Phase 2A: Fallback approval escalation chains for industries
 * without a specific addon. Provides basic Manager → Director routing.
 *
 * SOLID: SRP — handles default/fallback behavior. LSP — implements ApprovalAddon.
 */

import { Injectable } from '@nestjs/common';
import type { ApprovalAddon, ApprovalRoute } from './approval-addon.interface';

@Injectable()
export class DefaultApprovalAddon implements ApprovalAddon {
  readonly industrySlugs = ['special-purpose-organizations'];

  async getRoutes(_tenantId: string): Promise<ApprovalRoute[]> {
    return [
      {
        slug: 'standard-approval',
        label: 'Standard Approval Chain',
        description: 'Default two-stage approval: Manager → Director.',
        stages: [
          { role: 'Manager', order: 1, action: 'review' },
          { role: 'Director', order: 2, action: 'approve' },
        ],
        triggers: [{ event: 'approval.requested' }],
      },
      {
        slug: 'budget-approval',
        label: 'Budget Approval (>$5,000)',
        description: 'Default budget approval for expenses exceeding $5,000.',
        stages: [
          { role: 'Manager', order: 1, action: 'review' },
          { role: 'FinanceDirector', order: 2, action: 'approve' },
          { role: 'Director', order: 3, action: 'sign-off' },
        ],
        triggers: [
          {
            event: 'budget.requested',
            conditions: { amount: { gt: 5000 } },
          },
        ],
      },
      {
        slug: 'compliance-review',
        label: 'Compliance Review',
        description: 'Default compliance review chain.',
        stages: [
          { role: 'ComplianceOfficer', order: 1, action: 'verify' },
          { role: 'Director', order: 2, action: 'approve' },
        ],
        triggers: [{ event: 'compliance.review.requested' }],
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
