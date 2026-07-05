'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';
import {
    Home,
    Bot,
    Building2,
    CheckSquare,
    FileCheck,
    GitBranch,
    BarChart3,
    Plug,
    Lightbulb,
    Cog,
    X,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useUIPreferencesStore } from '@/stores/uiPreferencesStore';
import { clsx } from 'clsx';
import { PreferencesModal } from './PreferencesModal';

interface IconConfig {
    id: string;
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string; // Tailwind gradient class
}

const AVAILABLE_ICONS: IconConfig[] = [
    { id: 'home', label: 'Home', href: '/home', icon: Home, color: 'from-blue-400 to-blue-600' },
    { id: 'agents', label: 'Agents', href: '/agents', icon: Bot, color: 'from-purple-400 to-purple-600' },
    { id: 'departments', label: 'Departments', href: '/departments', icon: Building2, color: 'from-pink-400 to-pink-600' },
    { id: 'tasks', label: 'Tasks', href: '/tasks', icon: CheckSquare, color: 'from-green-400 to-green-600' },
    { id: 'approvals', label: 'Approvals', href: '/approvals', icon: FileCheck, color: 'from-yellow-400 to-yellow-600' },
    { id: 'workflows', label: 'Workflows', href: '/workflows', icon: GitBranch, color: 'from-indigo-400 to-indigo-600' },
    { id: 'analytics', label: 'Analytics', href: '/analytics', icon: BarChart3, color: 'from-cyan-400 to-cyan-600' },
    { id: 'connectors', label: 'Connectors', href: '/connectors', icon: Plug, color: 'from-orange-400 to-orange-600' },
    { id: 'intelligence', label: 'Intelligence', href: '/intelligence', icon: Lightbulb, color: 'from-red-400 to-red-600' },
    { id: 'settings', label: 'Settings', href: '/intelligence?tab=settings', icon: Cog, color: 'from-gray-400 to-gray-600' },
];

interface LeftPanelProps {
    onClose?: () => void;
    isOpen?: boolean;
}

export function LeftPanel({ onClose, isOpen = true }: LeftPanelProps) {
    const visibleIcons = useUIPreferencesStore((s) => s.visibleIcons);
    const [showPreferences, setShowPreferences] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const visibleIconConfigs = AVAILABLE_ICONS.filter((icon) =>
        visibleIcons.find((vi) => vi.id === icon.id && vi.visible)
    );

    if (!isOpen) return null;

    return (
        <>
            <motion.div
                initial={{ x: -400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -400, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="fixed left-0 top-0 h-screen w-[280px] bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-xl border-r border-white/10 shadow-2xl z-40 flex flex-col"
            >
                {/* Header with collapse button */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setCollapsed(!collapsed)}
                        className="rounded-lg p-2 hover:bg-white/10 transition-colors"
                        title={collapsed ? 'Expand' : 'Collapse'}
                    >
                        {collapsed ? (
                            <ChevronRight className="w-5 h-5 text-zinc-400" />
                        ) : (
                            <ChevronLeft className="w-5 h-5 text-zinc-400" />
                        )}
                    </motion.button>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="rounded-lg p-2 hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5 text-zinc-400" />
                        </button>
                    )}
                </div>

                {/* Icons Grid */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {visibleIconConfigs.map((iconConfig, index) => {
                        const Icon = iconConfig.icon;
                        return (
                            <motion.div
                                key={iconConfig.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Link href={iconConfig.href}>
                                    <motion.div
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="flex items-center gap-4 px-3 py-3 rounded-lg hover:bg-white/10 transition-all duration-300 cursor-pointer group"
                                    >
                                        <Icon className="w-6 h-6 text-zinc-300 group-hover:text-white transition-colors" />
                                        <span className="text-zinc-300 group-hover:text-white font-medium text-sm transition-colors">{iconConfig.label}</span>
                                    </motion.div>
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Footer with preference buttons */}
                <div className="border-t border-white/10 p-6 space-y-3">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowPreferences(true)}
                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-zinc-300 text-sm font-medium hover:bg-white/10 hover:border-white/30 transition-all"
                    >
                        Preferences
                    </motion.button>
                </div>
            </motion.div>

            {/* Preferences Modal */}
            <PreferencesModal isOpen={showPreferences} onClose={() => setShowPreferences(false)} />
        </>
    );
}
