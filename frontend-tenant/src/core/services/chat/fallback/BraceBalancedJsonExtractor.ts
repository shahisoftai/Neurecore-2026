// ─── BraceBalancedJsonExtractor.ts ──────────────────────────────────────────────
// SRP: Extracts the first balanced JSON object {...} from arbitrary text.
// Extracted from ConversationalAIService._extractFirstJsonObject().
//
// Handles nested braces, strings containing braces, and escaped quotes.
// Used to parse chart data embedded by LLM inside reply text.

import type { IJsonExtractor } from '@/core/services/interfaces/IChatService';

export class BraceBalancedJsonExtractor implements IJsonExtractor {
  extract(text: string): { cleaned: string; chartType?: string; chartData?: unknown[] } | null {
    const jsonStr = this._extractBalancedBlock(text);
    if (!jsonStr || !/"chartType"\s*:/.test(jsonStr)) return null;

    try {
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
      if (!parsed.chartType) return null;

      const cleaned = text.replace(jsonStr, '').trim();
      return {
        cleaned,
        chartType: parsed.chartType as string,
        chartData: parsed.chartData as unknown[],
      };
    } catch {
      return null;
    }
  }

  private _extractBalancedBlock(text: string): string | null {
    const start = text.indexOf('{');
    if (start < 0) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return text.substring(start, i + 1);
        }
      }
    }

    return null;
  }
}
