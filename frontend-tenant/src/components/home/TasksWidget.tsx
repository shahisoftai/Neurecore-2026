'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { CheckSquare } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { clsx } from 'clsx';

interface Task {
    id: string;
    title: string;
    priority: 'high' | 'medium' | 'low';
    dueDate?: Date;
    completed: boolean;
}

const mockTasks: Task[] = [
    {
        id: '1',
        title: 'Complete Q3 Planning',
        priority: 'high',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        completed: false,
    },
    {
        id: '2',
        title: 'Review Budget Proposal',
        priority: 'high',
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        completed: false,
    },
    {
        id: '3',
        title: 'Update Team Records',
        priority: 'medium',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        completed: false,
    },
    {
        id: '4',
        title: 'Approve Vendor Contract',
        priority: 'medium',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        completed: true,
    },
];

export function TasksWidget() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setTimeout(() => {
            setTasks(mockTasks);
            setLoading(false);
        }, 300);
    }, []);

    if (loading) {
        return (
            <GlassPanel className="p-6">
                <div className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-green-400 animate-pulse" />
                    <p className="text-zinc-400">Loading tasks...</p>
                </div>
            </GlassPanel>
        );
    }

    const activeTasks = tasks.filter((t) => !t.completed);
    const completedCount = tasks.filter((t) => t.completed).length;

    return (
        <GlassPanel className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <CheckSquare className="w-5 h-5 text-green-400" />
                    <h3 className="text-lg font-semibold text-white">Tasks</h3>
                </div>
                <span className="text-xs bg-green-400/20 text-green-300 px-2 py-1 rounded-full">
                    {completedCount}/{tasks.length}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
                {activeTasks.length === 0 ? (
                    <p className="text-center text-zinc-400 py-8">All tasks completed! 🎉</p>
                ) : (
                    activeTasks.map((task, index) => (
                        <motion.div
                            key={task.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group cursor-pointer"
                        >
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    className="mt-1 w-4 h-4 rounded accent-green-400 cursor-pointer"
                                    defaultChecked={task.completed}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className={clsx(
                                        'text-sm font-medium',
                                        task.completed ? 'line-through text-zinc-500' : 'text-white'
                                    )}>
                                        {task.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={clsx(
                                            'text-xs px-2 py-0.5 rounded-full',
                                            task.priority === 'high' && 'bg-red-400/20 text-red-300',
                                            task.priority === 'medium' && 'bg-yellow-400/20 text-yellow-300',
                                            task.priority === 'low' && 'bg-blue-400/20 text-blue-300',
                                        )}>
                                            {task.priority}
                                        </span>
                                        {task.dueDate && (
                                            <span className="text-xs text-zinc-400">
                                                {formatDueDate(task.dueDate)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </GlassPanel>
    );
}

function formatDueDate(date: Date): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === now.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
