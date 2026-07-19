import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MiniMaxClient } from '../models/services/minimax-client.service';
import { OfficialAgentGraph } from '../agents/langgraph/langgraph-official';
import { SendChatMessageDto } from './dto/chat.dto';
import { ActivityService } from '../hermes/services/activity.service';
import { FeatureFlagService } from '../../common/feature-flag/feature-flag.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { ChatHistoryService } from './chat-history.service';

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
    private readonly chatHistory: ChatHistoryService,
  ) {}

  private saveReply(
    conversationId: string,
    tenantId: string | null,
    userId: string,
    payload: {
      reply: string;
      tokens?: { input: number; output: number; total: number };
      model?: string;
      provider?: string;
    },
  ): void {
    void this.chatHistory.saveMessage({
      tenantId: tenantId ?? 'unknown',
      userId,
      conversationId,
      role: 'assistant',
      content: payload.reply,
      ...(payload.tokens ? { tokens: payload.tokens } : {}),
      ...(payload.model ? { model: payload.model } : {}),
      ...(payload.provider ? { provider: payload.provider } : {}),
    });
  }

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

    const tenantIdForHistory = tenantIdFromJwt ?? null;
    const userIdForHistory = userIdFromJwt ?? 'anonymous';

    // Persist the user message immediately (fire-and-forget).
    void this.chatHistory.saveMessage({
      tenantId: tenantIdForHistory ?? 'unknown',
      userId: userIdForHistory,
      conversationId,
      role: 'user',
      content: dto.message,
    });

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
      const result = {
        reply:
          'MiniMax is not configured on the server. Set MINIMAX_API_KEY in backend .env to enable the Ask AI assistant.',
        conversationId,
        tokens: { input: 0, output: 0, total: 0 },
        model: 'unconfigured',
        provider: 'minimax',
      };
      this.saveReply(
        conversationId,
        tenantIdForHistory,
        userIdForHistory,
        result,
      );
      return result;
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

    // PROJECT-CREATION INTENT: bypass the model entirely and drive a
    // human-style conversation ourselves. The MiniMax-M2.7-highspeed model
    // is heavily tuned to dump structured lists for project-creation queries,
    // which is the opposite of what users want. We own the conversation.
    const projectCreationReply = this.handleProjectCreationConversation(
      dto,
      conversationId,
    );
    if (projectCreationReply) {
      this.recordChatActivitySafe({
        tenantId: tenantIdFromJwt ?? null,
        actorType: 'SYSTEM',
        actorId: 'project-creation-flow',
        type: 'chat:assistant_reply',
        title: projectCreationReply.slice(0, 80),
        contextId: conversationId,
        payload: { intent: 'project_creation', model: 'deterministic' },
        sourceEventId: `chat:${conversationId}:assistant`,
      });
      const result = {
        reply: projectCreationReply,
        conversationId,
        tokens: { input: 0, output: 0, total: 0 },
        model: 'deterministic-project-flow',
        provider: 'system',
        liveData,
      };
      this.saveReply(
        conversationId,
        tenantIdForHistory,
        userIdForHistory,
        result,
      );
      return result;
    }

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

        const replyPayload = {
          reply: this.sanitizeReply(reply),
          conversationId,
          tokens: { input: 0, output: 0, total: 0 },
          model: this.minimax.model,
          provider: 'minimax',
          liveData,
        };
        this.saveReply(
          conversationId,
          tenantIdForHistory,
          userIdForHistory,
          replyPayload,
        );
        return replyPayload;
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
        const result = {
          reply: errReply,
          conversationId,
          tokens: { input: 0, output: 0, total: 0 },
          model: this.minimax.model,
          provider: 'minimax',
          liveData,
        };
        this.saveReply(
          conversationId,
          tenantIdForHistory,
          userIdForHistory,
          result,
        );
        return result;
      }
    }

    // QUERY: Use MiniMax for natural language response
    const systemPrompt =
      dto.systemPrompt ??
      `You are a friendly, helpful AI assistant who talks like a real person texting a colleague. Plain sentences only. No markdown, no bullet points, no dashes for lists, no bold, no headers. No internal reasoning. No <think> tags.

When the user wants to create a project, your reply must be EXACTLY in this conversational form:

"Sure, I can help with that! What kind of project — and what should I call it?"

Then stop. Wait for the user's answer. On the next turn, ask one more question (e.g., deadline or budget). Never dump a list of fields. Never use structured formatting. Just chat.

For all other questions, answer using the LIVE TENANT DATA below in plain conversational sentences. No structured output, no lists. If data is missing, say so directly.

When relevant, include a JSON block (no markdown fences) with keys: chartType, chartData [{label, value}].`;

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

      const result = {
        reply: this.sanitizeReply(replyContent),
        conversationId,
        tokens,
        model: replyModel,
        provider: replyProvider,
        liveData,
      };
      this.saveReply(
        conversationId,
        tenantIdForHistory,
        userIdForHistory,
        result,
      );
      return result;
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
      const result = {
        reply: errReply,
        conversationId,
        tokens: { input: 0, output: 0, total: 0 },
        model: this.minimax.model,
        provider: 'minimax',
        liveData,
      };
      this.saveReply(
        conversationId,
        tenantIdForHistory,
        userIdForHistory,
        result,
      );
      return result;
    }
  }

  /**
   * Strip thinking/reasoning blocks and excessive markdown formatting from the
   * model's reply so it reads like a natural human response.
   *
   * The MiniMax-M2.7-highspeed model trained with reasoning often leaks
   * `<think>...</think>` blocks into its output, plus it over-formats with
   * bold/headers/lists even when told not to. We strip:
   *   - `<think>...</think>` blocks (model internal reasoning)
   *   - `**bold**` markers (replace with plain text)
   *   - `## headers` (strip)
   *   - leading bullet lists (replace with prose where possible)
   *
   * If everything is stripped and we're left with empty whitespace, return a
   * short fallback message instead.
   */
  private sanitizeReply(raw: string | undefined | null): string {
    if (!raw) return '';
    let text = raw;

    // 1. Strip <think>...</think> blocks (model internal reasoning).
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // 2. Strip <thinking>...</thinking> variant just in case.
    text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    // 3. If a `</think>` opens without a closing tag (truncated), strip from
    //    the opening tag to end of string.
    text = text.replace(/<think>[\s\S]*$/gi, '');

    // 4. Collapse repeated blank lines.
    text = text.replace(/\n{3,}/g, '\n\n');

    // 5. Strip leading/trailing whitespace.
    text = text.trim();

    // 6. Remove `**bold**` markers — keep the inner text.
    text = text.replace(/\*\*(.+?)\*\*/g, '$1');

    // 7. Strip markdown headers (## / ###).
    text = text.replace(/^#{1,6}\s+/gm, '');

    // 8. Strip horizontal rules.
    text = text.replace(/^---+$/gm, '');

    // 9. Strip leading bullet markers (`- `, `* `, `• `) from lines so the
    //    model can't sneak in dash-list formatting. Replace with a blank so
    //    the inner text runs together as prose.
    text = text.replace(/^\s*[-*•]\s+/gm, '');

    // 10. Strip leading numbered list markers (`1. `, `2) `, etc).
    text = text.replace(/^\s*\d+[.)]\s+/gm, '');

    // 11. Collapse runs of blank lines we created by stripping bullets.
    text = text.replace(/\n{3,}/g, '\n\n');

    // 12. Trim again after stripping.
    text = text.trim();

    // 13. If the response became empty, provide a short fallback so the user
    //     sees something useful instead of a blank bubble.
    if (!text || text.length < 2) {
      return "I'm here. What's on your mind?";
    }

    return text;
  }

  /**
   * Handle project-creation conversation flows without involving the LLM.
   *
   * Returns a string reply if the message clearly asks to create a project,
   * otherwise returns null and the caller falls through to the normal
   * model-based flow.
   *
   * Why we do this: the MiniMax-M2.7-highspeed model is heavily instruction-
   * tuned to dump structured lists ("Required: Name, Description, ...")
   * whenever a user asks to create a project. That's the opposite of what
   * users want — they want a natural chat, one question at a time. Rather
   * than fight the model's training with prompts, we own the conversation
   * for this specific intent.
   *
   * The conversation is short and deterministic:
   *   - First turn ("I want to create a project"): greet and ask the first
   *     question (project name + what it is).
   *   - Second turn (user replied with details): ask about the deadline /
   *     target date.
   *   - Third turn: ask about budget.
   *   - Fourth turn: confirm and create.
   */
  private handleProjectCreationConversation(
    dto: SendChatMessageDto,
    conversationId: string,
  ): string | null {
    const msg = dto.message.toLowerCase().trim();

    // Only trigger on the first user message. Once we've answered, the
    // next user messages are interpreted by the model (or routed to the
    // action path) so we don't lock the user into this scripted flow.
    const alreadyInFlow = (dto.history ?? []).some(
      (m) => m.role === 'assistant' && m.content.includes('project'),
    );
    if (alreadyInFlow) return null;

    const projectCreationTriggers = [
      'create a project',
      'new project',
      'start a project',
      'make a project',
      'i want to create',
      'want to start',
      'add a project',
      'create project',
      'launch a project',
      'set up a project',
      'open a project',
    ];

    const isProjectCreation = projectCreationTriggers.some((trigger) =>
      msg.includes(trigger),
    );

    if (!isProjectCreation) return null;

    return "Sure, I can help with that! What's the project called, and what kind of work is it?";
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
      `You are a friendly, helpful AI assistant who talks like a real person texting a colleague. Plain sentences only. No markdown, no bullet points, no dashes for lists, no bold, no headers. No internal reasoning. No <think> tags.

When the user wants to create a project, your reply must be EXACTLY in this conversational form:

"Sure, I can help with that! What kind of project — and what should I call it?"

Then stop. Wait for the user's answer. On the next turn, ask one more question (e.g., deadline or budget). Never dump a list of fields. Never use structured formatting. Just chat.

For all other questions, answer using the LIVE TENANT DATA below in plain conversational sentences. No structured output, no lists. If data is missing, say so directly.

When relevant, include a JSON block (no markdown fences) with keys: chartType, chartData [{label, value}].`;
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
    // Buffer chunks so we can strip `<think>...</think>` blocks that arrive
    // across multiple deltas. We accumulate until we see `</think>` (or the
    // stream ends), then flush the sanitized tail.
    let buffer = '';
    let insideThink = false;
    let thinkClosed = false;

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
      if (chunk.done) {
        // Flush whatever remains in the buffer through the sanitizer. If we
        // never closed the think block, the sanitizer will strip it.
        const cleaned = this.sanitizeReply(buffer);
        if (cleaned) yield { delta: cleaned, done: false };
        yield { delta: '', done: true };
        return;
      }

      buffer += chunk.delta;

      // Track think-block boundaries as they stream in.
      if (!thinkClosed) {
        const openMatch = buffer.match(/<think>/i);
        const closeMatch = buffer.match(/<\/think>/i);
        if (openMatch && closeMatch && closeMatch.index! >= openMatch.index!) {
          // Think block is complete within the buffer. Flush everything AFTER
          // the closing tag, sanitized.
          const tail = buffer.slice(closeMatch.index! + closeMatch[0].length);
          buffer = '';
          thinkClosed = true;
          const cleaned = this.sanitizeReply(tail);
          if (cleaned) yield { delta: cleaned, done: false };
        } else if (openMatch && !closeMatch) {
          // Inside the think block — drop everything up to (and including) the
          // opening tag.
          buffer = buffer.slice(openMatch.index! + openMatch[0].length);
          insideThink = true;
        } else if (!openMatch && buffer.length > 2048) {
          // No think tag detected and buffer is large — just flush it as-is
          // through the sanitizer (handles no-think responses).
          const flushed = this.sanitizeReply(buffer);
          buffer = '';
          thinkClosed = true;
          if (flushed) yield { delta: flushed, done: false };
        }
      } else {
        // Past the think block — yield raw deltas so the user sees them
        // streaming. The sanitizer runs on the final flush in the done chunk.
        yield { delta: chunk.delta, done: false };
      }
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
