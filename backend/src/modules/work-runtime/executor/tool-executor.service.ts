/**
 * ToolExecutor — validates input, invokes a registered tool, enforces timeout,
 * classifies retryable vs non-retryable failures (ADR-003 §13). It does not
 * decide governance and never runs an unregistered tool.
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  RuntimeTool,
  RuntimeToolResult,
  ToolContext,
} from '../contracts/work-runtime.interface';

@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);

  async execute(
    tool: RuntimeTool,
    input: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<RuntimeToolResult> {
    // Input validation is a non-retryable failure.
    try {
      tool.validateInput(input);
    } catch (e) {
      return {
        ok: false,
        errorCode: 'INVALID_INPUT',
        errorMessage: e instanceof Error ? e.message : String(e),
        retryable: false,
      };
    }

    try {
      const result = await this.withTimeout(
        tool.execute(input, ctx),
        tool.timeoutMs,
        tool.name,
      );
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const timedOut = /timed out/.test(msg);
      const notFound = /not found/i.test(msg);
      return {
        ok: false,
        errorCode: timedOut ? 'TOOL_TIMEOUT' : notFound ? 'NOT_FOUND' : 'TOOL_ERROR',
        errorMessage: msg,
        // Timeouts are retryable; not-found / business errors are not.
        retryable: timedOut,
      };
    }
  }

  private async withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`tool ${label} timed out after ${ms}ms`)), ms);
      if (typeof timer === 'object' && timer && 'unref' in timer) {
        (timer as { unref: () => void }).unref();
      }
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }
}
