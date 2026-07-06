'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity, AlertCircle } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { useActivityStore } from '@/stores/activityStore';
import type { ActivityEvent } from '@/types/ui.types';

type ActivityType = ActivityEvent['type'];

interface ActivityItem {
    id: string;
    type: ActivityType;
    title: string;
    description: string;
    timestamp: Date;
    actor: string;
}

export function LiveFeedWidget() {
    const events = useActivityStore((s) => s.events);

    const activities: ActivityItem[] = useMemo(() => {
        if (events.length === 0) return [];
        return events.slice(0, 20).map((e) => ({
            id: e.id,
            type: e.type,
            title: e.message,
            description: e.message,
            timestamp: new Date(e.timestamp),
            actor: e.severity === 'error' ? 'System Alert' : 'System',
        }));
    }, [events]);

    if (activities.length === 0) {
        return (
            <GlassPanel className="p-6">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
                    <p className="text-zinc-400">No recent activity</p>
                </div>
            </GlassPanel>
        );
    }

    return (
        <GlassPanel className="p-6 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Live Feed</h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
                {activities.map((activity, index) => (
                    <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            <div className={clsx(
                                'w-2 h-2 rounded-full mt-2',
                                activity.type === 'task' && 'bg-blue-400',
                                activity.type === 'approval' && 'bg-yellow-400',
                                activity.type === 'workflow' && 'bg-purple-400',
                                activity.type === 'agent' && 'bg-green-400',
                            )} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{activity.title}</p>
                                <p className="text-xs text-zinc-400 truncate">{activity.description}</p>
                                <p className="text-xs text-zinc-500 mt-1">
                                    {activity.actor} • {formatTime(activity.timestamp)}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </GlassPanel>
    );
}

function formatTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
}

import { clsx } from 'clsx';
