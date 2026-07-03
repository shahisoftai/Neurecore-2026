import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MiniMaxClient } from '../models/services/minimax-client.service';
import { OfficialAgentGraph } from '../agents/langgraph/langgraph-official';
import { SendChatMessageDto } from './dto/chat.dto';

/**
 * Chat Service
 *
 * Composes a tenant-data-grounded prompt and calls MiniMax for the reply.
 *
 * The service:
 *   1. Resolves the caller's tenantId from the JWT (set by JwtAuthGuard on `req.user`)
 *      — accepts it via `dto.context.tenantId` as a fallback for tests / internal calls
 *   2. Pulls live counters from Prisma: agents by status, tasks by status, departments,
 *      approvals, today's cost MTD
 *   3. Builds a compact JSON-shaped "LIVE TENANT DATA" block and prefixes it to the
 *      system prompt so the model answers with real numbers instead of hallucinating
 *   4. Falls back to a clear stub message if MiniMax is not configured
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly minimax: MiniMaxClient,
    private readonly prisma: PrismaService,
    private readonly agentGraph: OfficialAgentGraph,
  ) {}

  async send(
    dto: SendChatMessageDto,
    tenantIdFromJwt?: string,
    userIdFromJwt?: string,
  ): Promise<{
    reply: string;
    conversationId: string;
    tokens?: { input: number; output: number; total: number };
    model?: string;
    provider?: string;
    liveData?: Record<string, unknown>;
  }> {
    const conversationId =
      dto.conversationId ??
      `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (!this.minimax.isConfigured()) {
      return {
        reply:
          'MiniMax is not configured on the server. Set MINIMAX_API_KEY in backend .env to enable the Ask AI assistant.',
        conversationId,
        tokens: { input: 0, output: 0, total: 0 },
        model: 'unconfigured',
        provider: 'minimax',
      };
    }

    // Resolve tenantId — prefer the JWT-supplied one (set by JwtAuthGuard)
    const tenantId =
      tenantIdFromJwt ??
      (dto.context?.['tenantId'] as string | undefined) ??
      null;

    // Detect if this is an action request or a query
    const intent = this.detectIntent(dto.message);

    // Fetch live tenant data so the model answers with real numbers
    const liveData = tenantId
      ? await this.fetchTenantSnapshot(tenantId)
      : { note: 'no tenant context available' };

    // ACTION: Route to OfficialAgentGraph for tool execution
    if (intent === 'action' && tenantId) {
      try {
        this.logger.log(`[chat] Routing action request to agent graph: ${dto.message}`);

        const result = await this.agentGraph.run({
          goal: dto.message,
          agentId: 'ai-assistant',
          tenantId,
          userId: userIdFromJwt ?? 'anonymous',
          sessionId: conversationId,
        });

        // Extract reply from final message or tool results
        const messages = result.messages ?? [];
        const finalMessage = messages[messages.length - 1];
        const reply = finalMessage?.content ??
          (result.toolResults?.length > 0
            ? `Executed ${result.toolResults.length} tool(s).`
            : 'Action completed.');

        return {
          reply,
          conversationId,
          tokens: { input: 0, output: 0, total: 0 },
          model: 'MiniMax-Text-01',
          provider: 'minimax',
          liveData,
        };
      } catch (err) {
        this.logger.error(`[chat] Agent graph failed: ${(err as Error).message}`);
        return {
          reply: `I tried to execute that action but encountered an error: ${(err as Error).message}`,
          conversationId,
          tokens: { input: 0, output: 0, total: 0 },
          model: 'MiniMax-Text-01',
          provider: 'minimax',
          liveData,
        };
      }
    }

    // QUERY: Use MiniMax for natural language response
    const systemPrompt =
      dto.systemPrompt ??
      'You are HeadQuarter, the AI assistant inside the NeureCore platform. ' +
        'Answer the user using ONLY the LIVE TENANT DATA provided below. ' +
        'If the data answers the question, give the exact numbers. ' +
        'If the data does not contain the answer, say so directly rather than guessing. ' +
        'Keep answers concise (2-4 sentences). When relevant, include a JSON block ' +
        '(no markdown) with keys: chartType, chartData [{label, value}].';

    const historyText = (dto.history ?? [])
      .slice(-10)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const prompt = [
      `SYSTEM: ${systemPrompt}`,
      `\nLIVE TENANT DATA (JSON):\n${JSON.stringify(liveData, null, 2)}`,
      historyText ? `\nCONVERSATION:\n${historyText}` : '',
      `\nUSER: ${dto.message}`,
      '\nASSISTANT:',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await this.minimax.invoke(
        prompt,
        dto.temperature ?? 0.3,
        dto.maxTokens ?? 512,
      );

      return {
        reply: response.content,
        conversationId,
        tokens: response.usage
          ? {
              input: response.usage.inputTokens,
              output: response.usage.outputTokens,
              total: response.usage.totalTokens,
            }
          : { input: 0, output: 0, total: 0 },
        model: this.minimax.model,
        provider: 'minimax',
        liveData,
      };
    } catch (err) {
      this.logger.error(
        `Chat invoke failed: ${(err as Error).message}`,
        ChatService.name,
      );
      return {
        reply: `I received your query, but the MiniMax API returned an error: ${(err as Error).message}`,
        conversationId,
        tokens: { input: 0, output: 0, total: 0 },
        model: this.minimax.model,
        provider: 'minimax',
        liveData,
      };
    }
  }

  /**
   * Detect if user message is an action request or a query
   */
  private detectIntent(message: string): 'action' | 'query' {
    const actionKeywords = [
      'create', 'add', 'new', 'make',
      'pause', 'stop', 'resume', 'start', 'activate',
      'assign', 'delegate',
      'delete', 'remove', 'archive',
      'complete task', 'mark task', 'finish task',
      'reopen', 'cancel',
    ];
    const lower = message.toLowerCase();
    return actionKeywords.some(k => lower.includes(k)) ? 'action' : 'query';
  }

  /**
   * Pull a compact snapshot of the tenant for grounding the LLM.
   * All counts are scoped to `tenantId`. Errors degrade gracefully to null
   * fields so a single failed query doesn't kill the chat reply.
   */
  private async fetchTenantSnapshot(tenantId: string): Promise<Record<string, unknown>> {
    const snap: Record<string, unknown> = {
      tenantId,
      generatedAt: new Date().toISOString(),
    };

    try {
      const [agentsByStatus, departmentsCount, tasksByStatus, workflowsByStatus, pendingApprovals, costMonth] =
        await Promise.all([
          this.prisma.agent.groupBy({
            by: ['status'],
            where: { tenantId },
            _count: { _all: true },
          }).catch(() => []),
          this.prisma.department.count({ where: { tenantId, status: 'ACTIVE' } }).catch(() => null),
          this.prisma.task
            .groupBy({
              by: ['status'],
              where: { tenantId },
              _count: { _all: true },
            })
            .catch(() => []),
          this.prisma.workflow
            .groupBy({
              by: ['status'],
              where: { tenantId },
              _count: { _all: true },
            })
            .catch(() => []),
          this.prisma.approvalRequest
            .count({ where: { tenantId, status: 'PENDING' } })
            .catch(() => null),
          this.prisma.costRecord
            .aggregate({
              where: {
                tenantId,
                windowStart: {
                  gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                },
              },
              _sum: { costCents: true },
            })
            .catch(() => null),
        ]);

      // Build agent counts map
      const agentCounts: Record<string, number> = {};
      let totalAgents = 0;
      for (const row of agentsByStatus) {
        const count = row._count?._all ?? 0;
        agentCounts[row.status] = count;
        totalAgents += count;
      }

      // Build task counts map
      const taskCounts: Record<string, number> = {};
      let totalTasks = 0;
      for (const row of tasksByStatus) {
        const count = row._count?._all ?? 0;
        taskCounts[row.status] = count;
        totalTasks += count;
      }

      // Build workflow counts map
      const workflowCounts: Record<string, number> = {};
      let totalWorkflows = 0;
      for (const row of workflowsByStatus) {
        const count = row._count?._all ?? 0;
        workflowCounts[row.status] = count;
        totalWorkflows += count;
      }

      snap.agents = {
        total: totalAgents,
        byStatus: agentCounts,
      };
      snap.departments = { active: departmentsCount };
      snap.tasks = {
        total: totalTasks,
        byStatus: taskCounts,
      };
      snap.workflows = {
        total: totalWorkflows,
        byStatus: workflowCounts,
      };
      snap.approvals = { pending: pendingApprovals };
      snap.cost = {
        monthToDateCents: costMonth?._sum?.costCents
          ? Number(costMonth._sum.costCents)
          : 0,
        currency: 'USD',
      };
    } catch (err) {
      this.logger.warn(
        `fetchTenantSnapshot failed for ${tenantId}: ${(err as Error).message}`,
      );
      snap.error = (err as Error).message;
    }

    return snap;
  }
}