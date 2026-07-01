/**
 * ChatTool — Phase F (Weeks 27-28)
 *
 * Multi-turn, context-aware team chat. The agent calls this when a teammate
 * asks a question that needs company context (prior decisions, stored docs,
 * previous discussions). The tool:
 *
 *   1. Loads context (memory matches + Drive snippets + prior conversation turns)
 *   2. Assembles a system prompt with the context
 *   3. Calls the LLM with the assembled messages
 *   4. Stores both the user's question and the assistant's answer as MemoryEntry rows
 *      (type=LONG_TERM, metadata.role/conversationTopic) for future context pulls
 *
 * Actions:
 *   action='ask'     → ask a question; assembles context + calls LLM + stores turns
 *   action='remember' → explicitly store a fact/decision for future context
 *
 * Why this exists (alongside ContextTool):
 *   - ContextTool = "fetch context". ChatTool = "use it to answer + persist".
 *   - Separating read vs write keeps each tool simple and auditable.
 *   - Persistence uses the existing MemoryService so future agents find prior chats
 *     via the same vector search the rest of the system uses.
 */

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { LLMFactory } from '../../models/services/llm-factory.service';
import { MemoryService } from '../../memory/memory.service';
import { ContextTool } from './context.tool';
import { MemoryType } from '@prisma/client';

const HISTORY_TURNS = 10;
const HISTORY_MAX_CHARS = 1500;

export const ChatInputSchema = z.object({
  action: z.enum(['ask', 'remember']).describe('Chat action'),

  // ask
  question: z.string().min(1).optional().describe("User's question (ask)"),
  topic: z.string().optional().describe("Conversation topic key — groups turns for later retrieval (ask, default 'general')"),
  includeHistory: z.boolean().optional().describe("Load prior turns on the same topic (ask, default true)"),
  includeMemory: z.boolean().optional().describe("Semantic-search memory for matches (ask, default true)"),
  includeDrive: z.boolean().optional().describe("Snippet Drive docs (ask, default false — slower)"),
  systemPrompt: z.string().optional().describe("Override system prompt (ask, advanced)"),
  maxContextChars: z.number().int().positive().max(8000).optional().describe("Hard cap on combined context size (ask, default 4000)"),

  // remember
  content: z.string().min(1).optional().describe("Fact/decision to remember (remember)"),
  importance: z.number().min(0).max(1).optional().describe("Importance score 0-1 (remember, default 0.6)"),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

export const ChatOutputSchema = z.object({
  action: z.string(),
  answer: z.string().optional(),
  topic: z.string().optional(),
  question: z.string().optional(),
  contextUsed: z.object({
    memoryMatches: z.number().optional(),
    driveFiles: z.number().optional(),
    historyTurns: z.number().optional(),
    totalContextChars: z.number().optional(),
  }).optional(),
  storedTurnId: z.string().optional(),
  rememberedEntryId: z.string().optional(),
});
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

@Injectable()
export class ChatTool extends BaseStructuredTool {
  readonly name = 'chat';
  readonly description =
    'Context-aware team chat. ' +
    "action='ask' takes a teammate's question, loads relevant context (memory + history + optionally Drive), " +
    'calls the LLM with the assembled context, returns an answer, and persists the Q&A turn for future retrieval. ' +
    "action='remember' explicitly stores a fact/decision in long-term memory. " +
    "Use 'topic' to group related turns (e.g., 'q3-pricing', 'onboarding-flow'). " +
    'Past conversations become searchable context for the next teammate who asks.';
  readonly category = ToolCategory.AI;
  readonly inputSchema = ChatInputSchema;
  readonly outputSchema = ChatOutputSchema;
  readonly requiredPermissions = ['chat:read', 'chat:write'];

  constructor(
    private readonly llm: LLMFactory,
    private readonly memory: MemoryService,
    private readonly contextTool: ContextTool,
  ) {
    super();
  }

  protected async executeImpl(
    input: ChatInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<ChatOutput>> {
    const tenantId = context?.tenantId;
    const agentId = context?.agentId;
    if (!tenantId) return { success: false, error: 'Tenant context required' };

    try {
      if (input.action === 'remember') {
        return await this.remember(tenantId, agentId, input);
      }
      return await this.ask(tenantId, agentId, input);
    } catch (error) {
      this.logger.error(`ChatTool failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Chat failed',
      };
    }
  }

  // ─── ask ─────────────────────────────────────────────────────────────────

  private async ask(
    tenantId: string,
    agentId: string | undefined,
    input: ChatInput,
  ): Promise<StructuredToolResult<ChatOutput>> {
    if (!input.question) return { success: false, error: 'ask requires question' };

    const topic = input.topic ?? 'general';
    const maxContextChars = input.maxContextChars ?? 4000;
    let contextChars = 0;

    // 1. Load context in parallel
    const [memoryResult, historyResult, driveResult] = await Promise.all([
      input.includeMemory !== false
        ? this.contextTool.execute(
            { action: 'search_memory', query: input.question, limit: 5 },
            { tenantId, agentId },
          )
        : Promise.resolve(null),
      input.includeHistory !== false
        ? this.contextTool.execute(
            { action: 'load_history', topic, limit: HISTORY_TURNS },
            { tenantId, agentId },
          )
        : Promise.resolve(null),
      input.includeDrive
        ? this.contextTool.execute(
            { action: 'load_drive', folder: 'Documents', fileLimit: 5 },
            { tenantId, agentId },
          )
        : Promise.resolve(null),
    ]);

    // 2. Assemble context blocks
    const blocks: string[] = [];

    const memoryData = memoryResult?.data as { memory?: Array<{ content: string; summary?: string }> } | undefined;
    if (memoryData?.memory && memoryData.memory.length > 0) {
      const block = `Relevant prior memory:\n${memoryData.memory
        .map((m, i) => `${i + 1}. ${m.summary ?? m.content.slice(0, 200)}`)
        .join('\n')}`;
      if (contextChars + block.length <= maxContextChars) {
        blocks.push(block);
        contextChars += block.length;
      }
    }

    const historyData = historyResult?.data as { history?: Array<{ role: string; content: string }> } | undefined;
    if (historyData?.history && historyData.history.length > 0) {
      const block = `Recent conversation (topic: ${topic}):\n${historyData.history
        .map((h) => `${h.role.toUpperCase()}: ${h.content.slice(0, HISTORY_MAX_CHARS)}`)
        .join('\n')}`;
      if (contextChars + block.length <= maxContextChars) {
        blocks.push(block);
        contextChars += block.length;
      }
    }

    const driveData = driveResult?.data as { drive?: Array<{ name: string; snippet?: string }> } | undefined;
    if (driveData?.drive && driveData.drive.length > 0) {
      const block = `Relevant documents:\n${driveData.drive
        .map((d) => `- ${d.name}${d.snippet ? `: ${d.snippet.slice(0, 200)}` : ''}`)
        .join('\n')}`;
      if (contextChars + block.length <= maxContextChars) {
        blocks.push(block);
        contextChars += block.length;
      }
    }

    const systemPrompt =
      input.systemPrompt ??
      `You are a knowledgeable team member inside NeureCore. Answer the teammate's question using the company context provided below. If the context doesn't contain the answer, say so honestly and suggest what additional info would help.

${blocks.join('\n\n')}

Be specific. Cite sources when possible (memory entries, document names, past turns).`;

    // 3. Call LLM
    const response = await this.llm.invoke(systemPrompt + '\n\nQuestion: ' + input.question, {
      temperature: 0.4,
      maxTokens: 700,
    });
    const answer = response.content.trim();

    // 4. Persist turns
    const userEntry = await this.memory.store({
      tenantId,
      agentId,
      type: MemoryType.LONG_TERM,
      content: input.question,
      summary: input.question.slice(0, 100),
      importance: 0.5,
      metadata: { role: 'user', conversationTopic: topic },
    } as never);

    const assistantEntry = await this.memory.store({
      tenantId,
      agentId,
      type: MemoryType.LONG_TERM,
      content: answer,
      summary: answer.slice(0, 100),
      importance: 0.5,
      metadata: { role: 'assistant', conversationTopic: topic, inReplyTo: (userEntry as { id: string }).id },
    } as never);

    return {
      success: true,
      data: {
        action: 'ask',
        answer,
        topic,
        question: input.question,
        contextUsed: {
          memoryMatches: memoryData?.memory?.length ?? 0,
          driveFiles: driveData?.drive?.length ?? 0,
          historyTurns: historyData?.history?.length ?? 0,
          totalContextChars: contextChars,
        },
        storedTurnId: (assistantEntry as { id: string }).id,
      },
      metadata: { model: 'chat-tool-v1' },
    };
  }

  // ─── remember ────────────────────────────────────────────────────────────

  private async remember(
    tenantId: string,
    agentId: string | undefined,
    input: ChatInput,
  ): Promise<StructuredToolResult<ChatOutput>> {
    if (!input.content) return { success: false, error: 'remember requires content' };

    const entry = await this.memory.store({
      tenantId,
      agentId,
      type: MemoryType.LONG_TERM,
      content: input.content,
      summary: input.content.slice(0, 120),
      importance: input.importance ?? 0.6,
      metadata: { source: 'explicit-remember' },
    } as never);

    return {
      success: true,
      data: {
        action: 'remember',
        rememberedEntryId: (entry as { id: string }).id,
      },
      metadata: { model: 'chat-tool-v1' },
    };
  }
}