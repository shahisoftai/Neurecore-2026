/**
 * Compliance Module
 *
 * Stage 2 Phase 2A: Compliance checklist engine.
 *
 * SOLID:
 * - SRP: This module wires compliance dependencies only.
 * - DIP: Imports CustomersModule to use CUSTOMER_REPOSITORY abstraction.
 */

import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ComplianceAcceptanceController } from './compliance-acceptance.controller';
import { IndustryComplianceService } from './industry-compliance.service';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [CustomersModule],
  controllers: [ComplianceController, ComplianceAcceptanceController],
  providers: [IndustryComplianceService],
  exports: [IndustryComplianceService],
})
export class ComplianceModule {}
