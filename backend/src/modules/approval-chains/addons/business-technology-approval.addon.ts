/**
 * Business & Technology Approval Addon
 *
 * Stage 2 Phase 2A: Business/Technology-specific approval escalation chains.
 *
 * SOLID: SRP — handles ONLY business & technology industry overrides.
 */

import { Injectable } from '@nestjs/common';
import type { ApprovalAddon, ApprovalRoute } from './approval-addon.interface';

@Injectable()
export class BusinessTechnologyApprovalAddon implements ApprovalAddon {
  readonly industrySlugs = [
    'technology-digital-services',
    'professional-business-services',
  ];

  async getRoutes(_tenantId: string): Promise<ApprovalRoute[]> {
    return [
      {
        slug: 'production-deployment',
        label: 'Production Deployment Approval',
        description: 'Change management approval for production deployments.',
        stages: [
          { role: 'TechLead', order: 1, action: 'review' },
          { role: 'EngineeringManager', order: 2, action: 'approve' },
          { role: 'CTO', order: 3, action: 'sign-off' },
        ],
        triggers: [{ event: 'deployment.production.requested' }],
      },
      {
        slug: 'client-proposal',
        label: 'Client Proposal Approval (>$25,000)',
        description: 'Approval chain for client proposals exceeding $25,000.',
        stages: [
          { role: 'ProjectManager', order: 1, action: 'review' },
          { role: 'Director', order: 2, action: 'approve' },
          { role: 'VP', order: 3, action: 'sign-off' },
        ],
        triggers: [
          {
            event: 'proposal.created',
            conditions: { amount: { gt: 25000 } },
          },
        ],
      },
      {
        slug: 'sla-breach',
        label: 'SLA Breach Escalation',
        description:
          'Escalation chain when SLA breach thresholds are exceeded.',
        stages: [
          { role: 'SupportLead', order: 1, action: 'assess' },
          { role: 'ServiceManager', order: 2, action: 'review' },
          { role: 'Director', order: 3, action: 'approve' },
        ],
        triggers: [{ event: 'sla.breach.detected' }],
      },
      {
        slug: 'security-incident',
        label: 'Security Incident Response',
        description: 'Approval chain for security incident response actions.',
        stages: [
          { role: 'SecurityEngineer', order: 1, action: 'assess' },
          { role: 'SecurityLead', order: 2, action: 'review' },
          { role: 'CTO', order: 3, action: 'sign-off' },
        ],
        triggers: [{ event: 'security.incident.detected' }],
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
