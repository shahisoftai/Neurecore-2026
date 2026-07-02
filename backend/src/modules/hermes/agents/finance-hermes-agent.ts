import { Injectable, Logger } from '@nestjs/common';
import { HermesRegistryService } from '../services/hermes-registry.service';
import { HermesAgentType, ToolPermissionLevel } from '@prisma/client';
import type {
  HermesAgentDescriptor,
  HermesCapabilityDescriptor,
  CreateHermesAgentInput,
} from '../interfaces/hermes-agent.interface';

export const FINANCE_CAPABILITIES = [
  {
    name: 'invoice_processing',
    description: 'Process and route invoices for approval',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string' },
        amount: { type: 'number' },
        vendor: { type: 'string' },
      },
      required: ['invoiceId', 'amount'],
    },
    costEstimate: 0.05,
    avgDuration: 5000,
  },
  {
    name: 'expense_review',
    description: 'Review expense reports against policy',
    inputSchema: {
      type: 'object',
      properties: {
        expenseId: { type: 'string' },
        employeeId: { type: 'string' },
        amount: { type: 'number' },
        category: { type: 'string' },
      },
      required: ['expenseId', 'amount'],
    },
    costEstimate: 0.03,
    avgDuration: 3000,
  },
  {
    name: 'budget_query',
    description: 'Query budget status and allocations',
    inputSchema: {
      type: 'object',
      properties: {
        department: { type: 'string' },
        fiscalPeriod: { type: 'string' },
      },
      required: ['department'],
    },
    costEstimate: 0.02,
    avgDuration: 2000,
  },
  {
    name: 'financial_report_generation',
    description: 'Generate financial reports and summaries',
    inputSchema: {
      type: 'object',
      properties: {
        reportType: {
          type: 'string',
          enum: ['income_statement', 'balance_sheet', 'cash_flow'],
        },
        period: { type: 'string' },
      },
      required: ['reportType'],
    },
    costEstimate: 0.1,
    avgDuration: 15000,
  },
  {
    name: 'vendor_verification',
    description: 'Verify vendor credentials and banking details',
    inputSchema: {
      type: 'object',
      properties: {
        vendorId: { type: 'string' },
      },
      required: ['vendorId'],
    },
    costEstimate: 0.04,
    avgDuration: 8000,
  },
];

export const FINANCE_TOOL_PERMISSIONS: Array<{
  toolName: string;
  permission: ToolPermissionLevel;
  conditions?: Record<string, unknown>;
}> = [
  { toolName: 'read_invoice', permission: ToolPermissionLevel.ALLOW },
  { toolName: 'create_invoice', permission: ToolPermissionLevel.ALLOW },
  {
    toolName: 'approve_invoice',
    permission: ToolPermissionLevel.APPROVAL_REQUIRED,
    conditions: { maxAmount: 10000 },
  },
  { toolName: 'read_expense', permission: ToolPermissionLevel.ALLOW },
  { toolName: 'submit_expense', permission: ToolPermissionLevel.ALLOW },
  {
    toolName: 'approve_expense',
    permission: ToolPermissionLevel.APPROVAL_REQUIRED,
    conditions: { maxAmount: 5000 },
  },
  { toolName: 'read_budget', permission: ToolPermissionLevel.ALLOW },
  { toolName: 'read_financial_report', permission: ToolPermissionLevel.ALLOW },
  { toolName: 'send_notification', permission: ToolPermissionLevel.ALLOW },
  { toolName: 'web_search', permission: ToolPermissionLevel.READ_ONLY },
  { toolName: 'read_file', permission: ToolPermissionLevel.READ_ONLY },
];

const FINANCE_SYSTEM_PROMPT = `You are FinanceHermes, a specialized financial AI agent.

Your core responsibilities:
- Process invoices: receive, validate, route for approval
- Expense management: review expense reports against policy guidelines
- Budget tracking: monitor spending against allocated budgets
- Financial reporting: generate P&L, balance sheet, cash flow reports
- Vendor management: verify vendor credentials and payment details

Operational guidelines:
1. ALWAYS verify amounts match source documents before approving
2. Flag transactions over $10,000 for human manager review
3. Never approve payments to unverified vendors
4. Maintain audit trail of all financial decisions
5. Escalate suspicious activity to the security team immediately

Approval thresholds:
- Under $1,000: You may approve directly
- $1,000-$10,000: Requires manager co-approval
- Over $10,000: Requires executive approval

You operate within strict compliance requirements. Always document your reasoning for financial decisions.`;

@Injectable()
export class FinanceHermesAgentFactory {
  private readonly logger = new Logger(FinanceHermesAgentFactory.name);

  constructor(private readonly registry: HermesRegistryService) {}

  async createFinanceAgent(
    tenantId: string,
    workspaceId: string,
    config?: {
      name?: string;
      model?: string;
      budgetApprovalLimit?: number;
    },
  ): Promise<HermesAgentDescriptor> {
    const agent = await this.registry.register(
      {
        name: config?.name ?? 'FinanceHermes',
        type: HermesAgentType.FINANCE,
        description:
          'Specialized financial AI agent for invoice processing, expense management, and budget tracking',
        model: config?.model ?? 'mini-max',
        systemPrompt: FINANCE_SYSTEM_PROMPT,
        permissions: [
          'invoice:read',
          'invoice:create',
          'invoice:approve',
          'expense:read',
          'expense:submit',
          'expense:approve',
          'budget:read',
          'report:read',
          'report:generate',
          'notification:send',
          'vendor:verify',
        ],
        allowedPaths: ['/finance', '/invoices', '/expenses', '/budgets'],
        blockedPaths: ['/hr/payroll', '/executive/compensation'],
        maxFileSize: 10 * 1024 * 1024,
        config: {
          budgetApprovalLimit: config?.budgetApprovalLimit ?? 10000,
          autoApproveLimit: 1000,
          requireManagerApprovalAbove: 10000,
          requireExecutiveApprovalAbove: 50000,
          ...config,
        },
        workspaceId,
        isActive: true,
      },
      tenantId,
    );

    for (const cap of FINANCE_CAPABILITIES) {
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
      FINANCE_TOOL_PERMISSIONS.map((p) => ({
        toolName: p.toolName,
        permission: p.permission,
        conditions: p.conditions,
      })),
      tenantId,
    );

    this.logger.log(
      `[FinanceHermesAgent] Created agent ${agent.id} for tenant ${tenantId}`,
    );
    return agent;
  }

  async findFinanceAgent(
    tenantId: string,
  ): Promise<HermesAgentDescriptor | null> {
    const agents = await this.registry.findByType(
      HermesAgentType.FINANCE,
      tenantId,
    );
    return agents[0] ?? null;
  }

  async ensureFinanceAgent(
    tenantId: string,
    workspaceId: string,
    config?: {
      name?: string;
      model?: string;
      budgetApprovalLimit?: number;
    },
  ): Promise<HermesAgentDescriptor> {
    const existing = await this.findFinanceAgent(tenantId);
    if (existing) return existing;
    return this.createFinanceAgent(tenantId, workspaceId, config);
  }
}
