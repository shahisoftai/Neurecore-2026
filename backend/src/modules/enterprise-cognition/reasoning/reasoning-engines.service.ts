/**
 * Reasoning + Objective + Decomposition engines (Phase 5).
 * Use the AI Gateway ('reasoning'/'planning') grounded on assembled context.
 * NEVER execute anything. Every output carries a grounded reasoning trace.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import type {
  DecomposedGoal,
  EnterpriseObjective,
  GoalDecomposition,
  IGoalDecomposer,
  IObjectiveAnalyzer,
  IReasoningEngine,
  ReasoningTrace,
} from '../contracts/enterprise-cognition.interface';
import {
  evidenceFromContext,
  confidenceFromEvidence,
  guardReasoning,
} from './cognition-support';

@Injectable()
export class ReasoningEngine implements IReasoningEngine {
  private readonly logger = new Logger(ReasoningEngine.name);
  constructor(private readonly ai: AiGatewayService) {}

  async reason(tenantId: string, question: string, context: Record<string, unknown>): Promise<ReasoningTrace> {
    const evidence = evidenceFromContext(context);
    let conclusion = '';
    try {
      const resp = await this.ai.invoke({
        tenantId,
        capability: 'planning',
        systemPrompt:
          'You are an enterprise reasoning engine. Reason ONLY from the provided context. ' +
          'If context is missing, say so — never invent enterprise facts. Return a concise conclusion.',
        prompt: `Question: ${question}\n\nContext (authorized; DENIED/UNAVAILABLE are not zero):\n${JSON.stringify(context).slice(0, 8000)}`,
        sourceModule: 'enterprise-cognition.reasoning',
        temperature: 0,
      });
      conclusion = resp.content.trim();
    } catch (e) {
      conclusion = `Unable to reason (LLM unavailable): ${e instanceof Error ? e.message : e}`;
    }
    const trace: ReasoningTrace = {
      conclusion,
      evidence,
      assumptions: [],
      knownUnknowns: evidence.length === 0 ? ['no grounded context available'] : [],
      alternativesConsidered: [],
      rejectedAlternatives: [],
      policiesConsidered: [],
      confidence: confidenceFromEvidence(evidence),
    };
    return guardReasoning(trace).trace;
  }
}

@Injectable()
export class ObjectiveAnalyzer implements IObjectiveAnalyzer {
  private readonly logger = new Logger(ObjectiveAnalyzer.name);
  constructor(private readonly ai: AiGatewayService) {}

  async analyze(tenantId: string, _actorId: string, request: string, context: Record<string, unknown>): Promise<EnterpriseObjective> {
    const evidence = evidenceFromContext(context);
    let parsed: Record<string, unknown> = {};
    try {
      const resp = await this.ai.invoke({
        tenantId,
        capability: 'planning',
        systemPrompt:
          'Transform a user request into an ENTERPRISE OBJECTIVE. Return ONLY JSON: ' +
          '{ "statement": string, "departments": string[], "requiredContextCapabilities": string[], "constraints": string[], "expectedDeliverables": string[], "successCriteria": string[] }. ' +
          'Do NOT plan or execute. Ground departments/capabilities in the provided context where possible.',
        prompt: `Request: ${request}\n\nContext:\n${JSON.stringify(context).slice(0, 6000)}`,
        sourceModule: 'enterprise-cognition.objective',
        temperature: 0,
      });
      const m = resp.content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch (e) {
      this.logger.warn(`Objective analysis LLM unavailable: ${e instanceof Error ? e.message : e}`);
    }
    const strArr = (k: string): string[] => (Array.isArray(parsed[k]) ? (parsed[k] as unknown[]).filter((x) => typeof x === 'string') as string[] : []);
    const reasoning = guardReasoning({
      conclusion: `Objective derived from request: "${request}"`,
      evidence,
      assumptions: parsed.statement ? [] : ['LLM objective analysis unavailable; used request verbatim'],
      knownUnknowns: [],
      alternativesConsidered: [],
      rejectedAlternatives: [],
      policiesConsidered: [],
      confidence: confidenceFromEvidence(evidence),
    }).trace;
    return {
      id: randomUUID(),
      tenantId,
      statement: typeof parsed.statement === 'string' && parsed.statement ? parsed.statement : request,
      departments: strArr('departments'),
      requiredContextCapabilities: strArr('requiredContextCapabilities'),
      constraints: strArr('constraints'),
      expectedDeliverables: strArr('expectedDeliverables'),
      successCriteria: strArr('successCriteria'),
      reasoning,
    };
  }
}

@Injectable()
export class GoalDecomposer implements IGoalDecomposer {
  private readonly logger = new Logger(GoalDecomposer.name);
  constructor(private readonly ai: AiGatewayService) {}

  async decompose(objective: EnterpriseObjective, context: Record<string, unknown>): Promise<GoalDecomposition> {
    let rawGoals: unknown[] = [];
    try {
      const resp = await this.ai.invoke({
        tenantId: objective.tenantId,
        capability: 'planning',
        systemPrompt:
          'Decompose an enterprise objective into ordered goals. Return ONLY JSON: ' +
          '{ "goals": [ { "title": string, "description": string, "dependsOn": string[], "suggestedDepartment": string|null, "executable": boolean } ] }. ' +
          'Do NOT execute. Mark a goal executable=true only if it is a concrete unit of work.',
        prompt: `Objective: ${objective.statement}\nDepartments: ${objective.departments.join(', ')}\nDeliverables: ${objective.expectedDeliverables.join(', ')}`,
        sourceModule: 'enterprise-cognition.decompose',
        temperature: 0,
      });
      const m = resp.content.match(/\{[\s\S]*\}/);
      if (m) rawGoals = (JSON.parse(m[0]).goals ?? []) as unknown[];
    } catch (e) {
      this.logger.warn(`Decomposition LLM unavailable: ${e instanceof Error ? e.message : e}`);
    }
    const goals: DecomposedGoal[] = rawGoals.slice(0, 15).map((g, i) => {
      const o = (g ?? {}) as Record<string, unknown>;
      return {
        id: `goal-${i + 1}`,
        sequence: i + 1,
        title: typeof o.title === 'string' ? o.title : `Goal ${i + 1}`,
        description: typeof o.description === 'string' ? o.description : '',
        dependsOn: Array.isArray(o.dependsOn) ? (o.dependsOn as unknown[]).filter((x) => typeof x === 'string') as string[] : [],
        suggestedDepartment: typeof o.suggestedDepartment === 'string' ? o.suggestedDepartment : null,
        executable: o.executable === true,
      };
    });
    const evidence = evidenceFromContext(context);
    const reasoning = guardReasoning({
      conclusion: `Decomposed objective into ${goals.length} goal(s)`,
      evidence,
      assumptions: goals.length === 0 ? ['decomposition unavailable'] : [],
      knownUnknowns: [], alternativesConsidered: [], rejectedAlternatives: [], policiesConsidered: [],
      confidence: confidenceFromEvidence(evidence),
    }).trace;
    return { objectiveId: objective.id, goals, reasoning };
  }
}
