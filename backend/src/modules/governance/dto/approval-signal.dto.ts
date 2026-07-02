/**
 * ApprovalSignalDto
 *
 * SRP: Represents a single signal (evidence) for an AI recommendation
 * Examples: "Budget aligned", "Prior deal success", "Competitive risk"
 *
 * SOLID: Interface segregation - clients depend only on what they use
 */

export enum SignalType {
    POSITIVE = 'POSITIVE',
    NEGATIVE = 'NEGATIVE',
    UNKNOWN = 'UNKNOWN',
}

export interface IApprovalSignal {
    type: SignalType;
    description: string;
    weight: number; // 0-100, influence on confidence
}

export class ApprovalSignalDto implements IApprovalSignal {
    type!: SignalType;
    description!: string;
    weight!: number;

    constructor(data: IApprovalSignal) {
        this.type = data.type;
        this.description = data.description;
        this.weight = Math.min(Math.max(data.weight, 0), 100); // Clamp 0-100
    }

    isPositive(): boolean {
        return this.type === SignalType.POSITIVE;
    }

    isNegative(): boolean {
        return this.type === SignalType.NEGATIVE;
    }

    isUnknown(): boolean {
        return this.type === SignalType.UNKNOWN;
    }
}
