/**
 * approvalStore.ts
 *
 * SRP: Manage approval state only
 * SOLID: Zustand store with clear state + actions
 * - Stores stratified approvals
 * - Manages loading state
 * - Handles batch selection
 * - Tracks feedback state
 */

import { create } from 'zustand';
import type { RiskLevel } from '@/components/approvals';
import type { SignalType } from '@/components/approvals';

interface ApprovalSignal {
    type: SignalType;
    description: string;
    weight: number;
}

interface AiRecommendation {
    action: 'APPROVE' | 'REJECT' | 'ESCALATE' | 'REVIEW';
    confidence: number;
    reasoning: string;
    signals: ApprovalSignal[];
    pastSimilar: {
        count: number;
        approvalRate: number;
        avgOutcome?: string;
    };
}

interface Approval {
    id: string;
    title: string;
    description?: string;
    status: string;
    riskLevel: RiskLevel;
    amount?: number;
    aiRecommendation: AiRecommendation;
    canBatchApprove?: boolean;
}

interface StratifiedApprovals {
    critical: Approval[];
    high: Approval[];
    medium: Approval[];
    low: Approval[];
    count: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

interface ApprovalState {
    // Data
    approvals: StratifiedApprovals | null;
    selectedApprovalIds: Set<string>;
    isLoading: boolean;
    error: string | null;

    // Batch selection
    selectApproval: (id: string) => void;
    deselectApproval: (id: string) => void;
    toggleApproval: (id: string) => void;
    selectAllRoutine: () => void;
    clearSelection: () => void;

    // Data fetching
    setApprovals: (approvals: StratifiedApprovals) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;

    // Utilities
    isSelected: (id: string) => boolean;
    getSelectedCount: () => number;
    getSelectedApprovals: () => Approval[];
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
    // Initial state
    approvals: null,
    selectedApprovalIds: new Set(),
    isLoading: false,
    error: null,

    // Batch selection actions
    selectApproval: (id: string) => {
        set((state) => {
            const newSelected = new Set(state.selectedApprovalIds);
            newSelected.add(id);
            return { selectedApprovalIds: newSelected };
        });
    },

    deselectApproval: (id: string) => {
        set((state) => {
            const newSelected = new Set(state.selectedApprovalIds);
            newSelected.delete(id);
            return { selectedApprovalIds: newSelected };
        });
    },

    toggleApproval: (id: string) => {
        set((state) => {
            const newSelected = new Set(state.selectedApprovalIds);
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
            return { selectedApprovalIds: newSelected };
        });
    },

    selectAllRoutine: () => {
        set((state) => {
            if (!state.approvals) return state;

            // Select all ROUTINE batch approvals
            const routine = state.approvals.low.filter(
                (a) => a.canBatchApprove && a.aiRecommendation.confidence >= 80,
            );

            const newSelected = new Set(state.selectedApprovalIds);
            routine.forEach((a) => newSelected.add(a.id));

            return { selectedApprovalIds: newSelected };
        });
    },

    clearSelection: () => {
        set({ selectedApprovalIds: new Set() });
    },

    // Data management
    setApprovals: (approvals: StratifiedApprovals) => {
        set({ approvals, isLoading: false });
    },

    setLoading: (loading: boolean) => {
        set({ isLoading: loading });
    },

    setError: (error: string | null) => {
        set({ error, isLoading: false });
    },

    // Utility methods
    isSelected: (id: string) => {
        return get().selectedApprovalIds.has(id);
    },

    getSelectedCount: () => {
        return get().selectedApprovalIds.size;
    },

    getSelectedApprovals: () => {
        const { approvals, selectedApprovalIds } = get();
        if (!approvals) return [];

        const allApprovals = [
            ...approvals.critical,
            ...approvals.high,
            ...approvals.medium,
            ...approvals.low,
        ];

        return allApprovals.filter((a) => selectedApprovalIds.has(a.id));
    },
}));
