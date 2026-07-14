/**
 * Cognition support — evidence extraction + hallucination guard (Phase 5).
 *
 * Extracts Evidence strictly from the assembled Context Plane / planning memory
 * / runtime sources. The hallucination guard verifies that a reasoning trace's
 * evidence references only appear in the allowed source set — any claim without
 * a grounded source is flagged and its confidence capped.
 */

import type {
  Confidence,
  Evidence,
  ReasoningTrace,
} from '../contracts/enterprise-cognition.interface';

/** Build grounded Evidence from an assembled context summary (Context Plane). */
export function evidenceFromContext(
  context: Record<string, unknown>,
): Evidence[] {
  const out: Evidence[] = [];
  const caps = (context.capabilities ?? context) as Record<string, unknown>;
  if (caps && typeof caps === 'object') {
    for (const [cap, val] of Object.entries(caps)) {
      const v = val as { access?: string; unavailable?: boolean; data?: unknown };
      if (!v || typeof v !== 'object') continue;
      if (v.unavailable) continue;
      if (v.access === 'DENIED') continue; // denied ≠ zero; simply no evidence
      out.push({
        source: 'CONTEXT_PLANE',
        capability: cap,
        reference: cap,
        detail: `access=${v.access ?? 'FULL'}`,
      });
    }
  }
  return out;
}

const CONFIDENCE_ORDER: Confidence[] = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];

export function capConfidence(c: Confidence, cap: Confidence): Confidence {
  return CONFIDENCE_ORDER.indexOf(c) <= CONFIDENCE_ORDER.indexOf(cap) ? c : cap;
}

/** Confidence derived from grounded-evidence coverage. */
export function confidenceFromEvidence(evidence: Evidence[]): Confidence {
  const grounded = evidence.filter((e) => e.source !== undefined).length;
  if (grounded === 0) return 'VERY_LOW';
  if (grounded === 1) return 'LOW';
  if (grounded <= 3) return 'MEDIUM';
  if (grounded <= 5) return 'HIGH';
  return 'VERY_HIGH';
}

/**
 * Hallucination guard: ensure every piece of evidence in a trace comes from an
 * allowed source. Returns the (possibly confidence-capped) trace + issues.
 */
export function guardReasoning(trace: ReasoningTrace): { trace: ReasoningTrace; issues: string[] } {
  const allowed = new Set([
    'CONTEXT_PLANE',
    'PLANNING_MEMORY',
    'ORGANIZATIONAL_MEMORY',
    'RUNTIME_HISTORY',
    'GOVERNANCE',
    'CAPABILITY_SUMMARY',
  ]);
  const issues: string[] = [];
  const ungrounded = trace.evidence.filter((e) => !allowed.has(e.source));
  if (ungrounded.length > 0) {
    issues.push(`${ungrounded.length} evidence item(s) from disallowed sources`);
  }
  if (trace.evidence.length === 0) {
    issues.push('conclusion has no grounded evidence');
  }
  // Cap confidence when evidence is thin or ungrounded.
  let confidence = trace.confidence;
  if (issues.length > 0) confidence = capConfidence(confidence, 'LOW');
  return { trace: { ...trace, confidence }, issues };
}
