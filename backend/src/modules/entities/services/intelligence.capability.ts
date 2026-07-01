/**
 * IntelligenceCapability — Phase 3 capability surface for the Intelligence panel.
 *
 * Returns: AI-generated summary, predictions, risks, recommendations,
 * confidence. In Phase 3 this is a structured placeholder (no LLM call);
 * Phase 5 will wire it to real AI Actions. Per EAOS-implementation-plan.md
 * §1.5 Intelligence + §4.2 AI Actions.
 */

import { Injectable } from '@nestjs/common';
import { EntityResolverService } from './entity-resolver.service';
import type { EaosEntityType } from '../dto/entity.dto';

export interface IntelligencePanel {
  id: string;
  type: string;
  summary: string;
  predictions: Array<{
    metric: string;
    forecast: number | string;
    confidence: number;
    model: string;
  }>;
  risks: Array<{
    title: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    probability: number;
    mitigation: string | null;
  }>;
  recommendations: Array<{
    action: string;
    rationale: string;
    impact: number;
    effort: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  confidence: number;
  generatedAt: string;
  modelVersion: string;
  contextUsed: string[];
}

@Injectable()
export class IntelligenceCapability {
  constructor(private readonly resolver: EntityResolverService) {}

  async get(
    type: EaosEntityType,
    id: string,
    tenantId: string,
  ): Promise<IntelligencePanel> {
    const entity = await this.resolver.resolve(type, id, tenantId);
    const now = new Date().toISOString();
    return {
      id: entity.id,
      type: entity.type,
      summary: `${entity.name} is in good standing. No anomalies detected.`,
      predictions: [],
      risks: [],
      recommendations: [],
      confidence: 0.0,
      generatedAt: now,
      modelVersion: 'phase3-placeholder',
      contextUsed: [],
    };
  }
}
