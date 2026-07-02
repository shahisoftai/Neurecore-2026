import { Injectable, Logger } from '@nestjs/common';
import { HermesRegistryService } from '../services/hermes-registry.service';
import { HermesAgentType } from '@prisma/client';
import type { HermesAgentDescriptor } from '../interfaces/hermes-agent.interface';

export const HR_CAPABILITIES = [
  {
    name: 'employee_onboarding',
    description: 'Guide new employees through the onboarding process',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string' },
        department: { type: 'string' },
        startDate: { type: 'string' },
      },
      required: ['employeeId', 'startDate'],
    },
    costEstimate: 0.04,
    avgDuration: 8000,
  },
  {
    name: 'employee_offboarding',
    description: 'Manage employee departure process and documentation',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string' },
        reason: { type: 'string' },
        lastDay: { type: 'string' },
      },
      required: ['employeeId', 'reason'],
    },
    costEstimate: 0.05,
    avgDuration: 10000,
  },
  {
    name: 'policy_query',
    description: 'Answer questions about company policies and benefits',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
        employeeId: { type: 'string' },
      },
      required: ['topic'],
    },
    costEstimate: 0.01,
    avgDuration: 2000,
  },
  {
    name: 'leave_request_process',
    description: 'Process and route leave requests for approval',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string' },
        leaveType: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
      },
      required: ['employeeId', 'leaveType', 'startDate'],
    },
    costEstimate: 0.02,
    avgDuration: 3000,
  },
  {
    name: 'performance_review_prep',
    description: 'Prepare performance review summaries and talking points',
    inputSchema: {
      type: 'object',
      properties: {
        employeeId: { type: 'string' },
        reviewPeriod: { type: 'string' },
      },
      required: ['employeeId', 'reviewPeriod'],
    },
    costEstimate: 0.06,
    avgDuration: 15000,
  },
];

export const HR_TOOL_PERMISSIONS: Array<{
  toolName: string;
  permission: string;
  conditions?: Record<string, unknown>;
}> = [
  { toolName: 'read_employee', permission: 'ALLOW' },
  { toolName: 'read_policy', permission: 'ALLOW' },
  { toolName: 'submit_leave_request', permission: 'ALLOW' },
  { toolName: 'read_pto_balance', permission: 'ALLOW' },
  { toolName: 'send_notification', permission: 'ALLOW' },
  { toolName: 'read_budget', permission: 'ALLOW' },
  { toolName: 'web_search', permission: 'READ_ONLY' },
];

const HR_SYSTEM_PROMPT = `You are HRHermes, a specialized HR AI agent.

Your core responsibilities:
- Employee onboarding: guide new hires through orientation, paperwork, and setup
- Employee offboarding: manage departure checklists, exit interviews, and final documentation
- Policy guidance: answer questions about company policies, benefits, and procedures
- Leave management: process leave requests and route for approval
- Performance reviews: prepare summaries and track review cycles

Operational guidelines:
1. Always verify employee identity before sharing personal information
2. Route sensitive matters (termination, disciplinary actions, compensation) to human HR managers
3. Maintain strict confidentiality of employee records
4. Never provide legal advice — recommend consulting HR legal counsel for compliance questions
5. Document all interactions for audit trail purposes

You operate within strict HR compliance requirements. Always escalate sensitive employee matters to human HR managers.`;

@Injectable()
export class HRHermesAgentFactory {
  private readonly logger = new Logger(HRHermesAgentFactory.name);

  constructor(private readonly registry: HermesRegistryService) {}

  async createHRAgent(
    tenantId: string,
    workspaceId: string,
    config?: { name?: string; model?: string },
  ): Promise<HermesAgentDescriptor> {
    const agent = await this.registry.register(
      {
        name: config?.name ?? 'HRHermes',
        type: HermesAgentType.HR,
        description:
          'Specialized HR agent for employee onboarding, offboarding, policy queries, and leave management',
        model: config?.model ?? 'mini-max',
        systemPrompt: HR_SYSTEM_PROMPT,
        permissions: [
          'employee:read',
          'policy:read',
          'leave:submit',
          'leave:approve',
          'pto:read',
          'notification:send',
          'document:read',
        ],
        allowedPaths: ['/hr', '/employees', '/policies', '/leave'],
        blockedPaths: ['/hr/compensation', '/hr/termination'],
        maxFileSize: 5 * 1024 * 1024,
        config: { ...config },
        workspaceId,
        isActive: true,
      },
      tenantId,
    );

    for (const cap of HR_CAPABILITIES) {
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
      HR_TOOL_PERMISSIONS,
      tenantId,
    );

    this.logger.log(
      `[HRHermesAgent] Created agent ${agent.id} for tenant ${tenantId}`,
    );
    return agent;
  }

  async findHRAgent(tenantId: string): Promise<HermesAgentDescriptor | null> {
    const agents = await this.registry.findByType(HermesAgentType.HR, tenantId);
    return agents[0] ?? null;
  }

  async ensureHRAgent(
    tenantId: string,
    workspaceId: string,
    config?: { name?: string; model?: string },
  ): Promise<HermesAgentDescriptor> {
    const existing = await this.findHRAgent(tenantId);
    if (existing) return existing;
    return this.createHRAgent(tenantId, workspaceId, config);
  }
}
