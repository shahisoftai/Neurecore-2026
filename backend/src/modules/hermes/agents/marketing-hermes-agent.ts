import { Injectable, Logger } from '@nestjs/common';
import { HermesRegistryService } from '../services/hermes-registry.service';
import { HermesAgentType } from '@prisma/client';
import type { HermesAgentDescriptor } from '../interfaces/hermes-agent.interface';

export const MARKETING_CAPABILITIES = [
  {
    name: 'campaign_planning',
    description: 'Create multi-channel campaign plans and timelines',
    inputSchema: {
      type: 'object',
      properties: {
        campaignGoal: { type: 'string' },
        targetAudience: { type: 'string' },
        channels: { type: 'array', items: { type: 'string' } },
      },
      required: ['campaignGoal', 'targetAudience'],
    },
    costEstimate: 0.05,
    avgDuration: 15000,
  },
  {
    name: 'content_generation',
    description:
      'Generate marketing content for blogs, emails, and social media',
    inputSchema: {
      type: 'object',
      properties: {
        contentType: { type: 'string' },
        topic: { type: 'string' },
        audience: { type: 'string' },
      },
      required: ['contentType', 'topic'],
    },
    costEstimate: 0.04,
    avgDuration: 10000,
  },
  {
    name: 'seo_analysis',
    description: 'Analyze keywords and provide SEO recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        pageUrl: { type: 'string' },
        targetKeywords: { type: 'array', items: { type: 'string' } },
      },
      required: ['pageUrl'],
    },
    costEstimate: 0.03,
    avgDuration: 8000,
  },
  {
    name: 'analytics_dashboard',
    description: 'Generate marketing analytics summaries and insights',
    inputSchema: {
      type: 'object',
      properties: {
        reportType: { type: 'string' },
        period: { type: 'string' },
        channels: { type: 'array', items: { type: 'string' } },
      },
      required: ['reportType', 'period'],
    },
    costEstimate: 0.03,
    avgDuration: 7000,
  },
  {
    name: 'social_media_scheduler',
    description: 'Plan and schedule social media posts across platforms',
    inputSchema: {
      type: 'object',
      properties: {
        platform: { type: 'string' },
        contentTopics: { type: 'array', items: { type: 'string' } },
        postCount: { type: 'number' },
      },
      required: ['platform', 'contentTopics'],
    },
    costEstimate: 0.02,
    avgDuration: 5000,
  },
];

export const MARKETING_TOOL_PERMISSIONS: Array<{
  toolName: string;
  permission: string;
  conditions?: Record<string, unknown>;
}> = [
  { toolName: 'read_campaign', permission: 'ALLOW' },
  { toolName: 'create_campaign', permission: 'ALLOW' },
  { toolName: 'read_content', permission: 'ALLOW' },
  { toolName: 'read_analytics', permission: 'ALLOW' },
  { toolName: 'send_notification', permission: 'ALLOW' },
  { toolName: 'web_search', permission: 'READ_ONLY' },
  { toolName: 'read_budget', permission: 'ALLOW' },
];

const MARKETING_SYSTEM_PROMPT = `You are MarketingHermes, a specialized marketing AI agent.

Your core responsibilities:
- Campaign planning: design multi-channel marketing campaigns across email, social, content, and paid media
- Content generation: create blog posts, email sequences, social media copy, and ad creative
- SEO analysis: identify keyword opportunities and recommend on-page optimizations
- Analytics: summarize marketing performance, identify trends, and provide actionable insights
- Social media: plan posting schedules and content themes across platforms

Operational guidelines:
1. Always align content with brand voice and guidelines
2. Respect marketing budget constraints — recommend cost-effective tactics first
3. Track campaign performance and optimize based on data
4. Ensure all content is truthful and compliant with advertising regulations
5. Coordinate with sales to align messaging and lead generation efforts

You represent the marketing organization. Be creative and data-driven. Every campaign should have measurable KPIs.`;

@Injectable()
export class MarketingHermesAgentFactory {
  private readonly logger = new Logger(MarketingHermesAgentFactory.name);

  constructor(private readonly registry: HermesRegistryService) {}

  async createMarketingAgent(
    tenantId: string,
    workspaceId: string,
    config?: { name?: string; model?: string },
  ): Promise<HermesAgentDescriptor> {
    const agent = await this.registry.register(
      {
        name: config?.name ?? 'MarketingHermes',
        type: HermesAgentType.MARKETING,
        description:
          'Specialized marketing agent for campaign planning, content generation, and analytics',
        model: config?.model ?? 'mini-max',
        systemPrompt: MARKETING_SYSTEM_PROMPT,
        permissions: [
          'campaign:read',
          'campaign:create',
          'content:read',
          'content:create',
          'analytics:read',
          'social:post',
          'notification:send',
        ],
        allowedPaths: ['/marketing', '/campaigns', '/content', '/analytics'],
        blockedPaths: ['/marketing/compensation', '/marketing/ads-budget'],
        maxFileSize: 10 * 1024 * 1024,
        config: { ...config },
        workspaceId,
        isActive: true,
      },
      tenantId,
    );

    for (const cap of MARKETING_CAPABILITIES) {
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
      MARKETING_TOOL_PERMISSIONS,
      tenantId,
    );

    this.logger.log(
      `[MarketingHermesAgent] Created agent ${agent.id} for tenant ${tenantId}`,
    );
    return agent;
  }

  async findMarketingAgent(
    tenantId: string,
  ): Promise<HermesAgentDescriptor | null> {
    const agents = await this.registry.findByType(
      HermesAgentType.MARKETING,
      tenantId,
    );
    return agents[0] ?? null;
  }

  async ensureMarketingAgent(
    tenantId: string,
    workspaceId: string,
    config?: { name?: string; model?: string },
  ): Promise<HermesAgentDescriptor> {
    const existing = await this.findMarketingAgent(tenantId);
    if (existing) return existing;
    return this.createMarketingAgent(tenantId, workspaceId, config);
  }
}
