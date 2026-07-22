/**
 * IndustriesModule — wires the Industry pool.
 *
 * Phase 10 — Admin Business Composition.
 * INDUSTRY-GROUPS-CONCEPT.md Phase 2: also exposes IndustryGroupsService +
 * the public /api/v1/industries/groups + /capabilities endpoints.
 *
 * Stage 2 Phase 2B: exposes IndustryCustomerFieldsService for dynamic
 * customer field definitions per industry.
 */

import { Module } from '@nestjs/common';
import { IndustriesController } from './industries.controller';
import { IndustriesService } from './industries.service';
import { IndustryGroupsService } from './industry-groups.service';
import { IndustryCustomerFieldsService } from './customer-fields/industry-customer-fields.service';

@Module({
  controllers: [IndustriesController],
  providers: [
    IndustriesService,
    IndustryGroupsService,
    IndustryCustomerFieldsService,
  ],
  exports: [
    IndustriesService,
    IndustryGroupsService,
    IndustryCustomerFieldsService,
  ],
})
export class IndustriesModule {}
