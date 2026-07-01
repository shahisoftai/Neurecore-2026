import { Module } from '@nestjs/common';
import { InvoiceService } from './services/invoice.service';
import { BillingCalculatorService } from './services/billing-calculator.service';
import { BillingEventsService } from './services/billing-events.service';
import { TaxService } from './services/tax.service';
import { FinanceController } from './controllers/finance.controller';

/**
 * FinanceModule — Phase 4.4
 *
 * Provides invoice lifecycle management, expense tracking, billing event
 * audit trail, tax computation, and consolidated billing reports.
 */
@Module({
  controllers: [FinanceController],
  providers: [
    InvoiceService,
    BillingCalculatorService,
    BillingEventsService,
    TaxService,
  ],
  exports: [
    InvoiceService,
    BillingCalculatorService,
    BillingEventsService,
    TaxService,
  ],
})
export class FinanceModule {}
