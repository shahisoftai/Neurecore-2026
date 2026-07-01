import { Injectable } from '@nestjs/common';
import type {
  ITaxService,
  TaxCalculation,
} from '../interfaces/finance.interfaces';

/**
 * Tax rates by region/country code.
 * OCP: Extend by adding entries to TAX_RATES without modifying the calculation logic.
 * SRP: This service computes tax only — no DB calls, no side effects.
 */
const TAX_RATES: Record<string, number> = {
  default: 0,
  US: 0.08, // approximate blended US average
  EU: 0.2, // EU standard VAT
  GB: 0.2, // UK VAT
  AU: 0.1, // GST
  CA: 0.13, // approximate HST
  IN: 0.18, // GST
  SG: 0.09, // GST
  AE: 0.05, // VAT
};

@Injectable()
export class TaxService implements ITaxService {
  getRate(region: string): number {
    return TAX_RATES[region.toUpperCase()] ?? TAX_RATES['default'];
  }

  calculate(amountUsd: number, region: string): TaxCalculation {
    const rate = this.getRate(region);
    const taxAmount = Math.round(amountUsd * rate * 100) / 100;
    return { region, rate, taxAmount, taxable: amountUsd };
  }
}
