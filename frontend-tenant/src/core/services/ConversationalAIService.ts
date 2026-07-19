// ─── ConversationalAIService.ts ───────────────────────────────────────────────
// SRP: Manages chat sessions + message exchange with the backend AI endpoint.
// DIP: Depends on IApiClient, IConversationalAIService — no direct fetch calls.
// OCP: Context enrichment open for extension via ConversationContext shape.

import type {
  IConversationalAIService,
  ChatMessage,
  ChatMessageMetadata,
  ConversationContext,
} from "@/core/services/interfaces/IConversationalAIService";
import { restClient } from "@/core/services/api/clients/RestClient";

const API_ENDPOINT = "/ai/chat";
const STORAGE_KEY = "hq_ai_chat_history";
let _msgId = 0;
const genId = () => `msg_${Date.now()}_${++_msgId}`;

const SYSTEM_PROMPT = `You are a helpful and friendly AI assistant. You chat naturally with the user — no lists, no headers, no "here's what I found", no thinking process shown. Just speak as a person would.

When the user asks about company operations, agent performance, workflows, or tasks, give a direct, friendly answer in plain language. If you have data to share, mention it naturally in the conversation.

IMPORTANT — Project creation flow:
If the user wants to create a project, lead a natural conversation to gather information. Ask ONE question at a time. Wait for the answer. Then ask the next question.

Example conversation:
User: "I want to start a new project for our client"
Assistant: "Sure! What's the project called — and what kind of work is it? Just a brief description helps."
User: "It's an annual audit for BlueStar Corp"
Assistant: "Got it, BlueStar Corp annual audit. What's the deadline — do you have a target date in mind?"
User: "End of Q3"
Assistant: "Perfect. And what's the budget for this engagement — ballpark is fine to start."
User: "Around $75,000 fixed fee"
Assistant: "Great, I have enough to get started. Let me create that project now."

Keep responses short — one or two sentences when possible.
When relevant, include a JSON block (no markdown) with keys: chartType, chartData [{label, value}].`;

export class ConversationalAIService implements IConversationalAIService {
  private history: ChatMessage[] = [];
  private conversationId: string | null = null;

  constructor() {
    this._loadFromStorage();
  }

  isAvailable(): boolean {
    return typeof window !== "undefined";
  }

  private _loadFromStorage(): void {
    if (typeof sessionStorage === "undefined") return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        history?: ChatMessage[];
        conversationId?: string | null;
      };
      if (Array.isArray(data.history)) this.history = data.history;
      if (typeof data.conversationId === "string" || data.conversationId === null) {
        this.conversationId = data.conversationId;
      }
    } catch {
      // ignore corrupted storage
    }
  }

  private _saveToStorage(): void {
    if (typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          history: this.history,
          conversationId: this.conversationId,
        }),
      );
    } catch {
      // ignore quota exceeded
    }
  }

  // ─── IMessageSender ───────────────────────────────────────────────────────

  async sendMessage(
    message: string,
    context?: ConversationContext,
  ): Promise<ChatMessage> {
    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };
    this.history.push(userMsg);
    this._saveToStorage();

    try {
      const response = await restClient.post<{
        reply: string;
        conversationId: string;
        chartType?: ChatMessageMetadata["chartType"];
        chartData?: ChatMessageMetadata["chartData"];
        suggestions?: string[];
      }>(API_ENDPOINT, {
        message,
        conversationId: this.conversationId,
        context: context ?? {},
        systemPrompt: SYSTEM_PROMPT,
        history: this.history.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const apiData = response.data;

      if (apiData?.reply) {
        this.conversationId = apiData.conversationId ?? this.conversationId;
        const { cleanedReply, ...metadata } = this._parseMetadata(
          apiData.reply,
          apiData.chartType ?? apiData.chartData ?? apiData.suggestions
            ? {
                chartType: apiData.chartType,
                chartData: apiData.chartData,
                suggestions: apiData.suggestions,
              }
            : null,
        );
        const assistantMsg: ChatMessage = {
          id: genId(),
          role: "assistant",
          content: cleanedReply,
          timestamp: new Date().toISOString(),
          metadata,
        };
        this.history.push(assistantMsg);
        this._saveToStorage();
        return assistantMsg;
      }

      throw new Error("Empty reply from chat backend");
    } catch (err) {
      console.warn("[ConversationalAIService] Chat request failed:", err);
      const fallback = this._fallbackReply(message);
      const assistantMsg: ChatMessage = {
        id: genId(),
        role: "assistant",
        content: fallback,
        timestamp: new Date().toISOString(),
      };
      this.history.push(assistantMsg);
      this._saveToStorage();
      return assistantMsg;
    }
  }

  // ─── IConversationHistory ─────────────────────────────────────────────────

  getHistory(): ChatMessage[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    this.conversationId = null;
    this._saveToStorage();
  }

  getConversationId(): string | null {
    return this.conversationId;
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _parseMetadata(
    reply: string,
    apiData?: Partial<Pick<ChatMessageMetadata, "chartType" | "chartData" | "suggestions">> | null,
  ): ChatMessageMetadata & { cleanedReply: string } {
    let cleanedReply = reply;

    // Extract embedded JSON by finding the first '{' that begins a chart block
    // and matching braces to the closing '}'. Previous regex /\{[\s\S]*?"chartType"[\s\S]*?\}/
    // was non-greedy and stopped at the first inner '}' (inside chartData items),
    // which produced invalid JSON and left the raw text in the bubble.
    const extracted = this._extractFirstJsonObject(reply);
    if (extracted && /"chartType"\s*:/.test(extracted)) {
      try {
        const parsed = JSON.parse(extracted) as Record<string, unknown>;
        if (parsed.chartType) {
          cleanedReply = reply.replace(extracted, "").trim();
          return {
            cleanedReply,
            chartType: parsed.chartType as ChatMessageMetadata["chartType"],
            chartData:
              (parsed.chartData as ChatMessageMetadata["chartData"]) ?? [],
            suggestions: (apiData?.suggestions as string[]) ?? [],
          };
        }
      } catch (err) {
        console.warn("[ConversationalAIService] Failed to parse chart JSON:", err);
        /* fall through */
      }
    }

    return {
      cleanedReply,
      chartType: apiData?.chartType,
      chartData: apiData?.chartData,
      suggestions: apiData?.suggestions ?? this._inferSuggestions(reply),
    };
  }

  /**
   * Find the first balanced {...} block in `text`. Returns the JSON string
   * (including the outer braces) or null if no balanced block is found.
   *
   * The reply may look like:
   *   "...summary text.\n\n{\n  \"chartType\": \"pie\",\n  \"chartData\": [\n    {...}, ...\n  ]\n}"
   * and a naive /\{.*?\}/ regex would stop at the first inner '}'.
   */
  private _extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf("{");
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === "\\") {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) {
          return text.substring(start, i + 1);
        }
      }
    }
    return null;
  }

  /** Rule-based offline fallback — when API is unavailable */
  private _fallbackReply(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes("revenue") || lower.includes("sales"))
      return "I'm unable to access live data right now. Check the Analytics page for revenue insights.";
    if (lower.includes("agent"))
      return "Head to the Agents page to review agent status and performance metrics.";
    if (lower.includes("task"))
      return "Open the Tasks page to review pending and in-progress tasks across all agents.";
    if (lower.includes("workflow"))
      return "The Workflows page shows all active process flows and their current status.";
    return "I'm currently offline. Please check your connection and try again.";
  }

  private _inferSuggestions(reply: string): string[] {
    const suggestions: string[] = [];
    if (reply.includes("agent")) suggestions.push("Show me all agents");
    if (reply.includes("task")) suggestions.push("Show pending tasks");
    if (reply.includes("revenue")) suggestions.push("Open analytics");
    return suggestions.slice(0, 3);
  }
}

export const conversationalAIService = new ConversationalAIService();
