// ─── strategyStore.ts (extracted from legacy chatStore.ts) ──────────────────────
// SRP: Saved scenario management only.
// Was incorrectly co-located in chatStore.ts.

import { create } from 'zustand';
import type { Scenario } from '@/types/strategy.types';

interface StrategyState {
  scenarios: Scenario[];
  currentScenarioId: string | null;

  addScenario: (s: Scenario) => void;
  removeScenario: (id: string) => void;
  setCurrentScenario: (id: string | null) => void;
  setScenarios: (s: Scenario[]) => void;
}

export const useStrategyStore = create<StrategyState>()((set) => ({
  scenarios: [],
  currentScenarioId: null,

  addScenario: (s) => set((prev) => ({ scenarios: [...prev.scenarios, s] })),
  removeScenario: (id) =>
    set((prev) => ({ scenarios: prev.scenarios.filter((s) => s.id !== id) })),
  setCurrentScenario: (id) => set({ currentScenarioId: id }),
  setScenarios: (scenarios) => set({ scenarios }),
}));
