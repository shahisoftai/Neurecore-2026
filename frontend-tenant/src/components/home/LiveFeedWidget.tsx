'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Activity, AlertCircle } from 'lucide-react';
import { GlassPanel } from './GlassPanel';

interface ActivityItem {
    id: string;
    type: 'task' | 'approval' | 'workflow' | 'agent';
    title: string;
    description: string;
    timestamp: Date;
    actor?: string;
}

export function LiveFeedWidget() {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate loading activity feed
        const mockActivities: ActivityItem[] = [
            {
                id: '1',
                type: 'task',
                title: 'New task assigned',
                description: 'Q3 Planning Review',
                timestamp: new Date(Date.now() - 5 * 60000),
                actor: 'John Doe',
            },
            {
                id: '2',
                type: 'approval',
                title: 'Approval requested',
                description: 'Budget Increase Request',
                timestamp: new Date(Date.now() - 15 * 60000),
                actor: 'Sarah Smith',
            },
            {
                id: '3',
                type: 'workflow',
                title: 'Workflow completed',
                description: 'Data Sync Pipeline',
                timestamp: new Date(Date.now() - 30 * 60000),
                actor: 'System',
            },
            {
                id: '4',
                type: 'agent',
                title: 'Agent action',
                description: 'Sales Report Generated',
                timestamp: new Date(Date.now() - 45 * 60000),
                actor: 'AI Agent',
            },
        ];

        setActivities(mockActivities);
        setLoading(false);

        // Real-time updates via WebSocket would go here
    }, []);

    if (loading) {
        return (
            <GlassPanel className="p-6">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
                    <p className="text-zinc-400">Loading feed...</p>
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
