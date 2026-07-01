/**
 * Finance module interfaces — Phase 4.4
 * ISP: each interface covers exactly one responsibility.
 */

import type { Invoice, Expense, BillingEvent } from '@prisma/client';

// ─── Invoice ─────────────────────────────────────────────────────────────────

export interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface CreateInvoiceInput {
  tenantId: string;
  currency?: string;
  lineItems: LineItem[];
  dueAt?: Date;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface InvoiceListResult {
  data: Invoice[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InvoiceWithRelations extends Invoice {
  expenses: Expense[];
  billingEvents: BillingEvent[];
}

export interface IInvoiceService {
  create(input: CreateInvoiceInput): Promise<Invoice>;
  findAll(
    tenantId: string,
    page?: number,
    limit?: number,
  ): Promise<InvoiceListResult>;
  findOne(id: string, tenantId: string): Promise<InvoiceWithRelations>;
  issue(id: string, tenantId: string): Promise<Invoice>;
  markPaid(id: string, tenantId: string): Promise<Invoice>;
  cancel(id: string, tenantId: string): Promise<Invoice>;
}

// ─── Billing calculator ───────────────────────────────────────────────────────

export interface BillingSummary {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  totalAgentExecutionCost: number;
  totalToolUsageCost: number;
  totalApiCost: number;
  grandTotal: number;
  currency: string;
}

export interface IBillingCalculator {
  calculateMonthly(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<BillingSummary>;
  calculatePeriod(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<BillingSummary>;
  recordExpense(
    tenantId: string,
    category: string,
    description: string,
    amountUsd: number,
    opts?: {
      agentId?: string;
      invoiceId?: string;
      currency?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Expense>;
  listExpenses(
    tenantId: string,
    page?: number,
    limit?: number,
  ): Promise<{
    data: Expense[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
}

// ─── Tax ─────────────────────────────────────────────────────────────────────

export interface TaxCalculation {
  region: string;
  rate: number;
  taxAmount: number;
  taxable: number;
}

export interface ITaxService {
  calculate(amountUsd: number, region: string): TaxCalculation;
  getRate(region: string): number;
}

// ─── Billing Events ───────────────────────────────────────────────────────────

export interface IBillingEventEmitter {
  emit(
    tenantId: string,
    type: string,
    payload: Record<string, unknown>,
    invoiceId?: string,
  ): Promise<void>;
}
