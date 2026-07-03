export function generateTraceId(prefix = 'hermes'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${random}`;
}

export function formatCostUsd(costUsd: number): string {
  return `$${costUsd.toFixed(6)}`;
}

export function calculateCostEstimate(
  promptTokens: number,
  completionTokens: number,
  modelPrices?: { promptPer1k: number; completionPer1k: number },
): number {
  const prices = modelPrices ?? { promptPer1k: 0.00015, completionPer1k: 0.0006 };
  const promptCost = (promptTokens / 1000) * prices.promptPer1k;
  const completionCost = (completionTokens / 1000) * prices.completionPer1k;
  return promptCost + completionCost;
}

export function truncateForContext(
  text: string,
  maxTokens: number,
  charsPerToken = 4,
): string {
  const maxChars = maxTokens * charsPerToken;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + '... [truncated]';
}

export function buildHermesSystemPrompt(
  agentType: string,
  agentName: string,
  agentDescription: string,
  customPrompt?: string,
): string {
  const base = [
    `You are ${agentName}, a specialized ${agentType} AI agent in the NeureCore platform.`,
    `Your role: ${agentDescription}`,
    '',
    'Core directives:',
    '1. Execute assigned tasks accurately and efficiently',
    '2. Use available tools when appropriate — do not fabricate tool results',
    '3. Always respect tenant isolation — data is scoped to the current tenant',
    '4. If an action requires approval, clearly indicate this and await confirmation',
    '5. When uncertain, ask for clarification rather than guessing',
    '6. Log significant decisions and tool usage for audit purposes',
    '',
    'Response format:',
    '- Provide clear, structured responses',
    '- When executing tools, explain what you are doing',
    '- Include relevant context but be concise',
    '- Mark any approval-required actions explicitly',
  ];

  if (customPrompt) {
    base.push('', '--- Additional Instructions ---', customPrompt);
  }

  return base.join('\n');
}

export function parseMemoryContext(
  entries: Array<{
    content: string;
    type: string;
    importance: number;
    summary?: string | null;
  }>,
  maxTokens = 4000,
): string {
  const sorted = [...entries].sort(
    (a, b) => b.importance - a.importance,
  );

  const lines: string[] = [];
  let tokenEstimate = 0;

  for (const entry of sorted) {
    const text = entry.summary ?? entry.content;
    const tokens = Math.ceil(text.length / 4);
    if (tokenEstimate + tokens > maxTokens) break;

    const typeLabel =
      entry.type === 'PERSONAL'
        ? 'Knowledge'
        : entry.type === 'EPISODIC'
          ? 'Episode'
          : 'Procedure';

    lines.push(`[${typeLabel}] ${text}`);
    tokenEstimate += tokens;
  }

  return lines.join('\n');
}

export function sanitizeToolInput(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      typeof value === 'string' &&
      value.length > 10000
    ) {
      sanitized[key] = value.substring(0, 10000) + '... [truncated]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
