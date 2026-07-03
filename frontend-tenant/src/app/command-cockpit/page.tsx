/**
 * Command Cockpit - Unified Dashboard
 */

'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckSquare,
    AlertCircle,
    Clock,
    TrendingUp,
    Users,
    Activity,
} from 'lucide-react';

import { ApprovalHub } from '@/components/approvals/ApprovalHub';
import { ImpactTimeline } from '@/components/timeline/ImpactTimeline';
import { DependencyGraph } from '@/components/context/DependencyGraph';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';

import {
    generateMockApprovals,
    generateMockTimelineEvents,
    generateMockDependencies,
} from '@/lib/mock-data';

// ─── Types ──────────────────────────────────────────────────────────

interface CockpitStats {
    totalApprovals: number;
    criticalCount: number;
    blockersCount: number;
    upstreamWaiters: number;
}

// ─── Health Ring Component ──────────────────────────────────────────

interface HealthRingProps {
    criticalCount: number;
    totalApprovals: number;
    blockersCount: number;
}

const HealthRing = ({
    criticalCount,
    totalApprovals,
    blockersCount,
}: HealthRingProps) => {
    const healthPercentage = Math.max(
        0,
        100 - (criticalCount / Math.max(1, totalApprovals)) * 60 - (blockersCount * 20)
    );
    const healthStatus =
        healthPercentage >= 80 ? 'healthy' : healthPercentage >= 50 ? 'warning' : 'critical';
    const healthColor =
        healthStatus === 'healthy'
            ? '#10b981'
            : healthStatus === 'warning'
                ? '#f59e0b'
                : '#ef4444';

    return (
        <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-lg border border-gray-200">
            <div className="text-sm font-medium text-gray-600">Company Health</div>

            <div className="relative w-24 h-24">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="8"
                    />
                    <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={healthColor}
                        strokeWidth="8"
                        strokeDasharray={`${(healthPercentage / 100) * 283} 283`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dasharray 0.6s ease' }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color: healthColor }}>
                        {Math.round(healthPercentage)}%
                    </span>
                </div>
            </div>

            <div className="text-xs text-gray-500 text-center">
                {healthStatus === 'healthy' ? '✅ All systems' : '⚠️ Needs'} attention
            </div>
        </div>
    );
};

// ─── Quick Stats Component ──────────────────────────────────────────

interface QuickStatsProps {
    stats: CockpitStats;
}

const QuickStats = ({ stats }: QuickStatsProps) => {
    const statItems = [
        {
            icon: CheckSquare,
            label: 'Waiting Approvals',
            value: stats.totalApprovals,
            color: 'bg-blue-100 text-blue-700',
        },
        {
            icon: AlertCircle,
            label: 'Critical',
            value: stats.criticalCount,
            color: 'bg-red-100 text-red-700',
        },
        {
            icon: Clock,
            label: 'Blockers',
            value: stats.blockersCount,
            color: 'bg-orange-100 text-orange-700',
        },
        {
            icon: TrendingUp,
            label: 'Dependencies',
            value: stats.upstreamWaiters,
            color: 'bg-purple-100 text-purple-700',
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3">
            {statItems.map((item, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`p-3 rounded-lg border border-gray-200 ${item.color}`}
                >
                    <div className="flex items-center gap-2">
                        <item.icon className="w-4 h-4" />
                        <span className="text-xs font-medium">{item.label}</span>
                    </div>
                    <div className="text-2xl font-bold mt-1">{item.value}</div>
                </motion.div>
            ))}
        </div>
    );
};

// ─── Main Cockpit Component ─────────────────────────────────────────

export default function CommandCockpit() {
    const user = useTenantAuth();
    const [approvalActionLoading, setApprovalActionLoading] = useState(false);

    // Show loading while auth hydrates
    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin mb-4 text-2xl">⏳</div>
                    <p className="text-gray-600">Loading Command Cockpit...</p>
                </div>
            </div>
        );
    }

    // Load mock data
    const mockApprovals = useMemo(() => generateMockApprovals(), []);
    const mockTimeline = useMemo(() => generateMockTimelineEvents(), []);
    const mockDependencies = useMemo(() => generateMockDependencies(), []);

    // Calculate stats
    const stats: CockpitStats = useMemo(
        () => ({
            totalApprovals: mockApprovals.count.critical + mockApprovals.count.high,
            criticalCount: mockApprovals.count.critical,
            blockersCount: mockTimeline.filter((e) => e.type === 'BLOCKER').length,
            upstreamWaiters: mockDependencies.upstreamBlockers.length,
        }),
        [mockApprovals, mockTimeline, mockDependencies]
    );

    // Approval actions
    const handleApprove = async (id: string) => {
        setApprovalActionLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('Approved:', id);
        setApprovalActionLoading(false);
    };

    const handleReject = async (id: string) => {
        setApprovalActionLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('Rejected:', id);
        setApprovalActionLoading(false);
    };

    const handleEscalate = async (id: string) => {
        setApprovalActionLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('Escalated:', id);
        setApprovalActionLoading(false);
    };

    const handleReview = async (id: string) => {
        setApprovalActionLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log('Review:', id);
        setApprovalActionLoading(false);
    };

    return (
        <TenantShell user={user}>
            <div className="space-y-6">
                {/* HEADER */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start justify-between gap-4"
                >
                    <div>
                        <div className="flex items-center gap-2">
                            <Activity className="w-6 h-6 text-blue-600" />
                            <h1 className="text-3xl font-bold text-gray-900">
                                Command Cockpit
                            </h1>
                        </div>
                        <p className="text-gray-600 mt-1">
                            Your unified control center for company management & decision-making
                        </p>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                        <p>Last updated: {new Date().toLocaleTimeString()}</p>
                        <p className="text-green-600 font-medium">🟢 Real-time sync enabled</p>
                    </div>
                </motion.div>

                {/* THREE-COLUMN LAYOUT */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* LEFT: APPROVALS + HEALTH */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="lg:col-span-1 space-y-4"
                    >
                        <HealthRing
                            criticalCount={stats.criticalCount}
                            totalApprovals={stats.totalApprovals}
                            blockersCount={stats.blockersCount}
                        />
                        <QuickStats stats={stats} />
                    </motion.div>

                    {/* CENTER: IMPACT TIMELINE */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <AlertCircle className="w-5 h-5 text-orange-600" />
                            <h2 className="text-lg font-semibold text-gray-900">
                                Impact Timeline
                            </h2>
                            <span className="ml-auto text-xs text-gray-500">
                                {mockTimeline.length} events
                            </span>
                        </div>
                        <ImpactTimeline
                            events={mockTimeline}
                            maxHeight="600px"
                            showScrollGradient
                        />
                    </motion.div>

                    {/* RIGHT: CONTEXT & DEPENDENCIES */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className="lg:col-span-1 bg-white rounded-lg border border-gray-200 p-6"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="w-5 h-5 text-purple-600" />
                            <h2 className="text-lg font-semibold text-gray-900">
                                Dependencies
                            </h2>
                        </div>
                        <DependencyGraph
                            upstreamBlockers={mockDependencies.upstreamBlockers}
                            downstreamWaiters={mockDependencies.downstreamWaiters}
                        />
                    </motion.div>
                </div>

                {/* BOTTOM: FULL-WIDTH APPROVALS QUEUE */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white rounded-lg border border-gray-200 p-6"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg font-semibold text-gray-900">
                            Approval Queue
                        </h2>
                        <span className="ml-auto text-xs text-gray-500 font-medium">
                            {stats.totalApprovals} pending
                        </span>
                    </div>

                    <ApprovalHub
                        approvals={mockApprovals}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onEscalate={handleEscalate}
                        onReview={handleReview}
                        isLoading={approvalActionLoading}
                    />
                </motion.div>

                {/* INFO BANNER */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900"
                >
                    <p className="font-medium">💡 Pro Tip:</p>
                    <p>
                        Use{' '}
                        <kbd className="px-2 py-1 bg-white rounded border border-blue-300 text-xs font-mono">
                            Cmd+K
                        </kbd>{' '}
                        to quickly navigate to any approval, timeline event, or department.
                    </p>
                </motion.div>
            </div>
        </TenantShell>
    );
}
