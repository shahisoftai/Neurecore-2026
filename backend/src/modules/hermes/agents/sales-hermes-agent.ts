import { Injectable, Logger } from '@nestjs/common';
import { HermesRegistryService } from '../services/hermes-registry.service';
import { HermesAgentType } from '@prisma/client';
import type { HermesAgentDescriptor } from '../interfaces/hermes-agent.interface';

export const SALES_CAPABILITIES = [
  {
    name: 'lead_qualification',
    description: 'Qualify leads based on ICP criteria and budget fit',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string' },
        company: { type: 'string' },
        estimatedBudget: { type: 'number' },
      },
      required: ['leadId', 'company'],
    },
    costEstimate: 0.03,
    avgDuration: 5000,
  },
  {
    name: 'outreach_compose',
    description: 'Generate personalized cold outreach messages',
    inputSchema: {
      type: 'object',
      properties: {
        prospectName: { type: 'string' },
        company: { type: 'string' },
        trigger: { type: 'string' },
        channel: { type: 'string' },
      },
      required: ['prospectName', 'company'],
    },
    costEstimate: 0.02,
    avgDuration: 3000,
  },
  {
    name: 'deal_review',
    description: 'Review deal status and flag at-risk opportunities',
    inputSchema: {
      type: 'object',
      properties: {
        dealId: { type: 'string' },
        stage: { type: 'string' },
        daysInStage: { type: 'number' },
      },
      required: ['dealId', 'stage'],
    },
    costEstimate: 0.02,
    avgDuration: 4000,
  },
  {
    name: 'proposal_draft',
    description: 'Draft proposal sections based on deal context',
    inputSchema: {
      type: 'object',
      properties: {
        dealId: { type: 'string' },
        section: { type: 'string' },
      },
      required: ['dealId'],
    },
    costEstimate: 0.05,
    avgDuration: 12000,
  },
  {
    name: 'pipeline_forecast',
    description: 'Generate pipeline forecast and revenue projections',
    inputSchema: {
      type: 'object',
      properties: {
        quarter: { type: 'string' },
        teamId: { type: 'string' },
      },
      required: ['quarter'],
    },
    costEstimate: 0.04,
    avgDuration: 8000,
  },
];

export const SALES_TOOL_PERMISSIONS: Array<{
  toolName: string;
  permission: string;
  conditions?: Record<string, unknown>;
}> = [
  { toolName: 'read_lead', permission: 'ALLOW' },
  { toolName: 'read_deal', permission: 'ALLOW' },
  { toolName: 'read_contact', permission: 'ALLOW' },
  { toolName: 'create_task', permission: 'ALLOW' },
  { toolName: 'send_email', permission: 'ALLOW' },
  { toolName: 'read_report', permission: 'ALLOW' },
  { toolName: 'send_notification', permission: 'ALLOW' },
  { toolName: 'web_search', permission: 'READ_ONLY' },
];

const SALES_SYSTEM_PROMPT = `You are SalesHermes, a specialized B2B sales AI agent.

Your core responsibilities:
- Lead qualification: score and qualify leads based on ICP fit and budget
- Outreach personalization: craft personalized cold emails and LinkedIn messages
- Deal management: track deal health, flag at-risk opportunities, suggest next actions
- Proposal drafting: generate tailored proposal sections based on deal context
- Pipeline forecasting: project revenue and identify pipeline gaps

Operational guidelines:
1. Always personalize outreach — never send generic templates without customization
2. Lead with value for the prospect, not the product you're selling
3. Track every touch and response in the CRM
4. Know when to disqualify a lead — qualify hard, not soft
5. Escalate complex pricing and contract negotiations to human sales managers

Follow-up cadence: touch 1 (day 1), touch 2 (day 3 LinkedIn), touch 3 (day 5 email), touch 4 (day 8 LinkedIn), touch 5 (day 12 call), touch 6 (day 17 content), touch 7 (day 21 breakup).

You represent the sales organization. Be consultative, not pushy. Ask questions before presenting solutions.`;

@Injectable()
export class SalesHermesAgentFactory {
  private readonly logger = new Logger(SalesHermesAgentFactory.name);

  constructor(private readonly registry: HermesRegistryService) {}

  async createSalesAgent(
    tenantId: string,
    workspaceId: string,
    config?: { name?: string; model?: string },
  ): Promise<HermesAgentDescriptor> {
    const agent = await this.registry.register(
      {
        name: config?.name ?? 'SalesHermes',
        type: HermesAgentType.SALES,
        description:
          'Specialized sales agent for lead qualification, outreach personalization, and deal management',
        model: config?.model ?? 'mini-max',
        systemPrompt: SALES_SYSTEM_PROMPT,
        permissions: [
          'lead:read',
          'lead:qualify',
          'deal:read',
          'deal:update',
          'contact:read',
          'task:create',
          'email:send',
          'report:read',
          'notification:send',
        ],
        allowedPaths: ['/sales', '/leads', '/deals', '/pipeline'],
        blockedPaths: ['/sales/compensation', '/sales/quotas'],
        maxFileSize: 5 * 1024 * 1024,
        config: { ...config },
        workspaceId,
        isActive: true,
      },
      tenantId,
    );

    for (const cap of SALES_CAPABILITIES) {
      await this.registry.addCapability(
        agent.id,
        {
          name: cap.name,
          description: cap.description,
          inputSchema: cap.inputSchema,
          costEstimate: cap.costEstimate,
          avgDuration: cap.avgDuration,
        },
        tenantId,
      );
    }

    await this.registry.setToolPermissions(
      agent.id,
      SALES_TOOL_PERMISSIONS,
      tenantId,
    );

    this.logger.log(
      `[SalesHermesAgent] Created agent ${agent.id} for tenant ${tenantId}`,
    );
    return agent;
  }

  async findSalesAgent(
    tenantId: string,
  ): Promise<HermesAgentDescriptor | null> {
    const agents = await this.registry.findByType(
      HermesAgentType.SALES,
      tenantId,
    );
    return agents[0] ?? null;
  }

  async ensureSalesAgent(
    tenantId: string,
    workspaceId: string,
    config?: { name?: string; model?: string },
  ): Promise<HermesAgentDescriptor> {
    const existing = await this.findSalesAgent(tenantId);
    if (existing) return existing;
    return this.createSalesAgent(tenantId, workspaceId, config);
  }
}
