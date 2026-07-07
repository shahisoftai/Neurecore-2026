import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BackgroundStyle = 'gradient-blue' | 'gradient-purple' | 'gradient-dark' | 'solid-dark' | 'custom';

export interface VisibleIcon {
    id: string;
    visible: boolean;
}

interface UIPreferencesState {
    // Background
    backgroundStyle: BackgroundStyle;
    backgroundImage?: string;

    // Visible icons in left panel
    visibleIcons: VisibleIcon[];

    // Visible widgets in right panel
    visibleWidgets: string[]; // 'live-feed', 'stats', 'quick-actions', 'tasks', 'approvals'

    // Widget order
    widgetOrder: string[];

    // Actions
    setBackgroundStyle: (style: BackgroundStyle) => void;
    setBackgroundImage: (image?: string) => void;
    toggleIconVisibility: (iconId: string) => void;
    setVisibleIcons: (icons: VisibleIcon[]) => void;
    toggleWidgetVisibility: (widgetId: string) => void;
    setVisibleWidgets: (widgets: string[]) => void;
    setWidgetOrder: (order: string[]) => void;
}

const DEFAULT_VISIBLE_ICONS: VisibleIcon[] = [
    { id: 'home', visible: true },
    { id: 'agents', visible: true },
    { id: 'departments', visible: true },
    { id: 'tasks', visible: true },
    { id: 'approvals', visible: true },
    { id: 'workflows', visible: true },
    { id: 'analytics', visible: true },
    { id: 'settings', visible: true },
];

const DEFAULT_VISIBLE_WIDGETS = ['live-feed', 'stats', 'quick-actions', 'tasks', 'approvals'];

export const useUIPreferencesStore = create<UIPreferencesState>()(
    persist(
        (set) => ({
            backgroundStyle: 'gradient-dark',
            visibleIcons: DEFAULT_VISIBLE_ICONS,
            visibleWidgets: DEFAULT_VISIBLE_WIDGETS,
            widgetOrder: DEFAULT_VISIBLE_WIDGETS,

            setBackgroundStyle: (style) => set({ backgroundStyle: style }),
            setBackgroundImage: (image) => set({ backgroundImage: image }),

            toggleIconVisibility: (iconId) =>
                set((state) => ({
                    visibleIcons: state.visibleIcons.map((icon) =>
                        icon.id === iconId ? { ...icon, visible: !icon.visible } : icon
                    ),
                })),

            setVisibleIcons: (icons) => set({ visibleIcons: icons }),

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
            version: 1,
            merge: (persistedState, currentState) => {
                const ps = (persistedState ?? {}) as Partial<UIPreferencesState>;
                return {
                    ...currentState,
                    ...ps,
                    visibleIcons: Array.isArray(ps.visibleIcons) ? ps.visibleIcons : currentState.visibleIcons,
                    visibleWidgets: Array.isArray(ps.visibleWidgets) ? ps.visibleWidgets : currentState.visibleWidgets,
                    widgetOrder: Array.isArray(ps.widgetOrder) ? ps.widgetOrder : currentState.widgetOrder,
                };
            },
        }
    )
);
