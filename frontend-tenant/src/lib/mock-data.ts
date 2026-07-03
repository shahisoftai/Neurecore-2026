/**
 * Mock Data Generator for UI Features
 *
 * Provides comprehensive mock data for:
 * 1. Risk-stratified approvals
 * 2. Impact timeline events
 * 3. Cross-department context & dependencies
 */

import type { TimelineEvent } from '@/components/timeline/types';
import type { DependencyGraphProps } from '@/components/context/types';

// ─── APPROVAL MOCKS ─────────────────────────────────────────────────

export interface MockApproval {
    id: string;
    title: string;
    description?: string;
    status: string;
    riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    amount?: number;
    aiRecommendation: {
        action: 'APPROVE' | 'REJECT' | 'ESCALATE' | 'REVIEW';
        confidence: number;
        reasoning: string;
        signals: Array<{
            type: 'POSITIVE' | 'NEGATIVE' | 'UNKNOWN' | 'RISK';
            description: string;
            weight: number;
        }>;
        pastSimilar: {
            count: number;
            approvalRate: number;
            avgOutcome?: string;
        };
    };
    canBatchApprove?: boolean;
    department?: string;
    requester?: { name: string; email: string };
    deadline?: string;
    createdAt?: string;
}

export const generateMockApprovals = (): {
    critical: MockApproval[];
    high: MockApproval[];
    medium: MockApproval[];
    low: MockApproval[];
    count: { critical: number; high: number; medium: number; low: number };
} => {
    const criticalApprovals: MockApproval[] = [
        {
            id: 'ap-001',
            title: 'Enterprise License Renewal - Acme Corp ($250K)',
            description: 'Annual renewal for Acme Corp enterprise license with new feature tier',
            status: 'pending_approval',
            riskLevel: 'CRITICAL',
            amount: 250000,
            department: 'sales',
            requester: { name: 'Alex Wilson', email: 'alex@neurecore.io' },
            deadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            aiRecommendation: {
                action: 'APPROVE',
                confidence: 87,
                reasoning:
                    'Acme Corp has 87% renewal rate, 5-year relationship, no payment issues. Similar deals: 12 renewals, 92% approval rate',
                signals: [
                    {
                        type: 'POSITIVE',
                        description: 'Strong payment history',
                        weight: 100,
                    },
                    {
                        type: 'POSITIVE',
                        description: '5+ year customer relationship',
                        weight: 95,
                    },
                    {
                        type: 'POSITIVE',
                        description: 'Enterprise tier upsell approved',
                        weight: 85,
                    },
                    {
                        type: 'UNKNOWN',
                        description: 'New data center requirement unverified',
                        weight: 40,
                    },
                ],
                pastSimilar: {
                    count: 12,
                    approvalRate: 0.92,
                    avgOutcome: '$195K average deal size',
                },
            },
            canBatchApprove: false,
        },
        {
            id: 'ap-002',
            title: 'Budget Override - Q3 Marketing Spend (+$80K)',
            description: 'Emergency budget override for Black Friday campaign launch',
            status: 'pending_approval',
            riskLevel: 'CRITICAL',
            amount: 80000,
            department: 'marketing',
            requester: { name: 'Sarah Chen', email: 'sarah@neurecore.io' },
            deadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            aiRecommendation: {
                action: 'REVIEW',
                confidence: 62,
                reasoning:
                    'Large overspend but seasonal. Similar campaigns: 8 approvals, 75% ROI positive. Recommend exec review due to timing pressure.',
                signals: [
                    {
                        type: 'POSITIVE',
                        description: 'Historical ROI on seasonal campaigns: 2.3x',
                        weight: 90,
                    },
                    {
                        type: 'NEGATIVE',
                        description: 'Exceeds monthly budget by 40%',
                        weight: 85,
                    },
                    {
                        type: 'UNKNOWN',
                        description: 'Black Friday timing - market volatility factor',
                        weight: 60,
                    },
                    {
                        type: 'RISK',
                        description: 'Delayed CFO approval notification',
                        weight: 55,
                    },
                ],
                pastSimilar: {
                    count: 8,
                    approvalRate: 0.75,
                    avgOutcome: 'Avg $120K spend, 2.3x ROI',
                },
            },
            canBatchApprove: false,
        },
    ];

    const highApprovals: MockApproval[] = [
        {
            id: 'ap-003',
            title: 'New Contractor Onboarding - Senior ML Engineer',
            description: '6-month contract with TensorFlow specialist for Atlas v2 project',
            status: 'pending_approval',
            riskLevel: 'HIGH',
            amount: 45000,
            department: 'engineering',
            requester: { name: 'Mike Rodriguez', email: 'mike@neurecore.io' },
            deadline: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            aiRecommendation: {
                action: 'APPROVE',
                confidence: 79,
                reasoning:
                    'Contractor has prior company history, good references. Atlas v2 critical path impact. Similar contracts: 6, 83% success rate.',
                signals: [
                    {
                        type: 'POSITIVE',
                        description: 'Contractor verified credentials & references',
                        weight: 95,
                    },
                    {
                        type: 'POSITIVE',
                        description: 'Critical path for Atlas v2 delivery',
                        weight: 88,
                    },
                    {
                        type: 'UNKNOWN',
                        description:
                            'Contract start date during company audit period',
                        weight: 35,
                    },
                ],
                pastSimilar: {
                    count: 6,
                    approvalRate: 0.83,
                    avgOutcome: 'Avg 5.8 month tenure, 4.2/5 performance',
                },
            },
            canBatchApprove: false,
        },
    ];

    const mediumApprovals: MockApproval[] = [
        {
            id: 'ap-004',
            title: 'Software License Upgrade - Figma Team Plan',
            description: 'Annual upgrade from Figma Professional to Team plan',
            status: 'pending_approval',
            riskLevel: 'MEDIUM',
            amount: 8000,
            department: 'design',
            requester: { name: 'Emily Park', email: 'emily@neurecore.io' },
            deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            aiRecommendation: {
                action: 'APPROVE',
                confidence: 94,
                reasoning:
                    'Routine software license upgrade. Budget approved. 15 team members. Similar upgrades: 23, 100% approval rate.',
                signals: [
                    {
                        type: 'POSITIVE',
                        description: 'Within approved software budget',
                        weight: 100,
                    },
                    {
                        type: 'POSITIVE',
                        description: 'Routine annual upgrade pattern',
                        weight: 98,
                    },
                    {
                        type: 'POSITIVE',
                        description: 'Cross-team collaboration enablement',
                        weight: 85,
                    },
                ],
                pastSimilar: {
                    count: 23,
                    approvalRate: 1.0,
                    avgOutcome: 'All routine upgrades approved',
                },
            },
            canBatchApprove: true,
        },
    ];

    const lowApprovals: MockApproval[] = [
        {
            id: 'ap-005',
            title: 'Team Offsire Dinner - Q3 Team Building',
            description: 'Quarterly team dinner at local steakhouse (18 people)',
            status: 'pending_approval',
            riskLevel: 'LOW',
            amount: 1200,
            department: 'operations',
            requester: { name: 'James Wong', email: 'james@neurecore.io' },
            deadline: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            aiRecommendation: {
                action: 'APPROVE',
                confidence: 99,
                reasoning:
                    'Standard team building expense within policy. Approved venue. Similar events: 4, 100% approval rate.',
                signals: [
                    {
                        type: 'POSITIVE',
                        description: 'Within team building budget allocation',
                        weight: 100,
                    },
                    {
                        type: 'POSITIVE',
                        description: 'Scheduled Q3 team event',
                        weight: 95,
                    },
                    {
                        type: 'POSITIVE',
                        description: 'Approved vendor on company list',
                        weight: 100,
                    },
                ],
                pastSimilar: {
                    count: 4,
                    approvalRate: 1.0,
                    avgOutcome: 'All team events approved',
                },
            },
            canBatchApprove: true,
        },
        {
            id: 'ap-006',
            title: 'Training Course - Advanced React Patterns',
            description:
                'Udemy course subscription for frontend team professional development',
            status: 'pending_approval',
            riskLevel: 'LOW',
            amount: 450,
            department: 'engineering',
            requester: { name: 'John Smith', email: 'john@neurecore.io' },
            deadline: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            aiRecommendation: {
                action: 'APPROVE',
                confidence: 97,
                reasoning:
                    'Professional development within training budget. React skills map to current projects. Similar requests: 12, 100% approval rate.',
                signals: [
                    {
                        type: 'POSITIVE',
                        description: 'Skills align with current project needs',
                        weight: 98,
                    },
                    {
                        type: 'POSITIVE',
                        description: 'Within training & development budget',
                        weight: 100,
                    },
                    {
                        type: 'POSITIVE',
                        description: 'From approved training provider',
                        weight: 95,
                    },
                ],
                pastSimilar: {
                    count: 12,
                    approvalRate: 1.0,
                    avgOutcome: 'All training requests approved',
                },
            },
            canBatchApprove: true,
        },
    ];

    return {
        critical: criticalApprovals,
        high: highApprovals,
        medium: mediumApprovals,
        low: lowApprovals,
        count: {
            critical: criticalApprovals.length,
            high: highApprovals.length,
            medium: mediumApprovals.length,
            low: lowApprovals.length,
        },
    };
};

// ─── TIMELINE MOCKS ─────────────────────────────────────────────────

export const generateMockTimelineEvents = (): TimelineEvent[] => [
    {
        id: 'evt-001',
        type: 'APPROVAL_NEEDED',
        title: 'Acme Corp License Renewal Awaiting Your Decision',
        description:
            'AI recommends approval (87% confidence). 2 hours until deadline. Revenue impact: $250K',
        impact: 'CRITICAL',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        icon: '🔴',
        actions: [
            {
                label: 'View Approval',
                action: 'navigate',
                target: '/service-desk?tab=approvals&focus=ap-001',
                isPrimary: true,
            },
            { label: 'Dismiss', action: 'dismiss' },
        ],
        metadata: {
            relatedDept: 'sales',
            relatedApprovals: ['ap-001'],
            estimatedImpact: '$250,000 revenue',
        },
    },
    {
        id: 'evt-002',
        type: 'BLOCKER',
        title: 'Atlas v2 ML Pipeline Blocked - Awaiting Decision',
        description:
            'ML Engineer contract approval (45K) unresolved. Blocks 2-week delivery timeline.',
        impact: 'CRITICAL',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        icon: '🛑',
        actions: [
            {
                label: 'Approve Contract',
                action: 'navigate',
                target: '/service-desk?tab=approvals&focus=ap-003',
                isPrimary: true,
            },
        ],
        metadata: {
            relatedDept: 'engineering',
            relatedApprovals: ['ap-003'],
            dependentTeams: ['engineering', 'product'],
            estimatedImpact: 'Delays project 14 days',
        },
    },
    {
        id: 'evt-003',
        type: 'ACTION_TAKEN',
        title: 'Invoice Approved - TechVendor Security Audit',
        description: 'Automated approval processed: $18,500 security audit invoice',
        impact: 'HIGH',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        icon: '✅',
        read: true,
        metadata: {
            relatedDept: 'finance',
            approvalId: 'ap-batch-002',
            vendor: 'TechVendor Inc',
        },
    },
    {
        id: 'evt-004',
        type: 'OPPORTUNITY',
        title: 'Revenue Opportunity: New Partner Deal Flow',
        description:
            'Stripe integration complete. 3 new deal opportunities identified from partner network.',
        impact: 'HIGH',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        icon: '💰',
        actions: [
            {
                label: 'View Opportunities',
                action: 'navigate',
                target: '/intelligence/opportunities',
                isPrimary: true,
            },
        ],
        metadata: {
            relatedDept: 'sales',
            estimatedValue: '$320,000 potential',
            dealCount: 3,
        },
    },
    {
        id: 'evt-005',
        type: 'FYI',
        title: 'Marketing Q3 Budget Refresh Complete',
        description: 'Budget override approval received. Black Friday campaign ready to launch.',
        impact: 'MEDIUM',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        icon: '📢',
        read: true,
        metadata: {
            relatedDept: 'marketing',
            budgetAmount: '$80,000',
        },
    },
    {
        id: 'evt-006',
        type: 'ALERT',
        title: 'High Team Utilization in Engineering',
        description:
            'Atlas v2 team at 94% capacity. Recommend contractor hiring or task redistribution.',
        impact: 'MEDIUM',
        timestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
        icon: '⚠️',
        actions: [
            {
                label: 'View Team Health',
                action: 'navigate',
                target: '/departments?dept=engineering',
            },
        ],
        metadata: {
            relatedDept: 'engineering',
            utilizationScore: 94,
            recommendation: 'Contractor hiring',
        },
    },
];

// ─── DEPENDENCY GRAPH MOCKS ─────────────────────────────────────────

export const generateMockDependencies = (): DependencyGraphProps => ({
    upstreamBlockers: [
        {
            id: 'dep-up-001',
            source: 'Finance',
            description:
                'Q3 budget approval pending - blocks spending on new tools',
            estimatedHours: 4,
            priority: 'HIGH',
        },
        {
            id: 'dep-up-002',
            source: 'Legal',
            description: 'NDA review for vendor contract',
            estimatedHours: 8,
            priority: 'MEDIUM',
        },
        {
            id: 'dep-up-003',
            source: 'Security',
            description: 'SOC 2 compliance audit in progress',
            estimatedHours: 16,
            priority: 'HIGH',
        },
    ],
    downstreamWaiters: [
        {
            id: 'dep-down-001',
            target: 'Product',
            description: 'Waiting on your approval to launch beta features',
            estimatedHours: 0,
            priority: 'HIGH',
        },
        {
            id: 'dep-down-002',
            target: 'Marketing',
            description: 'Blocked on go-to-market timeline decision',
            estimatedHours: 2,
            priority: 'MEDIUM',
        },
        {
            id: 'dep-down-003',
            target: 'Sales',
            description: 'Sales deck refresh depends on product roadmap clarity',
            estimatedHours: 6,
            priority: 'LOW',
        },
    ],
    onBlockerClick: (id: string) => {
        console.log('Blocker clicked:', id);
    },
});
