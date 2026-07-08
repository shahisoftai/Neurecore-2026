import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BackgroundStyle = 'gradient-blue' | 'gradient-purple' | 'gradient-dark' | 'solid-dark' | 'custom';

interface UIPreferencesState {
    // Background
    backgroundStyle: BackgroundStyle;
    backgroundImage?: string;

    // Visible widgets in right rail
    visibleWidgets: string[]; // 'live-feed', 'stats', 'quick-actions', 'tasks', 'approvals'

    // Widget order
    widgetOrder: string[];

    // Actions
    setBackgroundStyle: (style: BackgroundStyle) => void;
    setBackgroundImage: (image?: string) => void;
    toggleWidgetVisibility: (widgetId: string) => void;
    setVisibleWidgets: (widgets: string[]) => void;
    setWidgetOrder: (order: string[]) => void;
}

// NOTE: Left-panel icon visibility was removed when the legacy LeftPanel was
// deleted (the canonical IconRail is the single source of truth for nav and
// does not support per-icon show/hide). Users who had `visibleIcons` in their
// persisted localStorage will simply have it ignored.
const DEFAULT_VISIBLE_WIDGETS = ['live-feed', 'stats', 'quick-actions', 'tasks', 'approvals'];

export const useUIPreferencesStore = create<UIPreferencesState>()(
    persist(
        (set) => ({
            backgroundStyle: 'gradient-dark',
            visibleWidgets: DEFAULT_VISIBLE_WIDGETS,
            widgetOrder: DEFAULT_VISIBLE_WIDGETS,

            setBackgroundStyle: (style) => set({ backgroundStyle: style }),
            setBackgroundImage: (image) => set({ backgroundImage: image }),

            toggleWidgetVisibility: (widgetId) =>
                set((state) => ({
                    visibleWidgets: state.visibleWidgets.includes(widgetId)
                        ? state.visibleWidgets.filter((w) => w !== widgetId)
                        : [...state.visibleWidgets, widgetId],
                })),

            setVisibleWidgets: (widgets) => set({ visibleWidgets: widgets }),
            setWidgetOrder: (order) => set({ widgetOrder: order }),
        }),
        {
            name: 'ui-preferences-store',
            version: 2,
            migrate: (persistedState, fromVersion) => {
                // v1 → v2: drop legacy `visibleIcons` from the LeftPanel era.
                if (fromVersion < 2 && persistedState && typeof persistedState === 'object') {
                    const { visibleIcons: _ignored, ...rest } = persistedState as Record<string, unknown>;
                    return rest;
                }
                return persistedState;
            },
            merge: (persistedState, currentState) => {
                const ps = (persistedState ?? {}) as Partial<UIPreferencesState>;
                return {
                    ...currentState,
                    ...ps,
                    visibleWidgets: Array.isArray(ps.visibleWidgets) ? ps.visibleWidgets : currentState.visibleWidgets,
                    widgetOrder: Array.isArray(ps.widgetOrder) ? ps.widgetOrder : currentState.widgetOrder,
                };
            },
        }
    )
);