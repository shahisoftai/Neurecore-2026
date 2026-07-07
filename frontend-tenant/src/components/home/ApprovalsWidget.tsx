'use client';

import { motion } from 'framer-motion';
import { FileCheck, Clock } from 'lucide-react';
import { GlassPanel } from './GlassPanel';
import { useApprovals } from '@/hooks/useApprovals';
import { clsx } from 'clsx';

export function ApprovalsWidget() {
    const { critical, routine, isLoading } = useApprovals();

    const pendingApprovals = [
        ...(Array.isArray(critical) ? critical : []),
        ...(Array.isArray(routine) ? routine : []),
    ];

    const pendingCount = pendingApprovals.length;

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

            <div className="flex-1 overflow-y-auto space-y-2">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-zinc-500 text-sm">
                        <Clock className="w-3 h-3 animate-spin" />
                        Loading approvals...
                    </div>
                ) : pendingCount === 0 ? (
                    <p className="text-zinc-500 text-sm text-center py-4">No pending approvals</p>
                ) : (
                    pendingApprovals.slice(0, 8).map((approval, index) => (
                        <motion.div
                            key={approval.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                            <div className="flex items-start gap-3">
                                <span className={clsx(
                                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                                approval.riskLevel === 'CRITICAL' || approval.riskLevel === 'HIGH' ? 'bg-red-400' :
                                approval.riskLevel === 'MEDIUM' ? 'bg-yellow-400' :
                                    'bg-green-400',
                                )} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">{approval.title}</p>
                                    {approval.description && (
                                        <p className="text-xs text-zinc-400 truncate">{approval.description}</p>
                                    )}
                                    {approval.amount != null && (
                                        <p className="text-xs text-zinc-500 mt-1">
                                            ${approval.amount.toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </GlassPanel>
    );
}
