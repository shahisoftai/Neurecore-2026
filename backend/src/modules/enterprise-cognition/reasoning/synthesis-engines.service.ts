/**
 * Coordinator + Recommendation + Strategy + Evaluator (Phase 5).
 * Coordinator convenes specialists (reasoning only, no capability access).
 * Recommendation engine synthesizes structured, evidence-bearing recommendations
 * (never free text, never execution). Strategy evaluator + cognitive evaluator
 * produce findings/scores. All grounded; hallucination-guarded.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import type {
  CognitiveResult,
  CognitiveScore,
  Confidence,
  EnterpriseObjective,
  EnterpriseRecommendation,
  GoalDecomposition,
  IAgentCoordinator,
  ICognitiveEvaluator,
  IRecommendationEngine,
  IStrategyEvaluator,
  Priority,
  SpecialistAgent,
  SpecialistOpinion,
  StrategicFinding,
} from '../contracts/enterprise-cognition.interface';
import { ReasoningEngine } from './reasoning-engines.service';
import { evidenceFromContext, confidenceFromEvidence, guardReasoning } from './cognition-support';

@Injectable()
export class AgentCoordinator implements IAgentCoordinator {
  private readonly logger = new Logger(AgentCoordinator.name);
  constructor(private readonly reasoning: ReasoningEngine) {}

  async coordinate(params: {
    tenantId: string;
    objective: EnterpriseObjective;
    specialists: SpecialistAgent[];
    context: Record<string, unknown>;
  }): Promise<SpecialistOpinion[]> {
    // Each specialist reasons independently (bounded). No capability access.
    const opinions: SpecialistOpinion[] = [];
    for (const s of params.specialists) {
      const trace = await this.reasoning.reason(
        params.tenantId,
        `As a ${s.role} (${s.department}), what is your assessment and recommendation for: "${params.objective.statement}"? Focus on ${s.expertise.join(', ')}.`,
        params.context,
      );
      opinions.push({ role: s.role, department: s.department, opinion: trace.conclusion, reasoning: trace });
    }
    return opinions;
  }
}

@Injectable()
export class RecommendationEngine implements IRecommendationEngine {
  private readonly logger = new Logger(RecommendationEngine.name);
  constructor(private readonly ai: AiGatewayService) {}

  async recommend(params: {
    tenantId: string;
    objective: EnterpriseObjective;
    decomposition: GoalDecomposition;
    opinions: SpecialistOpinion[];
    context: Record<string, unknown>;
  }): Promise<EnterpriseRecommendation[]> {
    const evidence = evidenceFromContext(params.context);
    let raw: unknown[] = [];
    let content = '';
    try {
      const resp = await this.ai.invoke({
        tenantId: params.tenantId,
        capability: 'planning',
        systemPrompt:
          'Synthesize specialist opinions into STRUCTURED enterprise recommendations. Return ONLY JSON: ' +
          '{ "recommendations": [ { "title": string, "summary": string, "priority": "CRITICAL"|"HIGH"|"MEDIUM"|"LOW"|"INFORMATIONAL", "risks": string[], "alternatives": string[], "departments": string[], "recommendedAgentRole": string|null, "requiresApproval": boolean, "shouldBecomeWorkRun": boolean, "proposedWorkRequest": string|null } ] }. ' +
          'RECOMMEND only — never execute. Ground every recommendation in the opinions/context.',
        prompt:
          `Objective: ${params.objective.statement}\n` +
          `Goals: ${params.decomposition.goals.map((g) => g.title).join('; ')}\n` +
          `Specialist opinions:\n${params.opinions.map((o) => `- ${o.role}: ${o.opinion}`).join('\n').slice(0, 6000)}\n\n` +
          `Return AT MOST 3 concise recommendations. Keep each summary under 200 characters.`,
        sourceModule: 'enterprise-cognition.recommend',
        temperature: 0,
        maxTokens: 4000,
      });
      content = resp.content;
      const m = content.match(/\{[\s\S]*\}/);
      if (m) raw = (JSON.parse(m[0]).recommendations ?? []) as unknown[];
    } catch (e) {
      // Salvage complete recommendation objects from a truncated array.
      raw = this.salvageRecommendations(content);
      if (raw.length === 0) {
        this.logger.warn(`Recommendation LLM unavailable/unparseable: ${e instanceof Error ? e.message : e}`);
      }
    }

    const opinionConfidence = confidenceFromEvidence(evidence);
    return raw.slice(0, 10).map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const priority = (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'] as Priority[]).includes(o.priority as Priority)
        ? (o.priority as Priority) : 'MEDIUM';
      const shouldRun = o.shouldBecomeWorkRun === true;
      return {
        id: randomUUID(),
        tenantId: params.tenantId,
        title: typeof o.title === 'string' ? o.title : 'Recommendation',
        summary: typeof o.summary === 'string' ? o.summary : '',
        priority,
        confidence: opinionConfidence,
        evidence,
        reasoning: `Synthesized from ${params.opinions.length} specialist opinion(s) grounded in ${evidence.length} context source(s).`,
        assumptions: evidence.length === 0 ? ['limited grounded context'] : [],
        risks: Array.isArray(o.risks) ? (o.risks as unknown[]).filter((x) => typeof x === 'string') as string[] : [],
        alternatives: Array.isArray(o.alternatives) ? (o.alternatives as unknown[]).filter((x) => typeof x === 'string') as string[] : [],
        departments: Array.isArray(o.departments) ? (o.departments as unknown[]).filter((x) => typeof x === 'string') as string[] : params.objective.departments,
        recommendedAgentRole: typeof o.recommendedAgentRole === 'string' ? o.recommendedAgentRole : null,
        requiresApproval: o.requiresApproval === true,
        shouldBecomeWorkRun: shouldRun,
        proposedWorkRequest: shouldRun && typeof o.proposedWorkRequest === 'string' ? o.proposedWorkRequest : null,
      };
    });
  }

  /** Recover complete {...} recommendation objects from a truncated JSON array. */
  private salvageRecommendations(content: string): unknown[] {
    const out: unknown[] = [];
    if (!content) return out;
    // Find the recommendations array start, then scan balanced objects.
    const start = content.indexOf('[');
    if (start === -1) return out;
    let depth = 0;
    let objStart = -1;
    for (let i = start; i < content.length; i++) {
      const ch = content[i];
      if (ch === '{') {
        if (depth === 0) objStart = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && objStart !== -1) {
          try {
            out.push(JSON.parse(content.slice(objStart, i + 1)));
          } catch {
            /* skip malformed object */
          }
          objStart = -1;
        }
      }
    }
    return out;
  }
}

@Injectable()
export class StrategyEvaluator implements IStrategyEvaluator {
  constructor(private readonly reasoning: ReasoningEngine) {}

  async evaluate(tenantId: string, context: Record<string, unknown>): Promise<StrategicFinding[]> {
    // Detect risks/conflicts from grounded context only.
    const findings: StrategicFinding[] = [];
    const evidence = evidenceFromContext(context);
    const trace = await this.reasoning.reason(
      tenantId,
      'Identify strategic risks, priority conflicts, resource conflicts, or strategic drift from the current enterprise context. If none are evident from context, say so.',
      context,
    );
    findings.push({
      area: 'STRATEGIC_DRIFT',
      finding: trace.conclusion,
      priority: evidence.length === 0 ? 'INFORMATIONAL' : 'MEDIUM',
      reasoning: guardReasoning(trace).trace,
    });
    return findings;
  }
}

@Injectable()
export class CognitiveEvaluator implements ICognitiveEvaluator {
  score(result: Omit<CognitiveResult, 'score' | 'producedAt' | 'handedOffWorkRunIds'>): CognitiveScore {
    const issues: string[] = [];
    const allEvidence = [
      ...result.objective.reasoning.evidence,
      ...result.decomposition.reasoning.evidence,
      ...result.specialistOpinions.flatMap((o) => o.reasoning.evidence),
      ...result.recommendations.flatMap((r) => r.evidence),
    ];
    const grounded = allEvidence.filter((e) => e.source === 'CONTEXT_PLANE' || e.source === 'PLANNING_MEMORY' || e.source === 'RUNTIME_HISTORY').length;

    // Any recommendation with zero evidence → hallucination risk up.
    const ungroundedRecs = result.recommendations.filter((r) => r.evidence.length === 0);
    if (ungroundedRecs.length > 0) issues.push(`${ungroundedRecs.length} recommendation(s) lack grounded evidence`);

    const cov: Confidence = grounded === 0 ? 'VERY_LOW' : grounded <= 2 ? 'LOW' : grounded <= 4 ? 'MEDIUM' : grounded <= 6 ? 'HIGH' : 'VERY_HIGH';
    const hallucinationRisk: Confidence = ungroundedRecs.length === 0 && grounded > 0 ? 'VERY_LOW' : ungroundedRecs.length > 2 ? 'HIGH' : 'MEDIUM';

    return {
      reasoningQuality: cov,
      evidenceCoverage: cov,
      hallucinationRisk,
      consistency: result.recommendations.length > 0 ? 'MEDIUM' : 'LOW',
      issues,
    };
  }
}
