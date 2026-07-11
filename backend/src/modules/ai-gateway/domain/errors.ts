/**
 * AI Gateway — Error taxonomy (ai-gateway-imp-plan.md §4.5)
 *
 * Every error the gateway can throw has its own class so callers can
 * match by `instanceof` and react accordingly. All errors extend
 * `AiGatewayError` for coarse-grained catch blocks.
 *
 * SOLID: ISP — each error carries only the context the caller needs.
 */

export abstract class AiGatewayError extends Error {
  abstract readonly code: string;
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
  }
}

export class AiGatewayTimeoutError extends AiGatewayError {
  readonly code = 'AI_GATEWAY_TIMEOUT';
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class AiGatewayRateLimitError extends AiGatewayError {
  readonly code = 'AI_GATEWAY_RATE_LIMIT';
  readonly retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number, cause?: unknown) {
    super(message, cause);
    this.retryAfterMs = retryAfterMs;
  }
}

export class AiGatewayAuthError extends AiGatewayError {
  readonly code = 'AI_GATEWAY_AUTH';
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class AiGatewayContextLengthError extends AiGatewayError {
  readonly code = 'AI_GATEWAY_CONTEXT_LENGTH';
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class AiGatewayCircuitOpenError extends AiGatewayError {
  readonly code = 'AI_GATEWAY_CIRCUIT_OPEN';
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class AiGatewayProviderError extends AiGatewayError {
  readonly code = 'AI_GATEWAY_PROVIDER';
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export interface AiGatewayAttemptedModel {
  provider: string;
  model: string;
  errorCode: string;
}

export class AiGatewayAllProvidersFailedError extends AiGatewayError {
  readonly code = 'AI_GATEWAY_ALL_PROVIDERS_FAILED';
  readonly tried: ReadonlyArray<AiGatewayAttemptedModel>;
  constructor(
    message: string,
    tried: ReadonlyArray<AiGatewayAttemptedModel>,
    cause?: unknown,
  ) {
    super(message, cause);
    this.tried = tried;
  }
}

export class AiGatewayStructuredValidationError extends AiGatewayError {
  readonly code = 'AI_GATEWAY_STRUCTURED_VALIDATION';
  readonly zodIssues: ReadonlyArray<{ path: string; message: string }>;
  constructor(
    message: string,
    zodIssues: ReadonlyArray<{ path: string; message: string }>,
    cause?: unknown,
  ) {
    super(message, cause);
    this.zodIssues = zodIssues;
  }
}

export class AiGatewayBudgetExceededError extends AiGatewayError {
  readonly code = 'AI_GATEWAY_BUDGET_EXCEEDED';
  readonly budgetCents: number;
  readonly estimatedCents: number;
  constructor(budgetCents: number, estimatedCents: number) {
    super(
      `Budget exceeded: estimated ${estimatedCents}¢ over budget ${budgetCents}¢`,
    );
    this.budgetCents = budgetCents;
    this.estimatedCents = estimatedCents;
  }
}

export class AiGatewayUnconfiguredError extends AiGatewayError {
  readonly code = 'AI_GATEWAY_UNCONFIGURED';
  readonly envVar: string;
  constructor(envVar: string) {
    super(
      `AI gateway cannot reach provider: env var ${envVar} is not set. ` +
        `Add it to the runtime environment to enable this capability.`,
    );
    this.envVar = envVar;
  }
}
