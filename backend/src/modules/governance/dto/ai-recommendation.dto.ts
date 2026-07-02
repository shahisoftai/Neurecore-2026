/**
 * AiRecommendationDto
 *
 * SRP: Represents AI recommendation for an approval
 * Includes confidence score, reasoning, signals, and historical context
 *
 * SOLID: Encapsulates all AI intelligence in one clear structure
 */

import { ApprovalSignalDto, SignalType } from './approval-signal.dto';

export type RecommendationAction = 'APPROVE' | 'REJECT' | 'ESCALATE' | 'REVIEW';

export interface IPastSimilar {
    count: number;
    approvalRate: number; // 0-1
    avgOutcome?: string;
}

export interface IAiRecommendation {
    action: RecommendationAction;
    confidence: number; // 0-100
    reasoning: string;
    signals: ApprovalSignalDto[];
    pastSimilar: IPastSimilar;
}

export class AiRecommendationDto implements IAiRecommendation {
    action!: RecommendationAction;
    confidence!: number; // 0-100
    reasoning!: string;
    signals!: ApprovalSignalDto[];
    pastSimilar!: IPastSimilar;

    constructor(data: IAiRecommendation) {
        this.action = data.action;
        this.confidence = Math.min(Math.max(data.confidence, 0), 100); // Clamp 0-100
        this.reasoning = data.reasoning;
        this.signals = data.signals.map((s) => new ApprovalSignalDto(s));
        this.pastSimilar = data.pastSimilar;
    }

    /**
     * Determines if recommendation confidence is high enough to batch approve
     * DIP: Depends on abstract decision logic, not concrete thresholds
     */
    isHighConfidence(threshold: number = 85): boolean {
        return this.confidence >= threshold;
    }

    /**
     * Calculates recommendation strength for UI display
     */
    getStrength(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
        if (this.confidence >= 90) return 'CRITICAL';
        if (this.confidence >= 75) return 'HIGH';
        if (this.confidence >= 50) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Gets positive signals only (for evidence box)
     */
    getPositiveSignals(): ApprovalSignalDto[] {
        return this.signals.filter((s) => s.isPositive());
    }

    /**
     * Gets negative signals only (for evidence box)
     */
    getNegativeSignals(): ApprovalSignalDto[] {
        return this.signals.filter((s) => s.isNegative());
    }

    /**
     * Gets unknown signals only (for evidence box)
     */
    getUnknownSignals(): ApprovalSignalDto[] {
        return this.signals.filter((s) => s.isUnknown());
    }
}
