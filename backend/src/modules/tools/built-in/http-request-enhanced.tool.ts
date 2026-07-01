/**
 * Enhanced HTTP Request Tool with Structured Output
 *
 * Demonstrates the @Tool decorator pattern for making HTTP requests
 * with Zod schema validation.
 */

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';

// Input schema for the HTTP request tool
export const HttpRequestInputSchema = z.object({
  url: z.string().url().describe('The URL to send the request to'),
  method: z
    .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
    .default('GET')
    .describe('HTTP method'),
  headers: z.record(z.string()).optional().describe('Request headers'),
  body: z
    .unknown()
    .optional()
    .describe('Request body (will be JSON stringified)'),
  timeout: z
    .number()
    .int()
    .positive()
    .max(30000)
    .default(10000)
    .optional()
    .describe('Request timeout in ms'),
});

export type HttpRequestInput = z.infer<typeof HttpRequestInputSchema>;

// Output schema for the HTTP request tool
export const HttpRequestOutputSchema = z.object({
  status: z.number().describe('HTTP status code'),
  statusText: z.string().describe('HTTP status text'),
  headers: z.record(z.string()).describe('Response headers'),
  body: z.unknown().describe('Response body'),
  durationMs: z.number().describe('Request duration in milliseconds'),
  size: z.number().describe('Response size in bytes'),
});

export type HttpRequestOutput = z.infer<typeof HttpRequestOutputSchema>;

/**
 * Enhanced HTTP Request Tool
 *
 * Features:
 * - Zod schema validation for inputs and outputs
 * - Support for all HTTP methods
 * - Custom headers and body
 * - Timeout control
 * - Detailed structured output with timing info
 */
@Injectable()
export class HttpRequestEnhancedTool extends BaseStructuredTool {
  readonly name = 'http_request';
  readonly description =
    'Make HTTP requests to external APIs. Supports GET, POST, PUT, DELETE, and PATCH methods with custom headers and body.';
  readonly category = ToolCategory.API;
  readonly inputSchema = HttpRequestInputSchema;
  readonly outputSchema = HttpRequestOutputSchema;

  protected async executeImpl(
    input: HttpRequestInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<HttpRequestOutput>> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        input.timeout ?? 10000,
      );

      const fetchOptions: RequestInit = {
        method: input.method,
        headers: {
          'Content-Type': 'application/json',
          ...input.headers,
        },
        signal: controller.signal,
      };

      if (input.body && ['POST', 'PUT', 'PATCH'].includes(input.method)) {
        fetchOptions.body = JSON.stringify(input.body);
      }

      const response = await fetch(input.url, fetchOptions);
      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let responseBody: unknown;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        responseBody = await response.json();
      } else if (contentType.includes('text/')) {
        responseBody = await response.text();
      } else {
        responseBody = await response.blob();
      }

      const responseText =
        typeof responseBody === 'string'
          ? responseBody
          : JSON.stringify(responseBody);

      const output: HttpRequestOutput = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        durationMs: Date.now() - startTime,
        size: new TextEncoder().encode(responseText).length,
      };

      // Validate output against schema
      const validation = this.outputSchema.safeParse(output);
      if (!validation.success) {
        return {
          success: false,
          error: `Output validation failed: ${validation.error.message}`,
        };
      }

      return {
        success: true,
        data: output,
        metadata: {
          durationMs: output.durationMs,
          model: 'http-request-v1',
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: `Request timeout after ${input.timeout ?? 10000}ms`,
          };
        }
        return {
          success: false,
          error: `Request failed: ${error.message}`,
        };
      }
      return {
        success: false,
        error: 'Unknown error occurred',
      };
    }
  }
}
