import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MiniMaxClient } from '../models/services/minimax-client.service';
import { OfficialAgentGraph } from '../agents/langgraph/langgraph-official';
import { SendChatMessageDto } from './dto/chat.dto';
import { ActivityService } from '../hermes/services/activity.service';
import { FeatureFlagService } from '../../common/feature-flag/feature-flag.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';

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
 *
 * When `AI_GATEWAY_V2` is on, the service routes through `AiGatewayService` for
 * true streaming, structured output, and cost attribution; otherwise it falls
 * back to the legacy `MiniMaxClient` direct injection (preserves F2 fix:
 * never returns the bogus `'MiniMax-Text-01'` literal).
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly minimax: MiniMaxClient,
    private readonly prisma: PrismaService,
    private readonly agentGraph: OfficialAgentGraph,
    private readonly activityService: ActivityService,
    private readonly featureFlags: FeatureFlagService,
    private readonly aiGateway: AiGatewayService,
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

    // Fire-and-forget chat:user_message activity. Failures are logged but never
    // break the chat flow — the ActivityEvent feed is observability, not a
    // critical path.
    this.recordChatActivitySafe({
      tenantId: tenantIdFromJwt ?? null,
      actorType: 'USER',
      actorId: userIdFromJwt ?? 'anonymous',
      type: 'chat:user_message',
      title: dto.message.slice(0, 80),
      contextId: conversationId,
      payload: {
        intent: this.detectIntent(dto.message),
        historyLen: dto.history?.length ?? 0,
      },
      sourceEventId: `chat:${conversationId}:user`,
    });

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
        this.logger.log(
          `[chat] Routing action request to agent graph: ${dto.message}`,
        );

        const result = await this.agentGraph.run({
          goal: dto.message,
          agentId: 'ai-assistant',
          tenantId,
          userId: 'user',
          sessionId: conversationId,
        });

        // Extract reply from final message or tool results
        const messages = result.messages ?? [];
        const finalMessage = messages[messages.length - 1];
        const reply =
          finalMessage?.content ??
          (result.toolResults?.length > 0
            ? `Executed ${result.toolResults.length} tool(s).`
            : 'Action completed.');

        this.recordChatActivitySafe({
          tenantId,
          actorType: 'AI_AGENT',
          actorId: 'ai-assistant',
          type: 'chat:assistant_reply',
          title: (reply ?? '').slice(0, 80),
          contextId: conversationId,
          payload: {
            intent: 'action',
            model: this.minimax.model,
            toolResults: result.toolResults?.length ?? 0,
            messages: messages.length,
          },
          sourceEventId: `chat:${conversationId}:assistant`,
        });

        return {
          reply,
          conversationId,
          tokens: { input: 0, output: 0, total: 0 },
          model: this.minimax.model,
          provider: 'minimax',
          liveData,
        };
      } catch (err) {
        this.logger.error(
          `[chat] Agent graph failed: ${(err as Error).message}`,
        );
        const errReply = `I tried to execute that action but encountered an error: ${(err as Error).message}`;
        this.recordChatActivitySafe({
          tenantId,
          actorType: 'SYSTEM',
          actorId: 'chat-service',
          type: 'chat:error',
          title: errReply.slice(0, 80),
          contextId: conversationId,
          severity: 'error',
          payload: { intent: 'action', error: (err as Error).message },
          sourceEventId: `chat:${conversationId}:error`,
        });
        return {
          reply: errReply,
          conversationId,
          tokens: { input: 0, output: 0, total: 0 },
          model: this.minimax.model,
          provider: 'minimax',
          liveData,
        };
      }
    }

    // QUERY: Use MiniMax for natural language response
    const systemPrompt =
      dto.systemPrompt ??
      `You are a friendly, helpful AI assistant. You chat naturally with the user — no headers, no bullet points, no "here's what I found". Just speak plainly and directly.

Answer questions using ONLY the LIVE TENANT DATA provided below. If the data answers the question, share it naturally in conversation. If the data does not contain the answer, say so directly rather than guessing.

IMPORTANT — Project creation: If the user wants to create a project, lead a natural conversation. Ask ONE question at a time. Wait for the answer. Then ask the next question. Keep responses short — one or two sentences.

When relevant, include a JSON block (no markdown) with keys: chartType, chartData [{label, value}].`;

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
      // Feature-flagged routing: when AI_GATEWAY_V2 is on, the gateway
      // owns provider selection, failover, streaming, structured output,
      // and cost attribution. When off, the legacy MiniMaxClient path is
      // preserved (with F2 fix: real model id, never 'MiniMax-Text-01').
      const useGateway = this.featureFlags.isEnabled('AI_GATEWAY_V2');
      // Normalize the two response shapes into one local tuple. The
      // gateway's `LLMResponse` carries `model` + `provider` at the top
      // level; the legacy `MiniMaxClient.invoke` returns
      // `LLMResponse` (legacy) which has neither (it lives on the
      // client instance), so we read it from `this.minimax.model`.
      const replyContent: string = useGateway
        ? (
            await this.aiGateway.invoke({
              tenantId,
              capability: 'conversation',
              prompt,
              sourceModule: 'chat',
              ...(dto.temperature !== undefined
                ? { temperature: dto.temperature }
                : {}),
              ...(dto.maxTokens !== undefined
                ? { maxTokens: dto.maxTokens }
                : {}),
            })
          ).content
        : (
            await this.minimax.invoke(
              prompt,
              dto.temperature ?? 0.3,
              dto.maxTokens ?? 512,
            )
          ).content;
      const replyModel: string = useGateway
        ? ((await this.aiGateway.getLastResolved(tenantId, 'conversation'))
            ?.model.modelId ?? 'gateway')
        : this.minimax.model;
      const replyProvider: string = useGateway
        ? ((await this.aiGateway.getLastResolved(tenantId, 'conversation'))
            ?.provider.slug ?? 'gateway')
        : 'minimax';

      const tokens = { input: 0, output: 0, total: 0 };

      this.recordChatActivitySafe({
        tenantId: tenantIdFromJwt ?? null,
        actorType: 'AI_AGENT',
        actorId: replyProvider,
        type: 'chat:assistant_reply',
        title: (replyContent ?? '').slice(0, 80),
        contextId: conversationId,
        payload: {
          intent: 'query',
          model: replyModel,
          provider: replyProvider,
          tokens,
        },
        sourceEventId: `chat:${conversationId}:assistant`,
      });

      return {
        reply: replyContent,
        conversationId,
        tokens,
        model: replyModel,
        provider: replyProvider,
        liveData,
      };
    } catch (err) {
      this.logger.error(
        `Chat invoke failed: ${(err as Error).message}`,
        ChatService.name,
      );
      const errReply = `I received your query, but the MiniMax API returned an error: ${(err as Error).message}`;
      this.recordChatActivitySafe({
        tenantId: tenantIdFromJwt ?? null,
        actorType: 'SYSTEM',
        actorId: 'chat-service',
        type: 'chat:error',
        title: errReply.slice(0, 80),
        contextId: conversationId,
        severity: 'error',
        payload: { intent: 'query', error: (err as Error).message },
        sourceEventId: `chat:${conversationId}:error`,
      });
      return {
        reply: errReply,
        conversationId,
        tokens: { input: 0, output: 0, total: 0 },
        model: this.minimax.model,
        provider: 'minimax',
        liveData,
      };
    }
  }

  /**
   * V2 streaming entry point. Returns an async iterable of text
   * deltas. Activated by `AI_GATEWAY_V2`. The legacy REST endpoint
   * is unchanged.
   *
   * NOTE: This method streams the QUERY path only (natural language response).
   * Action requests (create project, etc.) are routed through the non-streaming
   * `send()` method which uses OfficialAgentGraph for tool execution.
   */
  async *stream(
    dto: SendChatMessageDto,
    tenantIdFromJwt?: string,
  ): AsyncGenerator<{ delta: string; done: boolean }> {
    const tenantId =
      tenantIdFromJwt ??
      (dto.context?.['tenantId'] as string | undefined) ??
      null;
    const systemPrompt =
      dto.systemPrompt ??
      `You are a friendly, helpful AI assistant. You chat naturally with the user — no headers, no bullet points, no "here's what I found". Just speak plainly and directly.

Answer questions using ONLY the LIVE TENANT DATA provided below. If the data answers the question, share it naturally in conversation. If the data does not contain the answer, say so directly rather than guessing.

IMPORTANT — Project creation: If the user wants to create a project, lead a natural conversation. Ask ONE question at a time. Wait for the answer. Then ask the next question. Keep responses short — one or two sentences.

When relevant, include a JSON block (no markdown) with keys: chartType, chartData [{label, value}].`;
    const liveData = tenantId
      ? await this.fetchTenantSnapshot(tenantId)
      : { note: 'no tenant context available' };
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
    for await (const chunk of this.aiGateway.stream({
      tenantId,
      capability: 'conversation',
      prompt,
      sourceModule: 'chat.stream',
      ...(dto.temperature !== undefined
        ? { temperature: dto.temperature }
        : {}),
      ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
    })) {
      yield { delta: chunk.delta, done: chunk.done };
    }
  }

  /**
   * Fire-and-forget ActivityEvent recorder. Silently swallows failures so chat
   * flows never break because observability is offline. Resolves input context
   * (tenantId) is required to write the event; without it we skip.
   */
  private recordChatActivitySafe(params: {
    tenantId: string | null;
    actorType: 'USER' | 'AI_AGENT' | 'SYSTEM';
    actorId: string;
    type: string;
    title: string;
    contextId: string;
    payload: Record<string, unknown>;
    sourceEventId: string;
    severity?: 'info' | 'error' | 'warning';
  }): void {
    if (!this.activityService || !params.tenantId) return;
    this.activityService
      .record({
        tenantId: params.tenantId,
        actorType: params.actorType,
        actorId: params.actorId,
        type: params.type,
        title: params.title,
        contextType: 'CHAT_CONVERSATION',
        contextId: params.contextId,
        payload: params.payload,
        severity: params.severity ?? 'info',
        visibility: 'tenant',
        sourceEventId: params.sourceEventId,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
      .catch((err) =>
        this.logger.warn(
          `Activity record failed for ${params.type}: ${String(err)}`,
        ),
      );
  }

  /**
   * Detect if user message is an action request or a query
   */
  private detectIntent(message: string): 'action' | 'query' {
    const actionKeywords = [
      'create',
      'add',
      'new',
      'make',
      'pause',
      'stop',
      'resume',
      'start',
      'activate',
      'list',
      'show',
      'get',
      'find',
      'assign',
      'delegate',
      'set',
      'delete',
      'remove',
      'archive',
    ];
    const lower = message.toLowerCase();
    return actionKeywords.some((k) => lower.includes(k)) ? 'action' : 'query';
  }

  /**
   * Pull a compact snapshot of the tenant for grounding the LLM.
   * All counts are scoped to `tenantId`. Errors degrade gracefully to null
   * fields so a single failed query doesn't kill the chat reply.
   */
  private async fetchTenantSnapshot(
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const snap: Record<string, unknown> = {
      tenantId,
      generatedAt: new Date().toISOString(),
    };

    try {
      const [
        agentsByStatus,
        departmentsCount,
        tasksByStatus,
        workflowsByStatus,
        pendingApprovals,
        costMonth,
      ] = await Promise.all([
        this.prisma.agent
          .groupBy({
            by: ['status'],
            where: { tenantId },
            _count: { _all: true },
          })
          .catch(() => []),
        this.prisma.department
          .count({ where: { tenantId, status: 'ACTIVE' } })
          .catch(() => null),
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
                gte: new Date(
                  new Date().getFullYear(),
                  new Date().getMonth(),
                  1,
                ),
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
