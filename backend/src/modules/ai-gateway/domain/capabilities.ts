/**
 * AI Gateway — Capability enum
 *
 * The single source of truth for "what is a model being asked to do".
 * Adding a new capability requires a database row in `ai_models.capabilities`
 * and (optionally) a new entry in the fallback chain map.
 *
 * SOLID: ISP — consumers depend on the small Capability union, not on
 * the broader gateway interface.
 */

export const CAPABILITIES = [
  'planning',
  'execution',
  'reasoning',
  'conversation',
  'coding',
  'tools',
  'evaluation',
  'embedding',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export function isCapability(value: unknown): value is Capability {
  return (
    typeof value === 'string' &&
    (CAPABILITIES as readonly string[]).includes(value)
  );
}

/**
 * Hardcoded fallback chain per capability (PR 2.2).
 * The order is the priority: index 0 is the default; subsequent entries
 * are tried in order when the previous model is unavailable (circuit open,
 * context length exceeded, budget exceeded).
 *
 * SOLID: OCP — adding a new capability means adding a new entry here.
 */
const FALLBACK_CHAINS_DATA: Record<Capability, readonly string[]> = {
  conversation: ['MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-Text-01'],
  planning: ['gpt-4o-mini', 'MiniMax-M2.7-highspeed', 'deepseek-chat'],
  execution: ['gpt-4o-mini', 'MiniMax-M2.7-highspeed', 'deepseek-reasoner'],
  evaluation: ['gpt-4o-mini', 'MiniMax-M2.7-highspeed', 'deepseek-chat'],
  coding: ['deepseek-coder', 'MiniMax-M2.7-highspeed'],
  reasoning: ['deepseek-reasoner', 'MiniMax-M2.7-highspeed', 'gpt-4o-mini'],
  tools: ['gpt-4o-mini', 'MiniMax-M2.7-highspeed'],
  embedding: ['text-embedding-3-small'],
};

export const ALL_FALLBACK_CHAINS: Readonly<
  Record<Capability, readonly string[]>
> = Object.freeze(FALLBACK_CHAINS_DATA);
