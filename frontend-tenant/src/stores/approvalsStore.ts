import { create } from 'zustand';
import type { ApprovalRequest } from '@/types/approvals.types';

interface ApprovalsState {
  critical: ApprovalRequest[];
  routine: ApprovalRequest[];
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  setData: (critical: ApprovalRequest[], routine: ApprovalRequest[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useApprovalsStore = create<ApprovalsState>()((set) => ({
  critical: [],
  routine: [],
  isLoading: true,
  error: null,
  lastFetchedAt: null,

  setData: (critical, routine) =>
    set({ critical: Array.isArray(critical) ? critical : [], routine: Array.isArray(routine) ? routine : [], isLoading: false, error: null, lastFetchedAt: Date.now() }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  reset: () =>
    set({ critical: [], routine: [], isLoading: true, error: null, lastFetchedAt: null }),
}));
