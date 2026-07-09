import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { projectsService } from '@/services/projects.service';
import { informationEngineService } from '@/services/projectTypes.service';
import type { Project, ProjectStatus } from '@/services/projects.service';
import type { EntityCompleteness } from '@/components/discovery/types';

export type { Project, ProjectStatus };

interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  total: number;
  loading: boolean;
  error: string | null;

  // Phase 2D: Information Engine caches (NOT persisted to localStorage —
  // stale completeness is worse than no completeness, per anti-pattern §12).
  completeness: Record<string, EntityCompleteness>;
  inFlightAnswer: Record<string, string>;

  fetchProjects: (opts?: {
    status?: ProjectStatus;
    customerId?: string;
    departmentId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (payload: Partial<Project>) => Promise<Project | null>;
  updateProject: (id: string, payload: Partial<Project>) => Promise<Project | null>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (project: Project | null) => void;
  reset: () => void;

  // Phase 2D: engine-side cache primitives.
  fetchCompleteness: (projectId: string) => Promise<EntityCompleteness | null>;
  recordAnswer: (
    projectId: string,
    questionId: string,
    value: unknown,
  ) => Promise<EntityCompleteness | null>;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProject: null,
      total: 0,
      loading: false,
      error: null,
      completeness: {},
      inFlightAnswer: {},

      fetchProjects: async (opts) => {
        set({ loading: true, error: null });
        try {
          const { items, total } = await projectsService.list(opts);
          set({ projects: items, total });
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      fetchProject: async (id) => {
        set({ loading: true, error: null });
        try {
          const project = await projectsService.get(id);
          set({ activeProject: project });
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      createProject: async (payload) => {
        set({ loading: true, error: null });
        try {
          const project = await projectsService.create(payload);
          set((s) => ({ projects: [project, ...s.projects], total: s.total + 1 }));
          return project;
        } catch (err) {
          set({ error: (err as Error).message });
          return null;
        } finally {
          set({ loading: false });
        }
      },

      updateProject: async (id, payload) => {
        set({ loading: true, error: null });
        try {
          const updated = await projectsService.update(id, payload);
          set((s) => ({
            projects: s.projects.map((p) => (p.id === id ? updated : p)),
            activeProject: s.activeProject?.id === id ? updated : s.activeProject,
          }));
          return updated;
        } catch (err) {
          set({ error: (err as Error).message });
          return null;
        } finally {
          set({ loading: false });
        }
      },

      deleteProject: async (id) => {
        set({ loading: true, error: null });
        try {
          await projectsService.delete(id);
          set((s) => ({
            projects: s.projects.filter((p) => p.id !== id),
            total: s.total - 1,
            activeProject: s.activeProject?.id === id ? null : s.activeProject,
          }));
        } catch (err) {
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      setActiveProject: (project) => set({ activeProject: project }),

      reset: () =>
        set({
          projects: [],
          activeProject: null,
          total: 0,
          loading: false,
          error: null,
          completeness: {},
          inFlightAnswer: {},
        }),

      // Phase 2D: engine-side cache primitives.
      fetchCompleteness: async (projectId) => {
        try {
          const snapshot = await informationEngineService.getCompleteness(projectId);
          set((s) => ({
            completeness: { ...s.completeness, [projectId]: snapshot },
          }));
          return snapshot;
        } catch (err) {
          set({ error: (err as Error).message });
          return null;
        }
      },

      recordAnswer: async (projectId, questionId, value) => {
        set((s) => ({ inFlightAnswer: { ...s.inFlightAnswer, [projectId]: questionId } }));
        try {
          const { completeness } = await informationEngineService.recordResponse(projectId, {
            questionId,
            value,
            sourceType: 'USER_INPUT',
            sourceLabel: 'Discovery form',
            confidence: 100,
          });
          set((s) => ({
            completeness: { ...s.completeness, [projectId]: completeness },
          }));
          return completeness;
        } catch (err) {
          set({ error: (err as Error).message });
          return null;
        } finally {
          set((s) => {
            const next = { ...s.inFlightAnswer };
            delete next[projectId];
            return { inFlightAnswer: next };
          });
        }
      },
    }),
    {
      name: 'hq_project_store',
      storage: createJSONStorage(() => localStorage),
      // Anti-pattern §12: NEVER persist completeness to localStorage.
      partialize: (state) => ({ projects: state.projects, total: state.total }),
      merge: (persistedState, currentState) => {
        const ps = (persistedState ?? {}) as Partial<ProjectState>;
        return {
          ...currentState,
          ...ps,
          projects: Array.isArray(ps.projects) ? ps.projects : currentState.projects,
          total: typeof ps.total === 'number' ? ps.total : currentState.total,
        };
      },
    },
  ),
);
