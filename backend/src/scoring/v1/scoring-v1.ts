/**
 * scoring-v1.ts — Phase 1 (Simulation-5).
 *
 * The authoritative scoring module for the simulation framework's
 * Organizational Intelligence section. This module is:
 *   - Deterministic: same persisted records → same scores
 *   - Pure: no I/O, no global state, no clock (the caller passes the clock)
 *   - Versioned: any change to scoring rules bumps scoringVersion
 *   - Honest: if there is not enough evidence for a category, the score is
 *     null. There are NO constant fallbacks. The previous attempt (the
 *     "dishonest" run) used Math.random() values; this module never does.
 *   - Sample-size aware: below a defined minimum, the score is reported as
 *     `insufficient_evidence: true` (per the user's safeguard #10).
 *
 * The Platform Health section is computed by a separate module because it
 * reads from the observability stack (Prometheus etc.) rather than from
 * the simulation's persisted records.
 */

export const SCORING_VERSION = 'v1';

export const WEIGHTS = {
  // Organizational Intelligence weights (sum to 1.0)
  decisionQuality: 0.18,
  evidenceQuality: 0.13,
  aiCollaboration: 0.13,
  adaptability: 0.13,
  longTermPlanning: 0.09,
  governance: 0.09,
  workflowExecution: 0.05,
  security: 0.05,
  performance: 0.03,
  costEfficiency: 0.02,
  predictionAccuracy: 0.10,
} as const;

// Minimum sample size for prediction-accuracy to be reported.
export const MIN_PREDICTION_SAMPLE_SIZE = 3;

export type Category = keyof typeof WEIGHTS;

export interface EvidenceRefs {
  entityType: string;
  entityId: string;
  version?: number;
  retrievedAt: string;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'CONTESTED';
}

export interface DecisionEvidence {
  decisionId: string;
  confidenceEstimate?: number;
  actualOutcomeConfidence?: number;  // 0-100, derived from persisted outcome
  evidenceRefs: EvidenceRefs[];
  debateParticipated: boolean;
  auditAddressed: boolean;
  approvalStatus: string;
  createdAt: string;
  finalizedAt?: string;
}

export interface RunningScoresInput {
  decisions: DecisionEvidence[];
  debateCount: number;
  decisionDebatedCount: number;
  cascadeTotal: number;
  cascadeDetectedEarly: number;
  learningUpdateCount: number;
  ethicsDecisionCount: number;
  approvalsRouted: number;
  tasksCreated: number;
  tasksCompleted: number;
  securityEventTotal: number;
  securityEventHandled: number;
  decisionsPerDay: number;
  decisionsMedianLatencyMs: number;
  budgetSpent: number;
  budgetTotal: number;
}

export interface CategoryScore {
  score: number | null;
  weight: number;
  evidence: Record<string, number | string | boolean>;
  insufficient_evidence?: boolean;
}

export interface OrganizationalIntelligenceScorecard {
  byCategory: Record<Category, CategoryScore>;
  overall: number;
  partialScore: boolean;          // true if some categories are null
  grade: string;
  verdict: string;
  scoringVersion: string;
  computedAt: string;
}

export function gradeOf(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D';
  return 'F';
}

export function verdictOf(score: number): string {
  if (score >= 90) return 'EXCEPTIONAL';
  if (score >= 80) return 'SUCCESS';
  if (score >= 70) return 'SATISFACTORY';
  if (score >= 60) return 'MARGINAL';
  if (score >= 50) return 'FAILED';
  return 'ABORTED';
}

/**
 * Compute Organizational Intelligence category scores from persisted evidence.
 * Every category returns either a numeric score in [0,100] or null (insufficient evidence).
 * The overall is the weighted average of non-null categories, renormalized.
 */
export function computeOrganizationalIntelligence(
  input: RunningScoresInput,
  computedAt: string,
): OrganizationalIntelligenceScorecard {
  const decisionCount = input.decisions.length;

  // --- decisionQuality: based on confidence estimate + debate + audit addressed ---
  const dqScores: number[] = [];
  const dqEvidence = { decisionsScored: 0, decisionsTotal: decisionCount, debatesParticipated: 0, auditsAddressed: 0 };
  for (const d of input.decisions) {
    if (d.confidenceEstimate === undefined) continue;
    let s = d.confidenceEstimate;
    if (d.debateParticipated) s = Math.min(100, s + 5);
    if (d.auditAddressed) s = Math.min(100, s + 3);
    if (d.approvalStatus === 'APPROVED') s = Math.min(100, s + 2);
    dqScores.push(s);
    dqEvidence.decisionsScored++;
    if (d.debateParticipated) dqEvidence.debatesParticipated++;
    if (d.auditAddressed) dqEvidence.auditsAddressed++;
  }
  const decisionQuality: CategoryScore = dqScores.length > 0
    ? { score: round(dqScores.reduce((a, b) => a + b, 0) / dqScores.length), weight: WEIGHTS.decisionQuality, evidence: dqEvidence }
    : { score: null, weight: WEIGHTS.decisionQuality, evidence: dqEvidence, insufficient_evidence: true };

  // --- evidenceQuality: based on VERIFIED evidence refs ---
  let verifiedRefs = 0;
  let totalRefs = 0;
  for (const d of input.decisions) {
    for (const ref of d.evidenceRefs) {
      totalRefs++;
      if (ref.verificationStatus === 'VERIFIED') verifiedRefs++;
    }
  }
  const evidenceQuality: CategoryScore = totalRefs > 0
    ? { score: round((verifiedRefs / totalRefs) * 100), weight: WEIGHTS.evidenceQuality, evidence: { verifiedEvidenceRefs: verifiedRefs, totalEvidenceRefs: totalRefs } }
    : { score: null, weight: WEIGHTS.evidenceQuality, evidence: { verifiedEvidenceRefs: 0, totalEvidenceRefs: 0 }, insufficient_evidence: true };

  // --- aiCollaboration: debate ratio ---
  const aiCollaboration: CategoryScore = input.decisionDebatedCount > 0
    ? { score: round((input.debateCount / input.decisionDebatedCount) * 100), weight: WEIGHTS.aiCollaboration, evidence: { debatesConcluded: input.debateCount, decisionsDebated: input.decisionDebatedCount } }
    : { score: null, weight: WEIGHTS.aiCollaboration, evidence: { debatesConcluded: 0, decisionsDebated: 0 }, insufficient_evidence: true };

  // --- adaptability: cascade detection ratio ---
  const adaptability: CategoryScore = input.cascadeTotal > 0
    ? { score: round((input.cascadeDetectedEarly / input.cascadeTotal) * 100), weight: WEIGHTS.adaptability, evidence: { cascadesDetected: input.cascadeDetectedEarly, cascadesTotal: input.cascadeTotal } }
    : { score: null, weight: WEIGHTS.adaptability, evidence: { cascadesDetected: 0, cascadesTotal: 0 }, insufficient_evidence: true };

  // --- longTermPlanning: learning updates per decision ---
  const longTermPlanning: CategoryScore = decisionCount > 0
    ? { score: clamp(round((input.learningUpdateCount / decisionCount) * 50 + 50), 0, 100), weight: WEIGHTS.longTermPlanning, evidence: { learningUpdates: input.learningUpdateCount, decisionsCount: decisionCount } }
    : { score: null, weight: WEIGHTS.longTermPlanning, evidence: { learningUpdates: 0, decisionsCount: 0 }, insufficient_evidence: true };

  // --- governance: ethics + approvals ---
  const governanceScore = (input.ethicsDecisionCount > 0 ? Math.min(input.ethicsDecisionCount * 15, 50) : 0) + (input.approvalsRouted > 0 ? Math.min(input.approvalsRouted * 5, 50) : 0);
  const governance: CategoryScore = (input.ethicsDecisionCount + input.approvalsRouted) > 0
    ? { score: clamp(governanceScore, 0, 100), weight: WEIGHTS.governance, evidence: { ethicsDecisionsLogged: input.ethicsDecisionCount, approvalsRouted: input.approvalsRouted } }
    : { score: null, weight: WEIGHTS.governance, evidence: { ethicsDecisionsLogged: 0, approvalsRouted: 0 }, insufficient_evidence: true };

  // --- workflowExecution: tasks completed / tasks created ---
  const workflowExecution: CategoryScore = input.tasksCreated > 0
    ? { score: round((input.tasksCompleted / input.tasksCreated) * 100), weight: WEIGHTS.workflowExecution, evidence: { tasksCompleted: input.tasksCompleted, tasksCreated: input.tasksCreated } }
    : { score: null, weight: WEIGHTS.workflowExecution, evidence: { tasksCompleted: 0, tasksCreated: 0 }, insufficient_evidence: true };

  // --- security: events handled / events total (no security events = N/A) ---
  const security: CategoryScore = input.securityEventTotal > 0
    ? { score: round((input.securityEventHandled / input.securityEventTotal) * 100), weight: WEIGHTS.security, evidence: { securityEventsHandled: input.securityEventHandled, securityEventsTotal: input.securityEventTotal } }
    : { score: null, weight: WEIGHTS.security, evidence: { securityEventsHandled: 0, securityEventsTotal: 0 }, insufficient_evidence: true };

  // --- performance: decisions per day + latency (if there are decisions) ---
  const performance: CategoryScore = decisionCount > 0
    ? {
        score: clamp(round(100 - input.decisionsMedianLatencyMs / 1000), 0, 100),
        weight: WEIGHTS.performance,
        evidence: { decisionsPerDay: input.decisionsPerDay, decisionsMedianLatencyMs: input.decisionsMedianLatencyMs },
      }
    : { score: null, weight: WEIGHTS.performance, evidence: { decisionsPerDay: 0, decisionsMedianLatencyMs: 0 }, insufficient_evidence: true };

  // --- costEfficiency: budget consumed vs budget total ---
  const costEfficiency: CategoryScore = input.budgetTotal > 0
    ? { score: clamp(round(100 - Math.abs(input.budgetSpent / input.budgetTotal - 1) * 100), 0, 100), weight: WEIGHTS.costEfficiency, evidence: { budgetSpent: input.budgetSpent, budgetTotal: input.budgetTotal } }
    : { score: null, weight: WEIGHTS.costEfficiency, evidence: { budgetSpent: 0, budgetTotal: 0 }, insufficient_evidence: true };

  // --- predictionAccuracy: requires MIN_PREDICTION_SAMPLE_SIZE realized outcomes ---
  const realized = input.decisions.filter(
    (d) => d.confidenceEstimate !== undefined && d.actualOutcomeConfidence !== undefined,
  );
  let predictionAccuracyScore: number | null = null;
  let meanCalibrationError = 0;
  if (realized.length >= MIN_PREDICTION_SAMPLE_SIZE) {
    let sumCal = 0;
    let sumAcc = 0;
    for (const d of realized) {
      const conf = d.confidenceEstimate!;
      const outcome = d.actualOutcomeConfidence!;
      const calError = Math.abs(conf - outcome) / 100;
      sumCal += calError;
      sumAcc += 1 - calError;
    }
    meanCalibrationError = sumCal / realized.length;
    predictionAccuracyScore = round((sumAcc / realized.length) * 100);
  }
  const predictionAccuracy: CategoryScore = realized.length >= MIN_PREDICTION_SAMPLE_SIZE
    ? {
        score: predictionAccuracyScore,
        weight: WEIGHTS.predictionAccuracy,
        evidence: {
          predictionsRealized: realized.length,
          predictionsTotal: input.decisions.length,
          meanCalibrationError: round(meanCalibrationError * 100) / 100,
        },
      }
    : {
        score: null,
        weight: WEIGHTS.predictionAccuracy,
        evidence: { predictionsRealized: realized.length, predictionsTotal: input.decisions.length, meanCalibrationError: 0 },
        insufficient_evidence: true,
      };

  const all = {
    decisionQuality,
    evidenceQuality,
    aiCollaboration,
    adaptability,
    longTermPlanning,
    governance,
    workflowExecution,
    security,
    performance,
    costEfficiency,
    predictionAccuracy,
  } as const;

  // Renormalize weights over the non-null categories
  const presentCats = (Object.values(all) as CategoryScore[]).filter((c) => c.score !== null);
  const totalWeight = presentCats.reduce((s, c) => s + c.weight, 0);
  let overall = 0;
  let partialScore = false;
  if (presentCats.length === 0) {
    overall = 0;
    partialScore = true;
  } else if (Math.abs(totalWeight - 1.0) < 0.0001) {
    overall = presentCats.reduce((s, c) => s + (c.score as number) * c.weight, 0);
  } else {
    overall = presentCats.reduce((s, c) => s + ((c.score as number) * c.weight) / totalWeight, 0);
    partialScore = true;
  }
  overall = round(overall);

  return {
    byCategory: all,
    overall,
    partialScore,
    grade: gradeOf(overall),
    verdict: verdictOf(overall),
    scoringVersion: SCORING_VERSION,
    computedAt,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round(n: number): number {
  return Math.round(n);
}