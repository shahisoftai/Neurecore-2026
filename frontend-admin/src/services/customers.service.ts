/**
 * customers.service.ts — Admin customers service.
 *
 * Provides admin-level (cross-tenant) access to customers data.
 * listAll() skips tenant scoping so admins see every customer.
 */

import api from '@/services/api';
import { unwrapItem, unwrapList } from '@/services/unwrap';

export interface AdminCustomer {
  id: string;
  tenantId: string;
  name: string;
  industry: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  _count?: { projects: number };
}

export interface ListCustomersPoolOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export const customersService = {
  async listAll(opts?: ListCustomersPoolOptions) {
    const params: Record<string, unknown> = {};
    if (opts?.page) params.page = opts.page;
    if (opts?.limit) params.limit = opts.limit;
    if (opts?.search) params.search = opts.search;
    if (opts?.status) params.status = opts.status;

    const res = await api.get('/customers', { params });
    const list = unwrapList(res);
    return {
      items: (list.items ?? []) as AdminCustomer[],
      total: list.total ?? 0,
      page: opts?.page ?? 1,
      limit: opts?.limit ?? 20,
      totalPages: Math.max(1, Math.ceil((list.total ?? 0) / (opts?.limit ?? 20))),
    };
  },

  async get(id: string): Promise<AdminCustomer> {
    const res = await api.get(`/customers/${id}`);
    return unwrapItem(res) as AdminCustomer;
  },

  async archive(id: string): Promise<AdminCustomer> {
    const res = await api.post(`/customers/${id}/archive`);
    return unwrapItem(res) as AdminCustomer;
  },
};
