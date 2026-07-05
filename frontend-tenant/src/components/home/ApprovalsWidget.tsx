'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { FileCheck, Clock } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { clsx } from 'clsx';

interface Approval {
    id: string;
    title: string;
    requester: string;
    status: 'pending' | 'approved' | 'rejected';
    amount?: number;
    createdAt: Date;
}

const mockApprovals: Approval[] = [
    {
        id: '1',
        title: 'Budget Increase Request',
        requester: 'John Doe',
        status: 'pending',
        amount: 50000,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
        id: '2',
        title: 'New Vendor Contract',
        requester: 'Sarah Smith',
        status: 'pending',
        amount: 25000,
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
    {
        id: '3',
        title: 'Travel Authorization',
        requester: 'Mike Johnson',
        status: 'pending',
        amount: 5000,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
];

export function ApprovalsWidget() {
    const [approvals, setApprovals] = useState<Approval[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setTimeout(() => {
            setApprovals(mockApprovals);
            setLoading(false);
        }, 300);
    }, []);

    if (loading) {
        return (
            <GlassPanel className="p-6">
                <div className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-yellow-400 animate-pulse" />
                    <p className="text-zinc-400">Loading approvals...</p>
                </div>
            </GlassPanel>
        );
    }

    const pendingCount = approvals.filter((a) => a.status === 'pending').length;

    return (
        <GlassPanel className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-semibold text-white">Approvals</h3>
                </div>
                {pendingCount > 0 && (
                    <span className="text-xs bg-yellow-400/20 text-yellow-300 px-2 py-1 rounded-full animate-pulse">
                        {pendingCount} pending
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
                {approvals.length === 0 ? (
                    <p className="text-center text-zinc-400 py-8">No approvals pending</p>
                ) : (
                    approvals.map((approval, index) => (
                        <motion.div
                            key={approval.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={clsx(
                                'p-4 rounded-xl border transition-all duration-300 group cursor-pointer hover:shadow-lg',
                                approval.status === 'pending'
                                    ? 'bg-yellow-400/10 border-yellow-400/30 hover:bg-yellow-400/20'
                                    : approval.status === 'approved'
                                        ? 'bg-green-400/10 border-green-400/30'
                                        : 'bg-red-400/10 border-red-400/30'
                            )}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{approval.title}</p>
                                    <p className="text-xs text-zinc-400 mt-1">by {approval.requester}</p>
                                    {approval.amount && (
                                        <p className="text-sm font-semibold text-white/80 mt-2">
                                            ${approval.amount.toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-400 whitespace-nowrap">
                                    <Clock className="w-4 h-4" />
                                    {formatTime(approval.createdAt)}
                                </div>
                            </div>

                            {approval.status === 'pending' && (
                                <div className="flex gap-2 mt-3">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="flex-1 px-3 py-1.5 rounded-lg bg-green-400/20 text-green-300 text-xs font-medium hover:bg-green-400/30 transition-colors"
                                    >
                                        Approve
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="flex-1 px-3 py-1.5 rounded-lg bg-red-400/20 text-red-300 text-xs font-medium hover:bg-red-400/30 transition-colors"
                                    >
                                        Reject
                                    </motion.button>
                                </div>
                            )}
                        </motion.div>
                    ))
                )}
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
