export const HERMES_EVENTS = {
  EXECUTION_STARTED: 'hermes:start',
  EXECUTION_COMPLETED: 'hermes:end',
  TOOL_CALL: 'hermes:tool:call',
  TOOL_RESULT: 'hermes:tool:result',
  TOOL_DENIED: 'hermes:tool:denied',
  APPROVAL_REQUESTED: 'hermes:approval:requested',
  APPROVAL_COMPLETED: 'hermes:approval:completed',
  MEMORY_STORED: 'hermes:memory:stored',
  ERROR: 'hermes:error',
} as const;

export type HermesEventType =
  (typeof HERMES_EVENTS)[keyof typeof HERMES_EVENTS];

export const FEATURE_FLAGS = {
  HERMES_ENABLED: 'HERMES_ENABLED',
  HERMES_AUTO_LINK: 'HERMES_AUTO_LINK',
  HERMES_APPROVAL_REQUIRED: 'HERMES_APPROVAL_REQUIRED',
  HERMES_SESSION_LOGGING: 'HERMES_SESSION_LOGGING',
} as const;

export const HERMES_DEFAULTS = {
  MAX_ITERATIONS: 10,
  SESSION_TTL_HOURS: 24,
  CUSTOM_TYPE: 'CUSTOM' as const,
};

/**
 * Default LLM model per HermesAgentType. Used by the registry when an
 * auto-linked agent has no explicit model (H6). Falls back to
 * `DEFAULT_MODEL` for any unmapped type.
 *
 * Override per-tenant via `Tenant.settings.featureFlags.HERMES_MODEL_<TYPE>`
 * (uppercased) if needed — readers can call `getDefaultModelForType(type)`.
 */
export const HERMES_TYPE_MODELS = {
  FINANCE: 'gpt-4o',
  HR: 'gpt-4o-mini',
  SALES: 'gpt-4o-mini',
  SUPPORT: 'gpt-4o-mini',
  EXECUTIVE: 'gpt-4o',
  ANALYST: 'gpt-4o',
  CUSTOM: 'gpt-4o-mini',
  DEFAULT_MODEL: 'gpt-4o-mini',
} as const;

export type HermesAgentTypeLiteral = keyof typeof HERMES_TYPE_MODELS;

export function getDefaultModelForType(
  type: string | null | undefined,
): string {
  if (!type) return HERMES_TYPE_MODELS.DEFAULT_MODEL;
  const key = type as HermesAgentTypeLiteral;
  if (key in HERMES_TYPE_MODELS && key !== 'DEFAULT_MODEL') {
    return HERMES_TYPE_MODELS[key];
  }
  return HERMES_TYPE_MODELS.DEFAULT_MODEL;
}
