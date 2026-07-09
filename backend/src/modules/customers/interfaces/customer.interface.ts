/**
 * Customers Module — Interface Definitions
 *
 * Following SOLID (ISP, DIP): focused contracts so other modules depend on
 * abstractions, never on Prisma.
 */

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  industry: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  billingInfo: Record<string, unknown> | null;
  status: CustomerStatus;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  isPrimary: boolean;
  createdAt: Date;
}

export interface CreateCustomerInput {
  name: string;
  industry?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  billingInfo?: Record<string, unknown> | null;
  tags?: string[];
}

export interface UpdateCustomerInput {
  name?: string;
  industry?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  billingInfo?: Record<string, unknown> | null;
  status?: CustomerStatus;
  tags?: string[];
}

export interface ListCustomersOptions {
  search?: string;
  status?: CustomerStatus;
  page?: number;
  limit?: number;
  sortKey?: 'name' | 'industry' | 'status' | 'createdAt' | 'updatedAt';
  sortDir?: 'asc' | 'desc';
}

export interface ICustomerRepository {
  create(data: CreateCustomerInput, tenantId: string): Promise<Customer>;
  findById(id: string, tenantId: string): Promise<Customer | null>;
  findAll(
    options: ListCustomersOptions,
    tenantId: string,
  ): Promise<{ data: Customer[]; total: number }>;
  update(
    id: string,
    tenantId: string,
    data: UpdateCustomerInput,
  ): Promise<Customer>;
  archive(id: string, tenantId: string): Promise<Customer>;
  addContact(
    customerId: string,
    dto: {
      name: string;
      email: string;
      phone?: string | null;
      role?: string | null;
      isPrimary?: boolean;
    },
  ): Promise<CustomerContact>;
  listContacts(customerId: string): Promise<CustomerContact[]>;
}

export const CUSTOMER_REPOSITORY = 'CUSTOMER_REPOSITORY';
