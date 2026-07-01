import { SetMetadata } from '@nestjs/common';

export const QUOTA_KEY_METADATA = 'quota:key';
export const QUOTA_UNITS_METADATA = 'quota:units';

/**
 * @Quota(key, units?)
 * Attaches quota metadata to a route handler.
 * QuotaGuard reads this metadata to look up the tenant's limit and record usage.
 *
 * Example:
 *   @Quota('agent_executions')
 *   @Post('run')
 *   async runAgent(...) { ... }
 *
 * OCP: Add new quota keys here without modifying the guard.
 */
export const Quota =
  (key: string, units = 1): MethodDecorator =>
  (target, property, descriptor) => {
    SetMetadata(QUOTA_KEY_METADATA, key)(target, property, descriptor);
    SetMetadata(QUOTA_UNITS_METADATA, units)(target, property, descriptor);
  };
