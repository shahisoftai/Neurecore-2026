/**
 * RiskBadge.tsx
 *
 * SRP: Display risk level indicator only
 * This component has ONE responsibility: render risk level visually
 *
 * SOLID: Simple, reusable, single purpose
 * - Takes only risk level as input
 * - Returns only visual representation
 * - No side effects, no business logic
 */

import type { FC } from 'react';
import { cn } from '@/lib/utils';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface RiskBadgeProps {
    level: RiskLevel;
    className?: string;
}

const riskConfig = {
    CRITICAL: {
        icon: '🔴',
        label: 'Critical',
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
    },
    HIGH: {
        icon: '🟠',
        label: 'High',
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        border: 'border-orange-300',
    },
    MEDIUM: {
        icon: '🟡',
        label: 'Medium',
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-300',
    },
    LOW: {
        icon: '🟢',
        label: 'Low',
        bg: 'bg-green-100',
        text: 'text-green-700',
        border: 'border-green-300',
    },
};

export const RiskBadge: FC<RiskBadgeProps> = ({ level, className }) => {
    const config = riskConfig[level];

    return (
        <div
            className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border',
                config.bg,
                config.text,
                config.border,
                className,
            )}
            role="status"
            aria-label={`Risk level: ${config.label}`}
        >
            <span>{config.icon}</span>
            <span>{config.label}</span>
        </div>
    );
};
