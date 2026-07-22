/**
 * Public & Social Approval Addon
 *
 * Stage 2 Phase 2A: Public/Social-specific approval escalation chains.
 *
 * SOLID: SRP — handles ONLY public & social industry overrides.
 */

import { Injectable } from '@nestjs/common';
import type { ApprovalAddon, ApprovalRoute } from './approval-addon.interface';

@Injectable()
export class PublicSocialApprovalAddon implements ApprovalAddon {
  readonly industrySlugs = [
    'government-public-sector',
    'education-research',
    'nonprofit-international',
  ];

  async getRoutes(_tenantId: string): Promise<ApprovalRoute[]> {
    return [
      {
        slug: 'grant-proposal',
        label: 'Grant Proposal Approval',
        description: 'Approval chain for grant proposal submissions.',
        stages: [
          { role: 'ProgramManager', order: 1, action: 'review' },
          { role: 'FinanceManager', order: 2, action: 'assess' },
          { role: 'ExecutiveDirector', order: 3, action: 'approve' },
          { role: 'BoardChair', order: 4, action: 'sign-off' },
        ],
        triggers: [{ event: 'grant.proposal.created' }],
      },
      {
        slug: 'public-disclosure',
        label: 'Public Disclosure Approval',
        description:
          'Approval chain for public information releases and disclosures.',
        stages: [
          { role: 'CommunicationsManager', order: 1, action: 'review' },
          { role: 'LegalCounsel', order: 2, action: 'assess' },
          { role: 'ExecutiveDirector', order: 3, action: 'approve' },
        ],
        triggers: [{ event: 'public.disclosure.requested' }],
      },
      {
        slug: 'procurement',
        label: 'Procurement Approval (>$10,000)',
        description: 'Approval chain for procurement exceeding $10,000.',
        stages: [
          { role: 'ProcurementOfficer', order: 1, action: 'verify' },
          { role: 'FinanceManager', order: 2, action: 'review' },
          { role: 'ExecutiveDirector', order: 3, action: 'approve' },
        ],
        triggers: [
          {
            event: 'procurement.requested',
            conditions: { amount: { gt: 10000 } },
          },
        ],
      },
      {
        slug: 'volunteer-onboarding',
        label: 'Volunteer Onboarding Approval',
        description:
          'Approval chain for volunteer onboarding requiring background checks.',
        stages: [
          { role: 'VolunteerCoordinator', order: 1, action: 'verify' },
          { role: 'HRManager', order: 2, action: 'approve' },
        ],
        triggers: [{ event: 'volunteer.application.approved' }],
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
