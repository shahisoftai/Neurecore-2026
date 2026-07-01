/**
 * ExplainTool — Phase E (Weeks 23-24)
 *
 * Takes a query result (rows + aggregation + plan) and asks the LLM to write a
 * plain-English explanation: what does this data mean? what's interesting?
 * what should the user know?
 *
 * Actions:
 *   action='explain_rows'   → explain a list of rows (count, top values, anomalies)
 *   action='explain_aggregation' → explain a count/sum/avg result in context
 *
 * Typical flow with QueryTool:
 *   1. agent calls query(action='ask', question=...) → gets rows + count
 *   2. agent calls explain(action='explain_rows', rows=<those rows>, question=<same>)
 *   3. agent narrates the explanation to the user
 *
 * This tool is the "data explanation" layer the agent itself can fall back to,
 * but having it as a separate tool ensures: (a) consistent explanation format,
 * (b) deterministic comparison across questions, (c) results can be saved to
 * reports / shared without re-prompting the agent.
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

const MAX_ROWS_IN_PROMPT = 25;

export const ExplainInputSchema = z.object({
  action: z.enum(['explain_rows', 'explain_aggregation']).describe('Explanation mode'),

  // common
  question: z.string().optional().describe("Original question the data answers"),

  // explain_rows
  entity: z.string().optional().describe('Entity the rows come from (e.g., "task")'),
  rows: z.array(z.record(z.unknown())).optional()
    .describe('Rows to explain (explain_rows) — capped at 25 in the prompt'),
  totalCount: z.number().optional().describe('Total rows available (if rows are a sample)'),

  // explain_aggregation
  aggregation: z.record(z.union([z.string(), z.number()])).optional()
    .describe("Aggregation result, e.g. { count: 42 } or { sum: 1234, field: 'costCents' } (explain_aggregation)"),

  // control
  audience: z
    .enum(['executive', 'manager', 'analyst'])
    .optional()
    .describe('Audience for the explanation (default: manager)'),
  maxWords: z.number().int().positive().max(500).optional()
    .describe('Soft cap on explanation length (default 150)'),
});
export type ExplainInput = z.infer<typeof ExplainInputSchema>;

export const ExplainOutputSchema = z.object({
  action: z.string(),
  summary: z.string(),
  keyInsights: z.array(z.string()),
  recommendations: z.array(z.string()).optional(),
  tokensUsed: z.number().int().nonnegative().optional(),
});
export type ExplainOutput = z.infer<typeof ExplainOutputSchema>;

@Injectable()
export class ExplainTool extends BaseStructuredTool {
  readonly name = 'explain';
  readonly description =
    'Explain query results in plain English. ' +
    "action='explain_rows' takes rows + the original question and writes a narrative summary. " +
    "action='explain_aggregation' takes an aggregation result (count/sum/avg) and contextualizes it. " +
    'Pair with the query tool: first query, then explain. ' +
    'Useful for turning raw data into user-facing answers without the agent having to compose the prose itself.';
  readonly category = ToolCategory.AI;
  readonly inputSchema = ExplainInputSchema;
  readonly outputSchema = ExplainOutputSchema;
  readonly requiredPermissions = ['data:read'];

  constructor(private readonly llm: LLMFactory) {
    super();
  }

  protected async executeImpl(
    input: ExplainInput,
    _context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<ExplainOutput>> {
    try {
      switch (input.action) {
        case 'explain_rows':
          return await this.explainRows(input);
        case 'explain_aggregation':
          return await this.explainAggregation(input);
        default:
          return { success: false, error: `Unknown action: ${String(input.action)}` };
      }
    } catch (error) {
      this.logger.error(`ExplainTool failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Explanation failed',
      };
    }
  }

  // ─── explain_rows ────────────────────────────────────────────────────────

  private async explainRows(input: ExplainInput): Promise<StructuredToolResult<ExplainOutput>> {
    if (!input.rows) return { success: false, error: 'explain_rows requires rows' };

    const audience = input.audience ?? 'manager';
    const maxWords = input.maxWords ?? 150;
    const rowsSample = input.rows.slice(0, MAX_ROWS_IN_PROMPT);
    const totalCount = input.totalCount ?? input.rows.length;
    const isSampled = input.rows.length < totalCount;

    const schema = rowsSample[0] ? Object.keys(rowsSample[0]).join(', ') : '(empty)';
    const rowsJson = JSON.stringify(rowsSample, null, 2);

    const prompt = `You are a data analyst explaining query results to a ${audience}.

Original question: ${input.question ?? '(not provided)'}
Entity: ${input.entity ?? '(not specified)'}
Schema (field names): ${schema}
Returned rows: ${rowsSample.length}${isSampled ? ` (sampled from ${totalCount} total)` : ''}
Total matching rows in DB: ${totalCount}

Data:
\`\`\`json
${rowsJson}
\`\`\`

Write a response in plain English with:
1. A one-paragraph summary (≤${maxWords} words) — what's the answer to the question?
2. 2-5 key insights (bullet list) — patterns, outliers, notable values.
3. 0-3 recommendations (bullet list) — what should the reader consider doing?

Be specific. Use numbers from the data. Don't invent values that aren't in the rows.
Respond in valid JSON only — no markdown fences, no commentary outside the JSON.

Shape: { "summary": "...", "keyInsights": ["...", "..."], "recommendations": ["..."] }`;

    const response = await this.llm.invoke(prompt, { temperature: 0.3, maxTokens: 800 });
    const parsed = parseExplainResponse(response.content);

    return {
      success: true,
      data: {
        action: 'explain_rows',
        summary: parsed.summary,
        keyInsights: parsed.keyInsights,
        recommendations: parsed.recommendations,
        tokensUsed: response.usage?.totalTokens,
      },
      metadata: { model: 'explain-tool-v1' },
    };
  }

  // ─── explain_aggregation ─────────────────────────────────────────────────

  private async explainAggregation(
    input: ExplainInput,
  ): Promise<StructuredToolResult<ExplainOutput>> {
    if (!input.aggregation) return { success: false, error: 'explain_aggregation requires aggregation' };

    const audience = input.audience ?? 'manager';
    const maxWords = input.maxWords ?? 100;

    const prompt = `You are a data analyst explaining an aggregation result to a ${audience}.

Original question: ${input.question ?? '(not provided)'}
Aggregation result: ${JSON.stringify(input.aggregation)}

Write a response in plain English with:
1. A one-paragraph summary (≤${maxWords} words) — what does this number mean in context?
2. 1-3 key insights — interpretation, what stands out.
3. 0-2 recommendations.

Respond in valid JSON only — no markdown fences, no commentary outside the JSON.

Shape: { "summary": "...", "keyInsights": ["..."], "recommendations": ["..."] }`;

    const response = await this.llm.invoke(prompt, { temperature: 0.3, maxTokens: 500 });
    const parsed = parseExplainResponse(response.content);

    return {
      success: true,
      data: {
        action: 'explain_aggregation',
        summary: parsed.summary,
        keyInsights: parsed.keyInsights,
        recommendations: parsed.recommendations,
        tokensUsed: response.usage?.totalTokens,
      },
      metadata: { model: 'explain-tool-v1' },
    };
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

interface ParsedExplainResponse {
  summary: string;
  keyInsights: string[];
  recommendations?: string[];
}

function parseExplainResponse(text: string): ParsedExplainResponse {
  // Strip markdown fences if present
  let json = text.trim();
  const m = json.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (m) json = m[1];

  // Try direct parse, then brace-balanced extraction
  let parsed: ParsedExplainResponse;
  try {
    parsed = JSON.parse(json);
  } catch {
    const first = json.indexOf('{');
    if (first === -1) {
      return { summary: text.slice(0, 500), keyInsights: [] };
    }
    let depth = 0;
    let end = -1;
    for (let i = first; i < json.length; i++) {
      if (json[i] === '{') depth++;
      else if (json[i] === '}') {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }
    if (end === -1) {
      return { summary: text.slice(0, 500), keyInsights: [] };
    }
    parsed = JSON.parse(json.slice(first, end));
  }

  return {
    summary: String(parsed.summary ?? ''),
    keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights.map(String) : [],
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(String)
      : undefined,
  };
}