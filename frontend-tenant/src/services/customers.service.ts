import api from './api';
import { unwrapItem, unwrapList } from './unwrap';
import type {
  Customer,
  CreateCustomerPayload,
  UpdateCustomerPayload,
  CustomerContact,
} from '@/types/customers.types';

export const customersService = {
  list: async (
    opts?: {
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
      sortKey?: 'name' | 'industry' | 'status' | 'createdAt' | 'updatedAt';
      sortDir?: 'asc' | 'desc';
    },
  ) => {
    const res = await api.get('/customers', { params: opts });
    const { items, total } = unwrapList(res);
    return { items: items as Customer[], total: total ?? items.length };
  },

  get: async (id: string): Promise<Customer | null> => {
    const res = await api.get(`/customers/${id}`);
    return unwrapItem(res);
  },

  create: async (payload: CreateCustomerPayload): Promise<Customer> => {
    const res = await api.post('/customers', payload);
    const item = unwrapItem(res);
    return item as Customer;
  },

  update: async (
    id: string,
    payload: UpdateCustomerPayload,
  ): Promise<Customer> => {
    const res = await api.patch(`/customers/${id}`, payload);
    return unwrapItem(res) as Customer;
  },

  archive: async (id: string): Promise<Customer> => {
    const res = await api.post(`/customers/${id}/archive`);
    return unwrapItem(res) as Customer;
  },

  unarchive: async (id: string): Promise<Customer> => {
    const res = await api.post(`/customers/${id}/unarchive`);
    return unwrapItem(res) as Customer;
  },

  addContact: async (
    customerId: string,
    dto: {
      name: string;
      email: string;
      phone?: string;
      role?: string;
      isPrimary?: boolean;
    },
  ): Promise<CustomerContact> => {
    const res = await api.post(`/customers/${customerId}/contacts`, dto);
    return unwrapItem(res) as CustomerContact;
  },

  listContacts: async (customerId: string): Promise<CustomerContact[]> => {
    const res = await api.get(`/customers/${customerId}/contacts`);
    const { items } = unwrapList(res);
    return items as CustomerContact[];
  },
};
