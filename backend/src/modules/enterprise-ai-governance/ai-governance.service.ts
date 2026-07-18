/**
 * Enterprise AI Governance — contracts + engines (Phase 13).
 * Trust evaluations, hallucination monitoring, bias detection, evidence
 * validation, explainability, policy management, model governance, human
 * review. All trust scores are CATEGORICAL (Excellent/Good/Fair/Poor/Critical)
 * — never percentages. No automatic policy rewriting or governance bypass.
 */
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { EVENT_TRANSPORT } from '../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../enterprise-events/contracts/enterprise-event-transport.interface';

export type TrustGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';

export interface TrustEvalView { id: string; sourceType: string; trustScore: TrustGrade; evidenceQuality: TrustGrade; reasoningQuality: TrustGrade; riskLevel: TrustGrade; policyCompliant: boolean; issues: string[]; createdAt: string }
export interface HallucinationFlagView { id: string; sourceType: string; claim: string; evidenceGap: string; severity: TrustGrade; recommendedAction: string | null }
export interface BiasFindingView { id: string; category: string; detail: string; severity: TrustGrade; recommendation: string | null }
export interface AIPolicyView { id: string; name: string; category: string; version: number; active: boolean }
export interface ModelView { id: string; modelName: string; provider: string; capabilities: string[]; status: string }
export interface ReviewView { id: string; sourceType: string; sourceId: string; decision: string; reason: string | null; reviewedAt: string | null }

export const AI_GOVERNANCE = Symbol('AI_GOVERNANCE');
export interface IAIGovernancePlatform {
  // Trust
  evaluate(sourceType: string, sourceId: string, tenantId: string, evidence: Record<string, unknown>, reasoning: string): Promise<TrustEvalView>;
  listTrustEvaluations(tenantId: string, sourceType?: string): Promise<TrustEvalView[]>;
  // Hallucination
  flagHallucination(tenantId: string, sourceType: string, sourceId: string, claim: string, evidenceGap: string, severity?: TrustGrade): Promise<HallucinationFlagView>;
  listHallucinations(tenantId: string): Promise<HallucinationFlagView[]>;
  // Bias
  recordBias(tenantId: string, category: string, detail: string, severity?: TrustGrade): Promise<BiasFindingView>;
  listBias(tenantId: string): Promise<BiasFindingView[]>;
  // Policies
  createPolicy(tenantId: string, name: string, category: string, rules?: Record<string,unknown>): Promise<AIPolicyView>;
  listPolicies(tenantId: string): Promise<AIPolicyView[]>;
  // Models
  registerModel(tenantId: string, modelName: string, provider: string, capabilities?: string[]): Promise<ModelView>;
  listModels(tenantId: string): Promise<ModelView[]>;
  // Human Review
  createReview(tenantId: string, sourceType: string, sourceId: string): Promise<ReviewView>;
  decideReview(tenantId: string, reviewId: string, decision: string, reviewerId: string, reason?: string): Promise<ReviewView>;
  listReviews(tenantId: string): Promise<ReviewView[]>;
  // Governance Dashboard
  dashboard(tenantId: string): Promise<{ trustEvals: number; hallucinations: number; biasFindings: number; policies: number; models: number; pendingReviews: number }>;
}

@Injectable()
export class AIGovernancePlatform implements IAIGovernancePlatform {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_TRANSPORT) private readonly events: IEnterpriseEventTransport,
  ) {}

  private async emit(tenantId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.events.publish({
        eventType,
        tenantId,
        actorType: 'SYSTEM',
        sourceModule: 'EnterpriseAIGovernance',
        idempotencyKey: `${eventType}.${tenantId}.${Date.now()}`,
        payload,
      });
    } catch { /* non-fatal */ }
  }

  async evaluate(sourceType: string, sourceId: string, tenantId: string, evidence: Record<string, unknown>, reasoning: string): Promise<TrustEvalView> {
    const issues: string[] = [];
    const evKeys = Object.keys(evidence);
    if (evKeys.length === 0) issues.push('no evidence provided');
    if (!reasoning || reasoning.trim().length < 10) issues.push('insufficient reasoning');
    const evidenceGrade: TrustGrade = evKeys.length === 0 ? 'POOR' : evKeys.length <= 2 ? 'FAIR' : evKeys.length <= 4 ? 'GOOD' : 'EXCELLENT';
    const reasoningGrade: TrustGrade = (!reasoning || reasoning.length < 20) ? 'POOR' : reasoning.length < 80 ? 'FAIR' : 'GOOD';
    const risk: TrustGrade = issues.length >= 3 ? 'CRITICAL' : issues.length >= 2 ? 'POOR' : issues.length >= 1 ? 'FAIR' : 'GOOD';
    const trust: TrustGrade = evidenceGrade === 'POOR' ? 'POOR' : evidenceGrade === 'FAIR' ? 'FAIR' : evidenceGrade === 'GOOD' && reasoningGrade !== 'POOR' ? 'GOOD' : 'FAIR';
    const row = await this.prisma.trustEvaluation.create({
      data: { tenantId, sourceType, sourceId, trustScore: trust, evidenceQuality: evidenceGrade, reasoningQuality: reasoningGrade, riskLevel: risk, policyCompliant: issues.length === 0, issues, evidenceJson: evidence as Prisma.InputJsonValue },
    });
    await this.emit(tenantId, 'ai.trust.evaluated', { sourceType, sourceId, trustScore: trust, riskLevel: risk });
    return { id: row.id, sourceType: row.sourceType, trustScore: row.trustScore as TrustGrade, evidenceQuality: row.evidenceQuality as TrustGrade, reasoningQuality: row.reasoningQuality as TrustGrade, riskLevel: row.riskLevel as TrustGrade, policyCompliant: row.policyCompliant, issues: row.issues, createdAt: row.createdAt.toISOString() };
  }
  async listTrustEvaluations(tenantId: string, sourceType?: string): Promise<TrustEvalView[]> {
    const rows = await this.prisma.trustEvaluation.findMany({ where: { tenantId, ...(sourceType ? { sourceType } : {}) }, orderBy: { createdAt: 'desc' }, take: 50 });
    return rows.map((r) => ({ id: r.id, sourceType: r.sourceType, trustScore: r.trustScore as TrustGrade, evidenceQuality: r.evidenceQuality as TrustGrade, reasoningQuality: r.reasoningQuality as TrustGrade, riskLevel: r.riskLevel as TrustGrade, policyCompliant: r.policyCompliant, issues: r.issues, createdAt: r.createdAt.toISOString() }));
  }
  async flagHallucination(tenantId: string, sourceType: string, sourceId: string, claim: string, evidenceGap: string, severity: TrustGrade = 'FAIR'): Promise<HallucinationFlagView> {
    const row = await this.prisma.aIHallucinationFlag.create({ data: { tenantId, sourceType, sourceId, claim, evidenceGap, severity } });
    await this.emit(tenantId, 'ai.hallucination.detected', { sourceType, sourceId, claim, severity });
    return { id: row.id, sourceType: row.sourceType, claim: row.claim, evidenceGap: row.evidenceGap, severity: row.severity as TrustGrade, recommendedAction: row.recommendedAction };
  }
  async listHallucinations(tenantId: string): Promise<HallucinationFlagView[]> {
    return (await this.prisma.aIHallucinationFlag.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 50 })).map((r) => ({ id: r.id, sourceType: r.sourceType, claim: r.claim, evidenceGap: r.evidenceGap, severity: r.severity as TrustGrade, recommendedAction: r.recommendedAction }));
  }
  async recordBias(tenantId: string, category: string, detail: string, severity: TrustGrade = 'FAIR'): Promise<BiasFindingView> {
    const row = await this.prisma.aIBiasFinding.create({ data: { tenantId, category, detail, severity } });
    await this.emit(tenantId, 'ai.bias.detected', { category, detail, severity });
    return { id: row.id, category: row.category, detail: row.detail, severity: row.severity as TrustGrade, recommendation: row.recommendation };
  }
  async listBias(tenantId: string): Promise<BiasFindingView[]> {
    return (await this.prisma.aIBiasFinding.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 50 })).map((r) => ({ id: r.id, category: r.category, detail: r.detail, severity: r.severity as TrustGrade, recommendation: r.recommendation }));
  }
  async createPolicy(tenantId: string, name: string, category: string, rules: Record<string, unknown> = {}): Promise<AIPolicyView> {
    const row = await this.prisma.aIPolicy.create({ data: { tenantId, name, category: category as any, rulesJson: rules as Prisma.InputJsonValue } });
    await this.emit(tenantId, 'ai.policy.updated', { policyId: row.id, name: row.name });
    return { id: row.id, name: row.name, category: row.category, version: row.version, active: row.active };
  }
  async listPolicies(tenantId: string): Promise<AIPolicyView[]> {
    return (await this.prisma.aIPolicy.findMany({ where: { tenantId, active: true } })).map((r) => ({ id: r.id, name: r.name, category: r.category, version: r.version, active: r.active }));
  }
  async registerModel(tenantId: string, modelName: string, provider: string, capabilities: string[] = []): Promise<ModelView> {
    const row = await this.prisma.modelRegistration.upsert({ where: { tenantId_modelName: { tenantId, modelName } }, create: { tenantId, modelName, provider, capabilities }, update: { provider, capabilities } });
    return { id: row.id, modelName: row.modelName, provider: row.provider, capabilities: row.capabilities, status: row.status };
  }
  async listModels(tenantId: string): Promise<ModelView[]> {
    return (await this.prisma.modelRegistration.findMany({ where: { tenantId } })).map((r) => ({ id: r.id, modelName: r.modelName, provider: r.provider, capabilities: r.capabilities, status: r.status }));
  }
  async createReview(tenantId: string, sourceType: string, sourceId: string): Promise<ReviewView> {
    const row = await this.prisma.humanReviewRecord.create({ data: { tenantId, sourceType, sourceId } });
    await this.emit(tenantId, 'ai.review.requested', { reviewId: row.id, sourceType, sourceId });
    return { id: row.id, sourceType: row.sourceType, sourceId: row.sourceId, decision: row.decision, reason: row.reason, reviewedAt: row.reviewedAt?.toISOString?.() ?? null };
  }
  async decideReview(tenantId: string, reviewId: string, decision: string, reviewerId: string, reason?: string): Promise<ReviewView> {
    const owned = await this.prisma.humanReviewRecord.findFirst({ where: { id: reviewId, tenantId } });
    if (!owned) throw new Error('review not found for tenant');
    const u = await this.prisma.humanReviewRecord.updateMany({
      where: { id: reviewId, tenantId },
      data: { decision: decision as any, reviewerId, reason: reason ?? null, reviewedAt: new Date() },
    });
    if (u.count === 0) throw new Error('review not found for tenant');
    const after = await this.prisma.humanReviewRecord.findFirst({ where: { id: reviewId, tenantId } });
    await this.emit(tenantId, 'ai.review.completed', { reviewId, decision, reviewerId });
    return { id: after!.id, sourceType: after!.sourceType, sourceId: after!.sourceId, decision: after!.decision, reason: after!.reason, reviewedAt: after!.reviewedAt?.toISOString?.() ?? null };
  }
  async listReviews(tenantId: string): Promise<ReviewView[]> {
    return (await this.prisma.humanReviewRecord.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 50 })).map((r) => ({ id: r.id, sourceType: r.sourceType, sourceId: r.sourceId, decision: r.decision, reason: r.reason, reviewedAt: r.reviewedAt?.toISOString?.() ?? null }));
  }
  async dashboard(tenantId: string) {
    const [trustEvals, hallucinations, biasFindings, policies, models, reviews] = await Promise.all([
      this.prisma.trustEvaluation.count({ where: { tenantId } }),
      this.prisma.aIHallucinationFlag.count({ where: { tenantId } }),
      this.prisma.aIBiasFinding.count({ where: { tenantId } }),
      this.prisma.aIPolicy.count({ where: { tenantId, active: true } }),
      this.prisma.modelRegistration.count({ where: { tenantId } }),
      this.prisma.humanReviewRecord.count({ where: { tenantId, decision: 'NEEDS_REVISION' } }),
    ]);
    return { trustEvals, hallucinations, biasFindings, policies, models, pendingReviews: reviews };
  }
}
