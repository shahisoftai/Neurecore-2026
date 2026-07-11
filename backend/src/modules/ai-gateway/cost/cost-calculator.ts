/**
 * Cost Calculator (pure)
 *
 * `costPer1kInput` and `costPer1kOutput` on `AiModel` are stored in USD
 * per 1K tokens. The `CostRecord.costCents` column is integer cents.
 *
 * Formula: `cents = (tokens / 1000) * rate_usd * 100`.
 *
 * SOLID: SRP — pure function, no IO. Reused by the test suite.
 */

export interface CostInputs {
  provider: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
}

export function computeCostCents(input: CostInputs): number {
  const inCents = (input.inputTokens / 1000) * input.costPer1kInput * 100;
  const outCents = (input.outputTokens / 1000) * input.costPer1kOutput * 100;
  return Math.max(0, Math.round((inCents + outCents) * 100) / 100);
}
