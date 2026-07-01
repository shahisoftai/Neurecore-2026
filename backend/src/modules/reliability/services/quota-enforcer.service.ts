import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { QuotaEvaluatorService } from './quota-evaluator.service';
import type { QuotaCheck, QuotaTarget } from '../interfaces/IQuotaService';

/**
 * QuotaEnforcerService — Phase 4.5
 *
 * SRP:  Takes enforcement action based on QuotaEvaluatorService results.
 *       The evaluator queries; the enforcer acts.
 * OCP:  Swap enforcement strategy (warn-only vs hard-stop) by
 *       changing ENFORCEMENT_MODE env var — no code change needed.
 */

type EnforcementMode = 'strict' | 'warn_only';

@Injectable()
export class QuotaEnforcerService {
  private readonly logger = new Logger(QuotaEnforcerService.name);
  private readonly mode: EnforcementMode;

  constructor(private readonly evaluator: QuotaEvaluatorService) {
    this.mode =
      (process.env.QUOTA_ENFORCEMENT_MODE as EnforcementMode) ?? 'strict';
  }

  /**
   * Evaluates the quota then records usage.
   * Throws TooManyRequestsException in `strict` mode when limit is exceeded.
   * Logs a warning in `warn_only` mode.
   */
  async enforceAndRecord(target: QuotaTarget, units = 1): Promise<QuotaCheck> {
    const current = await this.evaluator.evaluate(target);

    if (!current.allowed) {
      const msg = `Quota limit reached: ${target.quotaKey} (${current.used}/${current.limit}) for tenant ${target.tenantId}`;
      if (this.mode === 'strict') {
        this.logger.warn(msg);
        throw new HttpException(msg, HttpStatus.TOO_MANY_REQUESTS);
      }
      this.logger.warn(`[warn_only] ${msg}`);
    } else if (current.atWarning) {
      this.logger.warn(
        `Quota warning: ${target.quotaKey} at ${Math.round((current.used / current.limit) * 100)}% for tenant ${target.tenantId}`,
      );
    }

    return this.evaluator.record(target, units);
  }

  /** Non-throwing check — useful for probes / pre-flight validation */
  async check(target: QuotaTarget): Promise<QuotaCheck> {
    return this.evaluator.evaluate(target);
  }
}
