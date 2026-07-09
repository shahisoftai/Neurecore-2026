import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { deliverablesService } from '@/services/deliverables.service';
import type {
  Deliverable,
  DeliverableVersion,
  DeliverableStatus,
} from '@/services/deliverables.service';

export type { Deliverable, DeliverableVersion, DeliverableStatus };

interface DeliverableState {
  deliverablesByProject: Record<string, Deliverable[]>;
  loading: boolean;
  error: string | null;

  fetchDeliverables: (projectId: string) => Promise<void>;
  createDeliverable: (payload: {
    projectId: string;
    taskId?: string;
    goalId?: string;
    name: string;
    description?: string;
    status?: DeliverableStatus;
    riskTier?: 'LOW' | 'MEDIUM' | 'HIGH';
  }) => Promise<Deliverable | null>;
  updateDeliverable: (id: string, payload: Partial<Deliverable>) => Promise<Deliverable | null>;
  deleteDeliverable: (id: string, projectId: string) => Promise<void>;
  fetchVersions: (deliverableId: string) => Promise<DeliverableVersion[]>;
  reset: () => void;
}

export const useDeliverableStore = create<DeliverableState>()(
  persist(
    (set, get) => ({
      deliverablesByProject: {},
      loading: false,
      error: null,

      fetchDeliverables: async (projectId) => {
        set({ loading: true, error: null });
        try {
          const items = await deliverablesService.getByProject(projectId);
          set((s) => ({
            deliverablesByProject: { ...s.deliverablesByProject, [projectId]: items },
          }));
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      createDeliverable: async (payload) => {
        set({ loading: true, error: null });
        try {
          const deliverable = await deliverablesService.create(payload);
          set((s) => ({
            deliverablesByProject: {
              ...s.deliverablesByProject,
              [payload.projectId]: [
                deliverable,
                ...(s.deliverablesByProject[payload.projectId] ?? []),
              ],
            },
          }));
          return deliverable;
        } catch (err) {
          set({ error: (err as Error).message });
          return null;
        } finally {
          set({ loading: false });
        }
      },

      updateDeliverable: async (id, payload) => {
        set({ loading: true, error: null });
        try {
          const updated = await deliverablesService.update(id, payload);
          set((s) => {
            const next = { ...s.deliverablesByProject };
            for (const projectId of Object.keys(next)) {
              next[projectId] = next[projectId].map((d) =>
                d.id === id ? updated : d,
              );
            }
            return { deliverablesByProject: next };
          });
          return updated;
        } catch (err) {
          set({ error: (err as Error).message });
          return null;
        } finally {
          set({ loading: false });
        }
      },

      deleteDeliverable: async (id, projectId) => {
        set({ loading: true, error: null });
        try {
          await deliverablesService.delete(id);
          set((s) => ({
            deliverablesByProject: {
              ...s.deliverablesByProject,
              [projectId]: (s.deliverablesByProject[projectId] ?? []).filter(
                (d) => d.id !== id,
              ),
            },
          }));
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      fetchVersions: async (deliverableId) => {
        set({ loading: true, error: null });
        try {
          const versions = await deliverablesService.listVersions(deliverableId);
          return versions;
        } catch (err) {
          set({ error: (err as Error).message });
          return [];
        } finally {
          set({ loading: false });
        }
      },

      reset: () => set({ deliverablesByProject: {}, loading: false, error: null }),
    }),
    {
      name: 'hq_deliverable_store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ deliverablesByProject: state.deliverablesByProject }),
      merge: (persistedState, currentState) => {
        const ps = (persistedState ?? {}) as Partial<DeliverableState>;
        return {
          ...currentState,
          ...ps,
          deliverablesByProject:
            ps.deliverablesByProject && typeof ps.deliverablesByProject === 'object'
              ? ps.deliverablesByProject
              : currentState.deliverablesByProject,
        };
      },
    },
  ),
);
