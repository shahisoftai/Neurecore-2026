import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { MiniMaxClient } from '../models/services/minimax-client.service';
import { FeatureFlagService } from '../../common/feature-flag/feature-flag.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { ProjectHealthService } from './project-health.service';
import type { ProjectHealth, HealthSignalName } from './interfaces/project-health.interface';

export interface AIHealthResult {
  overallScore: number;
  atRiskReasons: string[];
  recommendedActions: string[];
  confidence: number;
  reasoning: string;
}

const aiHealthSchema = z.object({
  adjustedScore: z.number().min(0).max(100),
  atRiskReasons: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

@Injectable()
export class ProjectHealthAIService {
  private readonly logger = new Logger(ProjectHealthAIService.name);

  constructor(
    private readonly minimax: MiniMaxClient,
    private readonly projectHealthService: ProjectHealthService,
    private readonly featureFlags: FeatureFlagService,
    private readonly aiGateway: AiGatewayService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async calculateWithAI(projectId: string, tenantId: string): Promise<AIHealthResult> {
    const health = await this.projectHealthService.computeHealth({ projectId, tenantId });

    if (await this.featureFlags.isEnabled('AI_GATEWAY_V2')) {
      return this.analyzeWithGateway(health, projectId, tenantId);
    }

    if (!this.minimax.isConfigured()) {
      return this.fallbackResult(health);
    }

    try {
      const signalSummary = health.signals
        .map((s) => `${s.name}: ${s.value}/100 (weight: ${s.weight})`)
        .join('\n');

      const prompt = `You are an elite project health analyst. Analyze the health signals for a project and provide recommendations.

PROJECT HEALTH SIGNALS:
${signalSummary}

OVERALL SCORE: ${health.overallScore}/100
SEVERITY: ${health.severity}
TREND: ${health.trend}

Your task:
1. Evaluate which signals are most critical for THIS specific project
2. Provide an adjusted overall score (0-100) based on your analysis
3. List at-risk reasons (what is actually dangerous right now)
4. List recommended actions (specific, actionable next steps)
5. Rate your confidence in this analysis (0-1)

Respond ONLY in this JSON format (no markdown, no explanation):
{
  "adjustedScore": number,
  "atRiskReasons": ["reason1", "reason2"],
  "recommendedActions": ["action1", "action2"],
  "confidence": number,
  "reasoning": "brief explanation of your analysis"
}`;

      const response = await this.minimax.invoke(prompt, 0.2, 512);

      return this.parseAIResponse(response.content ?? '', health);
    } catch (err) {
      this.logger.warn(`AI health analysis failed for project ${projectId}: ${err instanceof Error ? err.message : String(err)}`);
      return this.fallbackResult(health);
    }
  }

  private async analyzeWithGateway(
    health: ProjectHealth,
    _projectId: string,
    tenantId: string,
  ): Promise<AIHealthResult> {
    try {
      const signalSummary = health.signals
        .map((s) => `${s.name}: ${s.value}/100 (weight: ${s.weight})`)
        .join('\n');

      const prompt = `Analyze the health signals for a project and provide recommendations.

PROJECT HEALTH SIGNALS:
${signalSummary}

OVERALL SCORE: ${health.overallScore}/100
SEVERITY: ${health.severity}
TREND: ${health.trend}

Your task:
1. Evaluate which signals are most critical for THIS specific project
2. Provide an adjusted overall score (0-100) based on your analysis
3. List at-risk reasons (what is actually dangerous right now)
4. List recommended actions (specific, actionable next steps)
5. Rate your confidence in this analysis (0-1)`;

      const { data } = await this.aiGateway.invokeStructured({
        tenantId,
        capability: 'reasoning',
        prompt,
        temperature: 0.2,
        maxTokens: 512,
        sourceModule: 'project-health',
        schema: aiHealthSchema,
      });

      return {
        overallScore: Math.max(0, Math.min(100, data.adjustedScore)),
        atRiskReasons: data.atRiskReasons.slice(0, 5),
        recommendedActions: data.recommendedActions.slice(0, 5),
        confidence: Math.max(0, Math.min(1, data.confidence)),
        reasoning: data.reasoning.slice(0, 500),
      };
    } catch (err) {
      this.logger.warn(
        `Gateway health analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.fallbackResult(health);
    }
  }

  private fallbackResult(health: ProjectHealth): AIHealthResult {
    return {
      overallScore: health.overallScore,
      atRiskReasons: health.atRiskReasons,
      recommendedActions: this.defaultRecommendations(health),
      confidence: 0.3,
      reasoning: 'AI analysis unavailable — using rule-based defaults. Enable AI_GATEWAY_V2 or configure MINIMAX_API_KEY for AI-powered health analysis.',
    };
  }

  private parseAIResponse(content: string, health: ProjectHealth): AIHealthResult {
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        overallScore: typeof parsed.adjustedScore === 'number'
          ? Math.max(0, Math.min(100, parsed.adjustedScore))
          : health.overallScore,
        atRiskReasons: Array.isArray(parsed.atRiskReasons)
          ? parsed.atRiskReasons.slice(0, 5)
          : health.atRiskReasons,
        recommendedActions: Array.isArray(parsed.recommendedActions)
          ? parsed.recommendedActions.slice(0, 5)
          : this.defaultRecommendations(health),
        confidence: typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.7,
        reasoning: typeof parsed.reasoning === 'string'
          ? parsed.reasoning.slice(0, 500)
          : 'AI analysis complete.',
      };
    } catch {
      return {
        overallScore: health.overallScore,
        atRiskReasons: health.atRiskReasons,
        recommendedActions: this.defaultRecommendations(health),
        confidence: 0.1,
        reasoning: 'Failed to parse AI response — using rule-based defaults.',
      };
    }
  }

  private defaultRecommendations(health: ProjectHealth): string[] {
    const recs: string[] = [];

    if (health.overallScore < 70) {
      recs.push('Review project health signals below 70 and create action plans');
    }

    const lowSignals = health.signals.filter((s) => s.value < 50);
    for (const signal of lowSignals) {
      switch (signal.name) {
        case 'budgetBurn':
          recs.push('Review budget consumption — consider re-forecasting or cost controls');
          break;
        case 'timeline':
          recs.push('Assess timeline delays — identify critical path tasks and expedite');
          break;
        case 'activityRate':
          recs.push('Increase team activity — schedule standups, assign clear next steps');
          break;
        case 'approvalDelay':
          recs.push('Escalate pending approvals — contact approvers directly');
          break;
        case 'reworkRate':
          recs.push('Quality issue detected — review recent deliverables for defects');
          break;
      }
    }

    return recs.length > 0 ? recs : ['Project health is acceptable — continue monitoring'];
  }
}
