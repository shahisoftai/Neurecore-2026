import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

/**
 * Decorator that extracts the Idempotency-Key header (case-insensitive).
 *
 * Usage:
 *   @Post()
 *   create(@IdempotencyKey() key: string, ...) { ... }
 *
 * The header is REQUIRED for state-changing endpoints. If absent, the
 * decorator throws a 400 IDEMPOTENCY_KEY_REQUIRED error.
 */
export const IdempotencyKey = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    const headerValue =
      req.headers['idempotency-key'] ??
      req.headers['Idempotency-Key'] ??
      req.headers['IDEMPOTENCY-KEY'];
    if (!headerValue || typeof headerValue !== 'string' || headerValue.trim() === '') {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for this endpoint.',
      });
    }
    return headerValue.trim();
  },
);