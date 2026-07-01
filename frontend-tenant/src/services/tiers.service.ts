import api from './api';

export interface Tier {
  id: string;
  name: string;
  slug: string;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  maxUsers: number;
  maxAgents: number;
  maxDepartments: number;
  maxStorageGB: number;
  maxApiCalls: number;
  maxFileSizeMB: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export const tiersService = {
  async list(): Promise<Tier[]> {
    const res = await api.get('/tiers');
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : (payload?.items ?? []);
  },
};