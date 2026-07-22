/**
 * Consumer & Commerce Approval Addon
 *
 * Stage 2 Phase 2A: Consumer/Commerce-specific approval escalation chains.
 *
 * SOLID: SRP — handles ONLY consumer & commerce industry overrides.
 */

import { Injectable } from '@nestjs/common';
import type { ApprovalAddon, ApprovalRoute } from './approval-addon.interface';

@Injectable()
export class ConsumerCommerceApprovalAddon implements ApprovalAddon {
  readonly industrySlugs = [
    'retail-commerce-consumer',
    'media-communications-creative',
  ];

  async getRoutes(_tenantId: string): Promise<ApprovalRoute[]> {
    return [
      {
        slug: 'inventory-writeoff',
        label: 'Inventory Write-Off Approval (>$5,000)',
        description:
          'Approval chain for inventory write-offs exceeding $5,000.',
        stages: [
          { role: 'StoreManager', order: 1, action: 'verify' },
          { role: 'InventoryManager', order: 2, action: 'review' },
          { role: 'FinanceDirector', order: 3, action: 'approve' },
        ],
        triggers: [
          {
            event: 'inventory.writeoff.requested',
            conditions: { amount: { gt: 5000 } },
          },
        ],
      },
      {
        slug: 'campaign-budget',
        label: 'Campaign Budget Approval (>$10,000)',
        description:
          'Approval chain for marketing campaign budgets exceeding $10,000.',
        stages: [
          { role: 'MarketingManager', order: 1, action: 'review' },
          { role: 'Director', order: 2, action: 'approve' },
          { role: 'CMO', order: 3, action: 'sign-off' },
        ],
        triggers: [
          {
            event: 'campaign.budget.requested',
            conditions: { amount: { gt: 10000 } },
          },
        ],
      },
      {
        slug: 'refund-exception',
        label: 'Refund Exception Approval',
        description:
          'Escalation for refund requests that exceed policy limits.',
        stages: [
          { role: 'CustomerServiceManager', order: 1, action: 'review' },
          { role: 'FinanceManager', order: 2, action: 'approve' },
          { role: 'Director', order: 3, action: 'sign-off' },
        ],
        triggers: [{ event: 'refund.exception.requested' }],
      },
      {
        slug: 'creative-asset',
        label: 'Creative Asset Approval',
        description: 'Approval chain for final creative asset sign-off.',
        stages: [
          { role: 'CreativeLead', order: 1, action: 'review' },
          { role: 'CreativeDirector', order: 2, action: 'approve' },
          { role: 'LegalReview', order: 3, action: 'sign-off' },
        ],
        triggers: [{ event: 'creative.asset.finalized' }],
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
