import { Injectable, Logger } from '@nestjs/common';
import type {
  IHermesContext,
  HermesExecutionRequest,
  HermesExecutionContext,
  GovernanceContext,
} from '../interfaces/hermes-runtime.interface';
import { HermesRegistryService } from './hermes-registry.service';
import { HermesMemoryService } from './hermes-memory.service';
import { GovernanceRulesService } from '../../governance/services/governance-rules.service';
import { ToolGatewayService } from './tool-gateway.service';
import {
  DEFAULT_HERMES_TIMEOUT_MS,
  DEFAULT_MAX_ITERATIONS,
} from '../common/hermes.types';

@Injectable()
export class HermesContextService implements IHermesContext {
  private readonly logger = new Logger(HermesContextService.name);

  constructor(
    private readonly registry: HermesRegistryService,
    private readonly memory: HermesMemoryService,
    private readonly governance: GovernanceRulesService,
    private readonly toolGateway: ToolGatewayService,
  ) {}

  async build(
    request: HermesExecutionRequest,
  ): Promise<HermesExecutionContext> {
    const agent = await this.registry.findById(
      request.hermesAgentId,
      request.context.tenantId,
    );
    if (!agent) {
      throw new Error(`HermesAgent ${request.hermesAgentId} not found`);
    }

    const [systemPrompt, memoryContext, governanceContext, allowedTools] =
      await Promise.all([
        this.buildSystemPrompt(request.hermesAgentId, request.context.tenantId),
        this.memory.getContext(
          request.hermesAgentId,
          request.context.tenantId,
          5,
        ),
        this.enrichWithGovernance(
          {
            sessionId: request.sessionId,
            hermesAgentId: request.hermesAgentId,
            tenantId: request.context.tenantId,
            workspaceId: request.context.workspaceId,
            userId: request.context.userId,
            threadId: request.context.threadId,
            task: request.task,
            systemPrompt: '',
            memoryContext: '',
            allowedTools: [],
            governanceContext: {
              requiresApproval: false,
              blockedRules: [],
              rateLimited: false,
              alerts: [],
            },
            maxIterations: request.maxIterations ?? DEFAULT_MAX_ITERATIONS,
            permissions: agent.permissions,
            metadata: {},
          },
          request.context.tenantId,
        ),
        this.toolGateway.getAllowedTools(
          request.hermesAgentId,
          request.context.tenantId,
        ),
      ]);

    return {
      sessionId: request.sessionId,
      hermesAgentId: request.hermesAgentId,
      tenantId: request.context.tenantId,
      workspaceId: request.context.workspaceId,
      userId: request.context.userId,
      threadId: request.context.threadId,
      hermesNodeId: request.context.hermesNodeId,
      parentTraceId: request.context.parentTraceId,
      task: request.task,
      systemPrompt,
      memoryContext,
      allowedTools: request.tools?.length ? request.tools : allowedTools,
      governanceContext,
      maxIterations: request.maxIterations ?? DEFAULT_MAX_ITERATIONS,
      permissions: agent.permissions,
      metadata: {
        agentType: agent.type,
        agentModel: agent.model,
      },
    };
  }

  async buildSystemPrompt(agentId: string, tenantId: string): Promise<string> {
    const agent = await this.registry.findById(agentId, tenantId);
    if (!agent) return '';

    const memoryContext = await this.memory.getContext(agentId, tenantId, 3);

    const basePrompt = agent.systemPrompt ?? this.getDefaultPrompt(agent.type);

    const memorySection = memoryContext
      ? `\n\n## Recent Memory\n${memoryContext}`
      : '';

    return `${basePrompt}${memorySection}\n\nYou are operating as ${agent.name} (${agent.type}) for tenant ${tenantId}.`;
  }

  async injectMemory(
    agentId: string,
    context: HermesExecutionContext,
    maxTokens = 2000,
  ): Promise<string> {
    const memory = await this.memory.getContext(agentId, context.tenantId, 5);
    if (!memory) return '';

    const truncated = memory.slice(0, maxTokens);
    return `\n\n## Memory Context\n${truncated}`;
  }

  async enrichWithGovernance(
    context: HermesExecutionContext,
    tenantId: string,
  ): Promise<GovernanceContext> {
    const decision = await this.governance.evaluate(tenantId, {
      'hermes.agentId': context.hermesAgentId,
      'hermes.tenantId': context.tenantId,
      'hermes.task': context.task,
    });

    return {
      requiresApproval: decision.requiresApproval,
      blockedRules: decision.triggeredRules,
      rateLimited: decision.actions.includes('RATE_LIMIT'),
      alerts: decision.triggeredRules,
    };
  }

  private getDefaultPrompt(type: string): string {
    const prompts: Record<string, string> = {
      HR: `You are an HR Hermes agent. You help with employee onboarding, offboarding, policy questions, and HR operations. Always follow company HR policies and escalate sensitive matters to human HR managers.`,
      FINANCE: `You are a Finance Hermes agent. You help with invoice processing, expense approvals, budget tracking, and financial reporting. Always verify amounts and follow approval workflows for transactions.`,
      SALES: `You are a Sales Hermes agent. You help manage deals, contacts, quotes, and CRM operations. Be helpful and professional in all customer interactions.`,
      MARKETING: `You are a Marketing Hermes agent. You help create campaigns, analyze metrics, and manage brand content. Follow brand guidelines in all communications.`,
      LEGAL: `You are a Legal Hermes agent. You help review contracts, check compliance, and provide legal information. Always recommend consulting a human lawyer for significant legal matters.`,
      RESEARCH: `You are a Research Hermes agent. You help gather information, analyze data, and provide insights. Cite sources and be clear about uncertainty.`,
      ENGINEERING: `You are an Engineering Hermes agent. You help with code reviews, technical decisions, and development workflows. Follow best practices and security guidelines.`,
      QA: `You are a QA Hermes agent. You help with testing strategies, bug reporting, and quality assurance. Be thorough and precise.`,
      SECURITY: `You are a Security Hermes agent. You help identify security concerns and ensure safe practices. Never compromise on security.`,
      OPERATIONS: `You are an Operations Hermes agent. You help streamline processes and manage resources efficiently.`,
      CUSTOMER_SUPPORT: `You are a Customer Support Hermes agent. You help resolve customer issues professionally and empathetically.`,
      CUSTOM: `You are a Hermes AI agent. You assist with various tasks following your configured guidelines.`,
    };

    return prompts[type] ?? prompts['CUSTOM'];
  }
}
