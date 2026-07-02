/**
 * EvidenceBox.tsx
 *
 * SRP: Display grouped signals (evidence) of a specific type
 * Groups POSITIVE, NEGATIVE, or UNKNOWN signals together
 *
 * SOLID: Reusable container for any signal type
 * - Takes array of signals and filters by type
 * - Only renders if signals exist
 * - Clean, focused presentation
 */

import type { FC } from 'react';
import { ApprovalSignalDisplay, SignalType } from './ApprovalSignalDisplay';
import { cn } from '@/lib/utils';

interface ApprovalSignal {
    type: SignalType;
    description: string;
    weight: number;
}

interface EvidenceBoxProps {
    signals: ApprovalSignal[];
    type: SignalType;
    title?: string;
    className?: string;
}

const evidenceConfig = {
    [SignalType.POSITIVE]: {
        title: 'Supporting Factors',
        icon: '✓',
        color: 'green',
    },
    [SignalType.NEGATIVE]: {
        title: 'Areas of Concern',
        icon: '⚠',
        color: 'red',
    },
    [SignalType.UNKNOWN]: {
        title: 'Unknown Factors',
        icon: '?',
        color: 'gray',
    },
};

export const EvidenceBox: FC<EvidenceBoxProps> = ({
    signals,
    type,
    title,
    className,
}) => {
    const filteredSignals = signals.filter((s) => s.type === type);

    // Don't render if no signals of this type
    if (filteredSignals.length === 0) {
        return null;
    }

    const config = evidenceConfig[type];
    const displayTitle = title || config.title;

    return (
        <div
            className={cn('evidence-box', className)}
            role="region"
            aria-label={displayTitle}
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{config.icon}</span>
                <h4 className="text-sm font-semibold text-gray-700">{displayTitle}</h4>
                <span className="ml-auto text-xs text-gray-500">
                    {filteredSignals.length}{' '}
                    {filteredSignals.length === 1 ? 'signal' : 'signals'}
                </span>
            </div>

            {/* Signals */}
            <div className="space-y-2">
                {filteredSignals.map((signal, idx) => (
                    <ApprovalSignalDisplay key={idx} signal={signal} />
                ))}
            </div>
        </div>
    );
};
