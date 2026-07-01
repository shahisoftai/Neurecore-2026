import { Injectable } from '@nestjs/common';
import type {
  ITool,
  ToolInput,
  ToolOutput,
} from '../interfaces/tool.interface';

/**
 * HttpRequestTool — executes an outbound HTTP GET/POST call.
 * Implements ITool so it can be registered alongside any other tool.
 */
@Injectable()
export class HttpRequestTool implements ITool {
  readonly name = 'http_request';
  readonly description = 'Sends an HTTP request to a given URL';
  readonly category = 'API';

  validate(input: ToolInput): boolean {
    return typeof input['url'] === 'string' && input['url'].length > 0;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    if (!this.validate(input)) {
      return { success: false, error: 'Missing required field: url' };
    }

    const url = input['url'] as string;
    const method = (input['method'] as string | undefined) ?? 'GET';
    const body = input['body'] as string | undefined;

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data: unknown = await response.json().catch(() => response.text());
      return { success: response.ok, data };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }
}
