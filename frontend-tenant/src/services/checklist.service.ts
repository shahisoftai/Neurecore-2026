// services/checklist.service.ts — Thin wrapper around the
// /onboarding/checklist endpoints. DIP: all React components depend on the
// Zustand store, never on this directly.

import api from './api';
import type { ChecklistListResponse } from '@/lib/wizard/types';

export const checklistService = {
  async list(): Promise<ChecklistListResponse> {
    const res = await api.get('/onboarding/checklist');
    return res.data?.data ?? res.data;
  },

  async save(slug: string, payload: Record<string, unknown>): Promise<void> {
    await api.post(`/onboarding/checklist/${slug}/save`, { payload });
  },

  async complete(slug: string): Promise<void> {
    await api.post(`/onboarding/checklist/${slug}/complete`);
  },

  async skip(slug: string, reason?: string): Promise<void> {
    await api.post(`/onboarding/checklist/${slug}/skip`, { reason });
  },

  async dismiss(slug: string, reason?: string): Promise<void> {
    await api.post(`/onboarding/checklist/${slug}/dismiss`, { reason });
  },

  async dismissAll(dismissed: boolean): Promise<void> {
    await api.post('/onboarding/checklist/dismiss-all', { dismissed });
  },
};