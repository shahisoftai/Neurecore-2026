import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { IHermesContext } from '../interfaces/hermes-context.interface';
import type {
  HermesAgentContext,
  HermesToolContext,
  HermesMemoryContext,
  HermesBuiltContext,
} from '../interfaces/hermes-context.interface';
import { HermesRegistryService } from './hermes-registry.service';
import { HermesMemoryService } from './hermes-memory.service';
import { ToolGatewayService } from './tool-gateway.service';
import {
  buildHermesSystemPrompt,
  truncateForContext,
  parseMemoryContext,
} from '../common/hermes.utils';
import { HERMES_AGENT_DESCRIPTIONS } from '../common/hermes.constants';
import { HERMES_MEMORY_MAX_CONTEXT_TOKENS } from '../common/hermes.constants';

@Injectable()
export class HermesContextService implements IHermesContext {
  private readonly logger = new Logger(HermesContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registryService: HermesRegistryService,
    private readonly memoryService: HermesMemoryService,
    private readonly toolGatewayService: ToolGatewayService,
  ) {}

  async getAgentContext(
    agentId: string,
    tenantId: string,
  ): Promise<HermesAgentContext> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException(
        `Hermes agent ${agentId} not found`,
      );
    }

    return {
      agentId: agent.id,
      name: agent.name,
      type: agent.type,
      status: agent.status,
      model: agent.model ?? 'gpt-4o-mini',
      systemPrompt:
        agent.systemPrompt ??
        this.buildDefaultPrompt(agent.type, agent.name),
      tenantId: agent.tenantId,
      workspaceId: agent.workspaceId ?? undefined,
    };
  }

  buildSystemPrompt(
    agent: HermesAgentContext,
    memoryContext: HermesMemoryContext,
  ): string {
    const basePrompt = agent.systemPrompt;

    const personalMemory = memoryContext.personal.join('\n');
    const proceduralMemory = Array.from(
      memoryContext.procedural.entries(),
    )
      .map(([task, procedure]) => `Task: ${task}\nProcedure: ${procedure}`)
      .join('\n\n');

    const sections = [basePrompt];

    if (proceduralMemory) {
      sections.push(
        '\n\n--- STANDARD OPERATING PROCEDURES ---',
        proceduralMemory,
      );
    }

    if (personalMemory) {
      sections.push(
        '\n\n--- AGENT KNOWLEDGE ---',
        truncateForContext(
          personalMemory,
          HERMES_MEMORY_MAX_CONTEXT_TOKENS - 500,
        ),
      );
    }

    if (memoryContext.episodic.length > 0) {
      sections.push(
        '\n\n--- RECENT EXPERIENCES ---',
        memoryContext.episodic.join('\n'),
      );
    }

    return sections.join('\n');
  }

  async buildToolContext(
    agentId: string,
    tenantId: string,
  ): Promise<HermesToolContext> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: agentId, tenantId },
      include: { toolPermissions: true },
    });

    if (!agent) {
      throw new NotFoundException(
        `Hermes agent ${agentId} not found`,
      );
    }

    const allowedTools: string[] = [];
    const deniedTools: string[] = [];
    const toolsRequiringApproval: string[] = [];

    for (const tp of agent.toolPermissions) {
      switch (tp.permission) {
        case 'ALLOW':
        case 'READ_ONLY':
        case 'WRITE_ONLY':
          allowedTools.push(tp.toolName);
          break;
        case 'APPROVAL_REQUIRED':
          toolsRequiringApproval.push(tp.toolName);
          allowedTools.push(tp.toolName);
          break;
        case 'DENY':
          deniedTools.push(tp.toolName);
          break;
      }
    }

    const toolMenu = await this.toolGatewayService.buildToolMenu(
      agentId,
      tenantId,
    );

    return {
      allowedTools,
      deniedTools,
      toolsRequiringApproval,
      toolDefinitions: toolMenu.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.conditions ?? {},
      })),
    };
  }

  async buildExecutionContext(
    agentId: string,
    tenantId: string,
    sessionId: string,
  ): Promise<HermesBuiltContext> {
    const agentCtx = await this.getAgentContext(agentId, tenantId);
    const toolCtx = await this.buildToolContext(agentId, tenantId);

    const memoryCtx = {
      personal: [] as string[],
      episodic: [] as string[],
      procedural: new Map<string, string>(),
    };

    try {
      const personal = await this.memoryService.search(
        agentId,
        'personal knowledge techniques',
        tenantId,
        { type: 'PERSONAL', limit: 20, minImportance: 0.3 },
      );

      for (const m of personal) {
        const text = m.summary ?? m.content;
        if (text && text.trim()) {
          memoryCtx.personal.push(text);
        }
      }

      const episodic = await this.memoryService.search(
        agentId,
        'recent episodes tasks',
        tenantId,
        { type: 'EPISODIC', limit: 10 },
      );

      for (const m of episodic) {
        const text = m.summary ?? m.content;
        if (text && text.trim()) {
          memoryCtx.episodic.push(text);
        }
      }

      const procedural = await this.memoryService.search(
        agentId,
        'procedure steps instructions',
        tenantId,
        { type: 'PROCEDURAL', limit: 20 },
      );

      for (const m of procedural) {
        if (m.content) {
          const lines = m.content.split('\n');
          const taskName =
            lines[0]?.replace('Task: ', '') ?? m.id;
          memoryCtx.procedural.set(taskName, m.content);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Failed to load memory for agent ${agentId}: ${(err as Error).message}`,
      );
    }

    const systemPrompt = this.buildSystemPrompt(agentCtx, memoryCtx);

    return {
      systemPrompt,
      tools: toolCtx,
      memory: memoryCtx,
      config: ((await this.prisma.hermesAgent.findUnique({
        where: { id: agentId },
        select: { config: true },
      }))?.config ?? {}) as Record<string, unknown>,
    };
  }

  private buildDefaultPrompt(
    type: string,
    name: string,
  ): string {
    const description =
      HERMES_AGENT_DESCRIPTIONS[type as keyof typeof HERMES_AGENT_DESCRIPTIONS] ??
      'an AI agent';

    return buildHermesSystemPrompt(type, name, description);
  }
}
