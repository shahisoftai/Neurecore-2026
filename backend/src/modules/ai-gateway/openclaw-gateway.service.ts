/**
 * OpenClaw Gateway Service
 *
 * Handles communication with OpenClaw-enabled AI agents.
 * Supports request/response pattern with automatic retry and tracing.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  type OpenClawConfig,
  OPENCLAW_CONFIG,
} from './openclaw-gateway.tokens';
import { LangSmithTracingService } from './langsmith-tracing.service';

export interface AgentMessage {
  id: string;
  agentId: string;
  action: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface AgentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  traceId?: string;
}

@Injectable()
export class OpenClawGatewayService {
  private readonly logger = new Logger(OpenClawGatewayService.name);

  constructor(
    @Inject(OPENCLAW_CONFIG) private readonly config: OpenClawConfig,
    private readonly tracingService: LangSmithTracingService,
  ) {}

  /**
   * Send a message to an AI agent via OpenClaw protocol
   */
  async sendMessage(
    agentId: string,
    action: string,
    payload: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): Promise<AgentResponse> {
    const traceId = uuidv4();
    const message: AgentMessage = {
      id: uuidv4(),
      agentId,
      action,
      payload,
      metadata: {
        ...metadata,
        traceId,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    const span = this.tracingService.startSpan({
      name: `openclaw.${action}`,
      metadata: {
        agentId,
        traceId,
        messageId: message.id,
      },
    });

    try {
      const response = await this.executeWithRetry(message, span?.id);

      this.tracingService.endSpan(span?.id, {
        success: true,
        metadata: { responseSize: JSON.stringify(response).length },
      });

      return {
        success: true,
        data: response,
        traceId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.tracingService.endSpan(span?.id, {
        success: false,
        error: errorMessage,
      });

      this.logger.error(
        `OpenClaw message failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        success: false,
        error: errorMessage,
        traceId,
      };
    }
  }

  /**
   * Stream responses from an AI agent
   */
  async *streamMessage(
    agentId: string,
    action: string,
    payload: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): AsyncGenerator<AgentResponse> {
    const traceId = uuidv4();
    const message: AgentMessage = {
      id: uuidv4(),
      agentId,
      action,
      payload,
      metadata: {
        ...metadata,
        traceId,
        stream: true,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    const span = this.tracingService.startSpan({
      name: `openclaw.${action}.stream`,
      metadata: {
        agentId,
        traceId,
        messageId: message.id,
      },
    });

    try {
      const response = await fetch(
        `${this.config.endpoint}/agents/${agentId}/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
            'X-Trace-Id': traceId,
          },
          body: JSON.stringify(message),
        },
      );

      if (!response.ok) {
        throw new Error(`OpenClaw API error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield { success: true, data: null, traceId };
              return;
            }
            try {
              const parsed: unknown = JSON.parse(data);
              yield {
                success: true,
                data: parsed,
                traceId,
              };
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      this.tracingService.endSpan(span?.id, { success: true });
      yield { success: true, data: null, traceId };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.tracingService.endSpan(span?.id, {
        success: false,
        error: errorMessage,
      });
      yield { success: false, error: errorMessage, traceId };
    }
  }

  /**
   * Execute request with automatic retry
   */
  private async executeWithRetry(
    message: AgentMessage,
    parentTraceId?: string,
  ): Promise<unknown> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          'X-Trace-Id':
            parentTraceId ?? (message.metadata?.traceId as string) ?? '',
        };

        const response = await fetch(
          `${this.config.endpoint}/agents/${message.agentId}/messages`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(message),
            signal: AbortSignal.timeout(this.config.timeout),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `OpenClaw API error: ${response.status} ${errorText}`,
          );
        }

        const data: unknown = await response.json();
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on certain errors
        if (error instanceof TypeError && error.message.includes('abort')) {
          throw lastError;
        }

        this.logger.warn(
          `OpenClaw request failed (attempt ${attempt + 1}/${this.config.retryAttempts}): ${lastError.message}`,
        );

        // Exponential backoff
        if (attempt < this.config.retryAttempts - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 100),
          );
        }
      }
    }

    throw lastError ?? new Error('OpenClaw request failed after retries');
  }

  /**
   * Check if OpenClaw gateway is configured
   */
  isConfigured(): boolean {
    return this.config.apiKey.length > 0;
  }
}
