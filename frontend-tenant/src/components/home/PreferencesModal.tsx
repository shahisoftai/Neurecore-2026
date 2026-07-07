'use client';

import { motion } from 'framer-motion';
import { useUIPreferencesStore } from '@/stores/uiPreferencesStore';
import { GlassPanel } from './GlassPanel';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface PreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const BACKGROUNDS = [
    { id: 'gradient-dark', label: 'Dark Gradient', color: 'from-slate-900 via-slate-950 to-slate-950' },
    { id: 'gradient-blue', label: 'Blue Gradient', color: 'from-blue-950 via-slate-900 to-slate-950' },
    { id: 'gradient-purple', label: 'Purple Gradient', color: 'from-purple-950 via-slate-900 to-slate-950' },
    { id: 'solid-dark', label: 'Solid Dark', color: 'bg-slate-950' },
];

export function PreferencesModal({ isOpen, onClose }: PreferencesModalProps) {
    const backgroundStyle = useUIPreferencesStore((s) => s.backgroundStyle);
    const setBackgroundStyle = useUIPreferencesStore((s) => s.setBackgroundStyle);
    const visibleWidgetsRaw = useUIPreferencesStore((s) => s.visibleWidgets);
    const visibleWidgets = Array.isArray(visibleWidgetsRaw) ? visibleWidgetsRaw : [];
    const toggleWidgetVisibility = useUIPreferencesStore((s) => s.toggleWidgetVisibility);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-white/20 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            >
                {/* Header */}
                <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900/90 backdrop-blur">
                    <h2 className="text-xl font-bold text-white">Preferences</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Background Selection */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4">Dashboard Background</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {BACKGROUNDS.map((bg) => (
                                <button
                                    key={bg.id}
                                    onClick={() => {
                                        setBackgroundStyle(bg.id as any);
                                    }}
                                    className={clsx(
                                        'relative p-4 rounded-xl border-2 transition-all duration-300',
                                        backgroundStyle === bg.id
                                            ? 'border-purple-500 ring-2 ring-purple-500/50'
                                            : 'border-white/10 hover:border-white/20'
                                    )}
                                >
                                    <div className={clsx(
                                        'w-full h-24 rounded-lg mb-2 bg-gradient-to-br',
                                        bg.color,
                                    )} />
                                    <p className="text-sm font-medium text-white text-center">{bg.label}</p>
                                    {backgroundStyle === bg.id && (
                                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Widget Visibility */}
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-4">Right Panel Widgets</h3>
                        <div className="space-y-3">
                            {[
                                { id: 'live-feed', label: 'Live Feed' },
                                { id: 'stats', label: 'Performance Stats' },
                                { id: 'quick-actions', label: 'Quick Actions' },
                                { id: 'tasks', label: 'Tasks' },
                                { id: 'approvals', label: 'Approvals' },
                            ].map((widget) => (
                                <label key={widget.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={visibleWidgets.includes(widget.id)}
                                        onChange={() => toggleWidgetVisibility(widget.id)}
                                        className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
                                    />
                                    <span className="text-sm text-zinc-300">{widget.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 border-t border-white/10 bg-slate-900/90 backdrop-blur px-6 py-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
                    >
                        Done
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
