/**
 * ApprovalScoringService
 *
 * SRP: Single Responsibility - Calculate approval confidence score
 * This service ONLY does scoring. It doesn't fetch data, it doesn't enrich approvals.
 * It's pure logic: given signals and context, calculate confidence.
 *
 * SOLID: Dependency Inversion - depends on abstract signal interface, not concrete types
 */

import { Injectable, Logger } from '@nestjs/common';
import { ApprovalSignalDto, SignalType } from '../dto/approval-signal.dto';
import { AiRecommendationDto, RecommendationAction } from '../dto/ai-recommendation.dto';

export interface ISignalWeights {
    positive: number;
    negative: number;
    unknown: number;
}

@Injectable()
export class ApprovalScoringService {
    private readonly logger = new Logger(ApprovalScoringService.name);

    // Configurable weights (can be moved to config service)
    private readonly signalWeights: ISignalWeights = {
        positive: 1.2, // Positive signals boost confidence
        negative: 0.8, // Negative signals reduce confidence
        unknown: 0.95, // Unknown slightly reduces confidence
    };

    /**
     * Calculate confidence score from signals
     * Formula: base + (positiveFactor) - (negativeFactor) + (historyFactor)
     *
     * DIP: Depends on signal interface, not implementation
     */
    calculateConfidence(
        signals: ApprovalSignalDto[],
        pastApprovalRate: number = 0.5,
    ): number {
        // Base confidence: 50%
        let confidence = 50;

        if (signals.length === 0) {
            // No signals = no information = neutral
            return confidence;
        }

        // Calculate weighted impact from signals
        const positive = signals
            .filter((s) => s.type === SignalType.POSITIVE)
            .reduce((sum, s) => sum + s.weight * this.signalWeights.positive, 0);

        const negative = signals
            .filter((s) => s.type === SignalType.NEGATIVE)
            .reduce((sum, s) => sum + s.weight * this.signalWeights.negative, 0);

        const unknown = signals
            .filter((s) => s.type === SignalType.UNKNOWN)
            .reduce((sum, s) => sum + s.weight * this.signalWeights.unknown, 0);

        // Normalize by signal count
        const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
        const avgWeight = totalWeight / signals.length;

        // Apply weighted adjustments
        confidence += (positive - negative) / signals.length;

        // Apply historical context (0-1 range)
        const historyBoost = (pastApprovalRate - 0.5) * 20; // Range: -10 to +10
        confidence += historyBoost;

        // Add uncertainty penalty based on unknown signals
        const unknownRatio = unknown / totalWeight;
        confidence *= 1 - unknownRatio * 0.15; // Unknown signals reduce confidence

        // Clamp to 0-100
        return Math.min(Math.max(Math.round(confidence), 0), 100);
    }

    /**
     * Determine recommendation action based on confidence & signals
     *
     * OCP: Can be extended with new action types without modifying core
     */
    determineAction(
        confidence: number,
        negativeSignalCount: number,
    ): RecommendationAction {
        // High confidence + no negatives = APPROVE
        if (confidence >= 85 && negativeSignalCount === 0) {
            return 'APPROVE';
        }

        // Very low confidence or critical negatives = REJECT
        if (confidence < 30 || negativeSignalCount >= 3) {
            return 'REJECT';
        }

        // Medium confidence with negatives = REVIEW (let human decide)
        if (confidence < 60 || negativeSignalCount > 0) {
            return 'REVIEW';
        }

        // High stakes decisions = ESCALATE to higher authority
        if (confidence >= 60 && confidence < 85) {
            return 'ESCALATE';
        }

        return 'REVIEW'; // Default: human review
    }

    /**
     * Determine batch group (ROUTINE vs STRATEGIC)
     * ROUTINE items can be batch-approved quickly
     * STRATEGIC items require individual review
     */
    determineBatchGroup(
        riskLevel: string,
        businessImpact: string,
        confidence: number,
    ): 'ROUTINE' | 'STRATEGIC' | 'MIXED' {
        const isHighRisk =
            riskLevel === 'HIGH' || riskLevel === 'CRITICAL';
        const isStrategic = businessImpact === 'SIGNIFICANT' || businessImpact === 'STRATEGIC';
        const isHighConfidence = confidence >= 80;

        if (isHighRisk || isStrategic) {
            return 'STRATEGIC';
        }

        if (isHighConfidence) {
            return 'ROUTINE';
        }

        return 'MIXED';
    }

    /**
     * Generate reasoning string for human readability
     *
     * SRP: Only generates text, doesn't calculate or fetch
     */
    generateReasoning(
        signals: ApprovalSignalDto[],
        pastApprovalRate: number,
    ): string {
        const positiveSummary = signals
            .filter((s) => s.type === SignalType.POSITIVE)
            .map((s) => s.description)
            .join(', ');

        const negativeSummary = signals
            .filter((s) => s.type === SignalType.NEGATIVE)
            .map((s) => s.description)
            .join(', ');

        let reasoning = '';

        if (positiveSummary) {
            reasoning += `Positive factors: ${positiveSummary}. `;
        }

        if (negativeSummary) {
            reasoning += `Areas of concern: ${negativeSummary}. `;
        }

        const rate = Math.round(pastApprovalRate * 100);
        reasoning += `Historical success rate: ${rate}%.`;

        return reasoning;
    }
}
