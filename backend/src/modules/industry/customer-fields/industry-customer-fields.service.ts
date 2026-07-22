/**
 * Industry Customer Fields Service
 *
 * Stage 2 Phase 2B: Service to resolve per-industry customer field definitions.
 *
 * Reads from the static INDUSTRY_CUSTOMER_FIELDS registry and returns
 * structured field definitions grouped by section for dynamic form rendering.
 *
 * SOLID:
 * - SRP: This service ONLY resolves customer field definitions.
 * - OCP: New industry = add entry to INDUSTRY_CUSTOMER_FIELDS. Zero changes here.
 * - ISP: Returns focused CustomerFieldDef / CustomerFieldSection types.
 */

import { Injectable } from '@nestjs/common';
import {
  getCustomerFieldDefs,
  getCustomerFieldSections,
  getAllIndustrySlugsWithFields,
} from './industry-customer-field-definitions';
import type {
  CustomerFieldDef,
  CustomerFieldSection,
} from './industry-customer-field-definitions';

@Injectable()
export class IndustryCustomerFieldsService {
  getFieldDefs(industrySlug: string): CustomerFieldDef[] | null {
    return getCustomerFieldDefs(industrySlug);
  }

  getFieldSections(industrySlug: string): CustomerFieldSection[] {
    return getCustomerFieldSections(industrySlug);
  }

  getIndustriesWithFields(): string[] {
    return getAllIndustrySlugsWithFields();
  }
}
