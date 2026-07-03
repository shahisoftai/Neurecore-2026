import type { HermesAgentType, HermesAgentStatus } from '@prisma/client';

export interface HermesAgentContext {
  agentId: string;
  name: string;
  type: HermesAgentType;
  status: HermesAgentStatus;
  model: string;
  systemPrompt: string;
  tenantId: string;
  workspaceId?: string;
}

export interface HermesToolContext {
  allowedTools: string[];
  deniedTools: string[];
  toolsRequiringApproval: string[];
  toolDefinitions: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

export interface HermesMemoryContext {
  personal: string[];
  episodic: string[];
  procedural: Map<string, string>;
}

export interface HermesBuiltContext {
  systemPrompt: string;
  tools: HermesToolContext;
  memory: HermesMemoryContext;
  config: Record<string, unknown>;
}

export interface IHermesContext {
  buildSystemPrompt(
    agent: HermesAgentContext,
    memoryContext: HermesMemoryContext,
  ): string;

  buildToolContext(
    agentId: string,
    tenantId: string,
  ): Promise<HermesToolContext>;

  buildExecutionContext(
    agentId: string,
    tenantId: string,
    sessionId: string,
  ): Promise<HermesBuiltContext>;

  getAgentContext(
    agentId: string,
    tenantId: string,
  ): Promise<HermesAgentContext>;
}
