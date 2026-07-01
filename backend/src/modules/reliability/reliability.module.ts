import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { QuotaEvaluatorService } from './services/quota-evaluator.service';
import { QuotaEnforcerService } from './services/quota-enforcer.service';
import { SpendingCapService } from './services/spending-cap.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { QuotaGuard } from './guards/quota.guard';
import { ReliabilityController } from './controllers/reliability.controller';

/**
 * ReliabilityModule — Phase 4.5
 *
 * Provides quota enforcement, spending cap controls, and circuit breaker
 * state management for the entire platform.
 *
 * Exports QuotaGuard, QuotaEnforcerService, and CircuitBreakerService so
 * other modules can apply reliability controls without importing the full
 * module (DIP — depend on the exports, not the module internals).
 */
@Module({
  imports: [FinanceModule],
  controllers: [ReliabilityController],
  providers: [
    QuotaEvaluatorService,
    QuotaEnforcerService,
    SpendingCapService,
    CircuitBreakerService,
    QuotaGuard,
  ],
  exports: [
    QuotaEvaluatorService,
    QuotaEnforcerService,
    SpendingCapService,
    CircuitBreakerService,
    QuotaGuard,
  ],
})
export class ReliabilityModule {}
