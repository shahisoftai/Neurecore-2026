import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { LLMFactory } from '../../models/services/llm-factory.service';
import type {
  IConversationIntelligence,
  ConversationSummary,
  SearchParams,
  SummarizeParams,
  AskParams,
} from '../interfaces/IConversationIntelligence';
import type { HermesMessageData } from '../interfaces/hermes-session.interface';
import { CONVERSATION_INTELLIGENCE } from '../interfaces/IConversationIntelligence';
import { FeatureFlagService } from '../../../common/feature-flag/feature-flag.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';

@Injectable()
export class ConversationIntelligenceService implements IConversationIntelligence {
  private readonly logger = new Logger(ConversationIntelligenceService.name);
  private readonly CHUNK_SIZE = 50_000;
  private readonly MAX_INPUT_CHARS = 480_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmFactory: LLMFactory,
    @Optional() private readonly featureFlags?: FeatureFlagService,
    @Optional() private readonly aiGateway?: AiGatewayService,
  ) {}

  async summarize(params: SummarizeParams): Promise<ConversationSummary> {
    const [messages, decisions] = await Promise.all([
      this.prisma.hermesMessage.findMany({
        where: {
          session: {
            hermesAgentId: params.participantId,
            tenantId: params.tenantId,
          },
          createdAt: { gte: params.from, lte: params.to },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.hermesAuditLog.findMany({
        where: {
          hermesAgentId: params.participantId,
          tenantId: params.tenantId,
          createdAt: { gte: params.from, lte: params.to },
        },
      }),
    ]);

    const contextStr = this.buildContextString(messages, decisions);

    let narrative: string;
    if (contextStr.length < this.MAX_INPUT_CHARS) {
      narrative = await this.invokeSummary(contextStr);
    } else {
      const chunks = this.chunkString(contextStr, this.CHUNK_SIZE);
      const chunkSummaries = await Promise.all(
        chunks.map((c) => this.invokeSummary(c)),
      );
      narrative = await this.invokeSummary(
        chunkSummaries
          .map((s, i) => `[Chunk ${i + 1}/${chunks.length}]: ${s}`)
          .join('\n'),
      );
    }

    return {
      period: { from: params.from, to: params.to },
      participantId: params.participantId,
      participantType: params.participantType,
      totalMessages: messages.length,
      totalDecisions: decisions.length,
      keyTopics: this.extractTopics(narrative),
      actionItems: this.extractActionItems(narrative),
      narrative,
    };
  }

  async search(
    params: SearchParams,
  ): Promise<Array<{ message: HermesMessageData; score: number }>> {
    const limit = Math.min(50, Math.max(1, params.limit ?? 10));
    const messages = await this.prisma.hermesMessage.findMany({
      where: {
        session: { tenantId: params.tenantId },
        content: { contains: params.query, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.map((m) => ({
      message: {
        id: m.id,
        sessionId: m.sessionId,
        threadId: m.threadId ?? null,
        role: m.role,
        content: m.content,
        metadata: (m.metadata as Record<string, unknown>) ?? undefined,
        toolCalls: m.toolCalls ?? undefined,
        toolResults: m.toolResults ?? undefined,
        error: m.error ?? undefined,
        createdAt: m.createdAt,
      },
      score: 1,
    }));
  }

  async ask(params: AskParams): Promise<{ answer: string; sources: string[] }> {
    // Phase 9d §16.4.3 — if scoped to a department, walk OPERATES_IN edges
    // from the department to its agents and restrict the message retrieval
    // to those agents.
    let agentIds: string[] | undefined;
    if (params.scopeDepartmentId) {
      const edges = await this.prisma.entityRelationship.findMany({
        where: {
          tenantId: params.tenantId,
          fromType: 'DEPARTMENT',
          fromId: params.scopeDepartmentId,
          type: 'OPERATES_IN',
        },
        select: { toId: true },
      });
      agentIds = edges.map((e) => e.toId);
      if (agentIds.length === 0) {
        return {
          answer:
            'No agents are currently assigned to that department. Ask a broader question or assign agents first.',
          sources: [],
        };
      }
    }

    const messages = await this.prisma.hermesMessage.findMany({
      where: {
        session: {
          tenantId: params.tenantId,
          ...(agentIds ? { hermesAgentId: { in: agentIds } } : {}),
        },
        content: { contains: params.question, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const context = messages.map((m) => `[${m.role}] ${m.content}`).join('\n');
    const answer = await this.invokeSummary(
      `Based on the following context, answer the question.\n\nContext:\n${context}\n\nQuestion: ${params.question}`,
    );
    return { answer, sources: messages.map((m) => m.id) };
  }

  private buildContextString(
    messages: Array<{ role: string; content: string }>,
    decisions: Array<{
      action: string;
      decision: string | null;
      reason: string | null;
    }>,
  ): string {
    const msgLines = messages.map((m) => `[${m.role}] ${m.content}`);
    const decLines = decisions.map(
      (d) => `[DECISION ${d.action}] ${d.decision ?? ''} ${d.reason ?? ''}`,
    );
    return [...msgLines, ...decLines].join('\n');
  }

  private async invokeSummary(text: string): Promise<string> {
    try {
      const prompt = `Summarize the following conversation/decision log in 3-5 paragraphs. Include key decisions, action items, and outcomes.\n\n${text}`;
      if (this.featureFlags?.isEnabled('AI_GATEWAY_V2') && this.aiGateway) {
        const r = await this.aiGateway.invoke({
          // Conversation intelligence is a reasoning task; the gateway
          // routes by `reasoning` capability.
          tenantId: null,
          capability: 'reasoning',
          prompt,
          sourceModule: 'conversation-intelligence',
          temperature: 0.2,
          maxTokens: 600,
        });
        return r.content;
      }
      const result = await this.llmFactory.invoke(prompt, {
        temperature: 0.2,
        maxTokens: 600,
      });
      return result.content;
    } catch (err) {
      this.logger.warn(`invokeSummary failed: ${String(err)}`);
      return text.slice(0, 1000);
    }
  }

  private chunkString(text: string, maxSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += maxSize) {
      chunks.push(text.slice(i, i + maxSize));
    }
    return chunks;
  }

  private extractTopics(narrative: string): string[] {
    const matches = narrative.match(/(?:Topics?:?\s*)([^\n]+)/gi) ?? [];
    const result: string[] = [];
    for (const m of matches) {
      result.push(m.replace(/^Topics?:?\s*/i, '').trim());
    }
    return result.slice(0, 5);
  }

  private extractActionItems(narrative: string): string[] {
    const matches = narrative.match(/(?:Action items?:?\s*)([^\n]+)/gi) ?? [];
    const result: string[] = [];
    for (const m of matches) {
      result.push(m.replace(/^Action items?:?\s*/i, '').trim());
    }
    return result.slice(0, 5);
  }
}

export { CONVERSATION_INTELLIGENCE };
