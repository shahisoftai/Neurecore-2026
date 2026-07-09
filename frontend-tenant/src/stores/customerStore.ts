import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { customersService } from '@/services/customers.service';
import type { Customer, CreateCustomerPayload, UpdateCustomerPayload } from '@/types/customers.types';

export type { Customer };

interface CustomerState {
  customers: Customer[];
  activeCustomer: Customer | null;
  total: number;
  loading: boolean;
  error: string | null;

  fetchCustomers: (opts?: { search?: string; status?: string }) => Promise<void>;
  fetchCustomer: (id: string) => Promise<void>;
  createCustomer: (payload: CreateCustomerPayload) => Promise<Customer | null>;
  updateCustomer: (id: string, payload: UpdateCustomerPayload) => Promise<Customer | null>;
  archiveCustomer: (id: string) => Promise<void>;
  setActiveCustomer: (customer: Customer | null) => void;
  reset: () => void;
}

export const useCustomerStore = create<CustomerState>()(
  persist(
    (set) => ({
      customers: [],
      activeCustomer: null,
      total: 0,
      loading: false,
      error: null,

      fetchCustomers: async (opts) => {
        set({ loading: true, error: null });
        try {
          const { items, total } = await customersService.list(opts);
          set({ customers: items, total });
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      fetchCustomer: async (id) => {
        set({ loading: true, error: null });
        try {
          const customer = await customersService.get(id);
          set({ activeCustomer: customer });
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      createCustomer: async (payload) => {
        set({ loading: true, error: null });
        try {
          const customer = await customersService.create(payload);
          set((s) => ({ customers: [customer, ...s.customers], total: s.total + 1 }));
          return customer;
        } catch (err) {
          set({ error: (err as Error).message });
          return null;
        } finally {
          set({ loading: false });
        }
      },

      updateCustomer: async (id, payload) => {
        set({ loading: true, error: null });
        try {
          const updated = await customersService.update(id, payload);
          set((s) => ({
            customers: s.customers.map((c) => (c.id === id ? updated : c)),
            activeCustomer: s.activeCustomer?.id === id ? updated : s.activeCustomer,
          }));
          return updated;
        } catch (err) {
          set({ error: (err as Error).message });
          return null;
        } finally {
          set({ loading: false });
        }
      },

      archiveCustomer: async (id) => {
        set({ loading: true, error: null });
        try {
          await customersService.archive(id);
          set((s) => ({
            customers: s.customers.map((c) =>
              c.id === id ? { ...c, status: 'ARCHIVED' as const } : c,
            ),
            activeCustomer:
              s.activeCustomer?.id === id
                ? { ...s.activeCustomer, status: 'ARCHIVED' as const }
                : s.activeCustomer,
          }));
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      setActiveCustomer: (customer) => set({ activeCustomer: customer }),

      reset: () => set({ customers: [], activeCustomer: null, total: 0, loading: false, error: null }),
    }),
    {
      name: 'hq_customer_store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ customers: state.customers, total: state.total }),
      merge: (persistedState, currentState) => {
        const ps = (persistedState ?? {}) as Partial<CustomerState>;
        return {
          ...currentState,
          ...ps,
          customers: Array.isArray(ps.customers) ? ps.customers : currentState.customers,
          total: typeof ps.total === 'number' ? ps.total : currentState.total,
        };
      },
    },
  ),
);
