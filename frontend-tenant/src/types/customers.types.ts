export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface Customer {
  id: string;
  tenantId?: string;
  name: string;
  industry?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  billingInfo?: Record<string, unknown> | null;
  status: CustomerStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface CreateCustomerPayload {
  name: string;
  industry?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  billingInfo?: Record<string, unknown>;
  tags?: string[];
}

export interface UpdateCustomerPayload {
  name?: string;
  industry?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  billingInfo?: Record<string, unknown>;
  status?: CustomerStatus;
  tags?: string[];
}
