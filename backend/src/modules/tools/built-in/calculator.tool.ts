import { Injectable } from '@nestjs/common';
import type {
  ITool,
  ToolInput,
  ToolOutput,
} from '../interfaces/tool.interface';

/**
 * CalculatorTool — evaluates simple arithmetic expressions.
 * Demonstrates OCP: new tools can be added without modifying ToolsService.
 */
@Injectable()
export class CalculatorTool implements ITool {
  readonly name = 'calculator';
  readonly description = 'Evaluates basic arithmetic expressions (+,-,*,/)';
  readonly category = 'CALCULATION';

  validate(input: ToolInput): boolean {
    return typeof input['expression'] === 'string';
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    if (!this.validate(input)) {
      return { success: false, error: 'Missing required field: expression' };
    }

    const expression = input['expression'] as string;

    // Allow only safe characters
    if (!/^[\d\s+\-*/().,]+$/.test(expression)) {
      return { success: false, error: 'Expression contains unsafe characters' };
    }

    try {
      // Using Function here to evaluate a sanitized arithmetic expression.
      // This is intentionally limited to numbers and operators; disable the implied-eval rule for this line.

      const result = Function(
        `"use strict"; return (${expression})`,
      )() as unknown;
      return { success: true, data: result };
    } catch {
      return { success: false, error: 'Expression evaluation failed' };
    }
  }
}
