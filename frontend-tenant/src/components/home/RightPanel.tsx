'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, Eye, EyeOff, MoreVertical } from 'lucide-react';
import { useUIPreferencesStore } from '@/stores/uiPreferencesStore';
import { LiveFeedWidget } from './LiveFeedWidget';
import { StatsWidget } from './StatsWidget';
import { QuickActionsWidget } from './QuickActionsWidget';
import { TasksWidget } from './TasksWidget';
import { ApprovalsWidget } from './ApprovalsWidget';
import { clsx } from 'clsx';

const WIDGET_MAP: Record<string, { component: React.ComponentType; label: string; icon?: string }> = {
    'live-feed': { component: LiveFeedWidget, label: 'Live Feed' },
    'stats': { component: StatsWidget, label: 'Performance Stats' },
    'quick-actions': { component: QuickActionsWidget, label: 'Quick Actions' },
    'tasks': { component: TasksWidget, label: 'Tasks' },
    'approvals': { component: ApprovalsWidget, label: 'Approvals' },
};

interface WidgetConfig {
    id: string;
    visible: boolean;
    collapsed?: boolean;
}

interface RightPanelProps {
    className?: string;
}

export function RightPanel({ className }: RightPanelProps) {
    const visibleWidgetsRaw = useUIPreferencesStore((s) => s.visibleWidgets);
    const visibleWidgets = Array.isArray(visibleWidgetsRaw) ? visibleWidgetsRaw : [];
    const toggleWidgetVisibility = useUIPreferencesStore((s) => s.toggleWidgetVisibility);
    const [collapsedWidgets, setCollapsedWidgets] = useState<Record<string, boolean>>({});
    const [showMenu, setShowMenu] = useState<string | null>(null);

    const toggleCollapsed = (widgetId: string) => {
        setCollapsedWidgets((prev) => ({
            ...prev,
            [widgetId]: !prev[widgetId],
        }));
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={clsx('flex flex-col gap-4 h-full overflow-y-auto pb-4', className)}
        >
            {visibleWidgets.map((widgetId, index) => {
                const widget = WIDGET_MAP[widgetId];
                const isCollapsed = collapsedWidgets[widgetId];

                if (!widget) return null;

                const Component = widget.component;

                return (
                    <motion.div
                        key={widgetId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative"
                    >
                        {/* Widget Header */}
                        <div className="flex items-center justify-between mb-2 px-2">
                            <button
                                onClick={() => toggleCollapsed(widgetId)}
                                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                            >
                                <ChevronDown
                                    className={clsx(
                                        'w-4 h-4 text-zinc-400 transition-transform',
                                        isCollapsed && '-rotate-90'
                                    )}
                                />
                                <span className="text-xs font-medium text-zinc-400 uppercase">{widget.label}</span>
                            </button>

                            <div className="relative">
                                <button
                                    onClick={() => setShowMenu(showMenu === widgetId ? null : widgetId)}
                                    className="p-1 rounded hover:bg-white/10 transition-colors"
                                >
                                    <MoreVertical className="w-4 h-4 text-zinc-400" />
                                </button>

                                {showMenu === widgetId && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute right-0 mt-2 w-48 bg-slate-900 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden"
                                    >
                                        <button
                                            onClick={() => {
                                                toggleWidgetVisibility(widgetId);
                                                setShowMenu(null);
                                            }}
                                            className="w-full px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 flex items-center gap-2 transition-colors"
                                        >
                                            <EyeOff className="w-4 h-4" />
                                            Hide Widget
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                        </div>

                        {/* Widget Content */}
                        {!isCollapsed && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="min-h-[250px] max-h-[400px]"
                            >
                                <Component />
                            </motion.div>
                        )}
                    </motion.div>
                );
            })}

            {/* Hidden Widgets Toggle */}
            {Object.keys(WIDGET_MAP).length > visibleWidgets.length && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-2 pt-4 border-t border-white/10"
                >
                    <button className="w-full text-sm text-zinc-400 hover:text-zinc-300 transition-colors flex items-center gap-2 justify-center py-2">
                        <Eye className="w-4 h-4" />
                        Show Hidden Widgets
                    </button>
                </motion.div>
            )}
        </motion.div>
    );
}
