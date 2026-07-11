/**
 * Error taxonomy
 */

import {
  AiGatewayAllProvidersFailedError,
  AiGatewayAuthError,
  AiGatewayBudgetExceededError,
  AiGatewayCircuitOpenError,
  AiGatewayContextLengthError,
  AiGatewayError,
  AiGatewayProviderError,
  AiGatewayRateLimitError,
  AiGatewayStructuredValidationError,
  AiGatewayTimeoutError,
  AiGatewayUnconfiguredError,
} from './errors';

describe('ai-gateway errors', () => {
  it('all errors carry a stable `code`', () => {
    const cases: Array<[AiGatewayError, string]> = [
      [new AiGatewayTimeoutError('t'), 'AI_GATEWAY_TIMEOUT'],
      [new AiGatewayRateLimitError('r', 1000), 'AI_GATEWAY_RATE_LIMIT'],
      [new AiGatewayAuthError('a'), 'AI_GATEWAY_AUTH'],
      [new AiGatewayContextLengthError('c'), 'AI_GATEWAY_CONTEXT_LENGTH'],
      [new AiGatewayCircuitOpenError('o'), 'AI_GATEWAY_CIRCUIT_OPEN'],
      [new AiGatewayProviderError('p'), 'AI_GATEWAY_PROVIDER'],
      [
        new AiGatewayAllProvidersFailedError('a', []),
        'AI_GATEWAY_ALL_PROVIDERS_FAILED',
      ],
      [
        new AiGatewayStructuredValidationError('s', []),
        'AI_GATEWAY_STRUCTURED_VALIDATION',
      ],
      [new AiGatewayBudgetExceededError(1, 2), 'AI_GATEWAY_BUDGET_EXCEEDED'],
      [new AiGatewayUnconfiguredError('X'), 'AI_GATEWAY_UNCONFIGURED'],
    ];
    for (const [err, code] of cases) {
      expect(err.code).toBe(code);
    }
  });

  it('AllProvidersFailedError carries the tried list', () => {
    const tried = [
      { provider: 'a', model: 'b', errorCode: 'C' },
      { provider: 'd', model: 'e', errorCode: 'F' },
    ];
    const err = new AiGatewayAllProvidersFailedError('x', tried);
    expect(err.tried).toEqual(tried);
  });

  it('StructuredValidationError exposes zod issues', () => {
    const err = new AiGatewayStructuredValidationError('x', [
      { path: 'a.b', message: 'bad' },
    ]);
    expect(err.zodIssues).toEqual([{ path: 'a.b', message: 'bad' }]);
  });

  it('BudgetExceededError carries budget + estimated', () => {
    const err = new AiGatewayBudgetExceededError(100, 250);
    expect(err.budgetCents).toBe(100);
    expect(err.estimatedCents).toBe(250);
  });
});
