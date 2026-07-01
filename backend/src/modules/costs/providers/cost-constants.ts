/**
 * LLM Cost Constants
 *
 * Cost per 1,000 tokens for various LLM providers/models
 * Used for estimating costs when direct cost data is unavailable
 */

export const costPer1KTokens: Record<
  string,
  { input: number; output: number }
> = {
  // OpenAI Models
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'o1-preview': { input: 15.0, output: 60.0 },
  'o1-mini': { input: 3.0, output: 12.0 },

  // Anthropic Models
  'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-opus': { input: 15.0, output: 75.0 },
  'claude-3-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },

  // DeepSeek Models
  'deepseek-chat': { input: 0.1, output: 0.3 },
  'deepseek-coder': { input: 0.14, output: 0.28 },

  // MiniMax Models (abstraction)
  minimax: { input: 0.1, output: 0.4 },
  'minimax-01': { input: 0.1, output: 1.0 },

  // Google Models
  'gemini-pro': { input: 0.125, output: 0.375 },
  'gemini-ultra': { input: 1.25, output: 5.0 },

  // Mistral Models
  'mistral-large': { input: 2.0, output: 6.0 },
  'mistral-medium': { input: 0.5, output: 1.5 },
  'mistral-small': { input: 0.2, output: 0.6 },

  // Meta Models
  'llama-3-70b': { input: 0.7, output: 2.75 },
  'llama-3-8b': { input: 0.07, output: 0.24 },

  // Default fallback
  default: { input: 0.5, output: 1.5 },
};

/**
 * Provider display names
 */
export const providerDisplayNames: Record<string, string> = {
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Anthropic',
  MINIMAX: 'MiniMax',
  DEEPSEEK: 'DeepSeek',
  GOOGLE: 'Google',
  MISTRAL: 'Mistral AI',
  META: 'Meta',
};

/**
 * Map model names to providers
 */
export const modelToProvider: Record<string, string> = {
  'gpt-': 'OPENAI',
  'o1-': 'OPENAI',
  'claude-': 'ANTHROPIC',
  'deepseek-': 'DEEPSEEK',
  minimax: 'MINIMAX',
  'gemini-': 'GOOGLE',
  'mistral-': 'MISTRAL',
  'llama-': 'META',
};

/**
 * Get provider for a model name
 */
export function getProviderForModel(model: string): string {
  const normalized = model.toLowerCase();
  for (const [pattern, provider] of Object.entries(modelToProvider)) {
    if (normalized.includes(pattern)) {
      return provider;
    }
  }
  return 'UNKNOWN';
}
