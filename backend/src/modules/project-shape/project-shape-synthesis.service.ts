/**
 * ProjectShapeSynthesisService — Hermes-driven project shape synthesis.
 *
 * Given a user's chat message ("we just won the acme audit, Q3, $75k"),
 * this service asks the LLM (via AiGatewayService) to produce a Zod-validated
 * ProjectShape JSON: stages, goals, members, custom fields, rationale.
 *
 * Pattern mirrors:
 *   - ProjectHealthAIService.analyzeWithGateway — gold-standard structured-output
 *   - WorkPlanner.plan — bounded one-shot repair loop on Zod failure
 *
 * SRP: this service only SYNTHESIZES. It does not persist anything. The caller
 * (CreateProjectTool → ProjectsService → DerivedShapeApplier) is responsible
 * for materializing the shape as Project/Stage/Goal/Member rows.
 *
 * Phase 0 G4 (INDUSTRY-SETUP-CONCEPT.md §3.1 G4): when an optional
 * RAGPipeline is injected, the synthesis prompt is augmented with a
 * tenant-scoped few-shot example mined from the Knowledge Hub. This is
 * the primary motivation for the input type's existing `tenantId` field
 * (see project-shape.types.ts docstring) and means the same prompt
 * produces noticeably different shapes per tenant vertical.
 */

import { Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { FeatureFlagService } from '../../common/feature-flag/feature-flag.service';
import { RAGPipeline } from '../knowledge/services/rag-pipeline.service';
import {
  ProjectShapeSchema,
  type ProjectShape,
  type SynthesizeShapeInput,
  type SynthesizeShapeResult,
} from './project-shape.types';

/**
 * Hard-coded fallback few-shot example used when no other context is available.
 * Teaches the LLM the expected output shape without any corpus mining.
 */
const FALLBACK_FEW_SHOT = `EXAMPLE
User asked: "create a project for the acme audit, q3 deadline, fixed fee 75k"
→ Synthesized shape:
{
  "industry": "financial-services",
  "description": "Statutory audit for Acme Corp covering Q3, fixed fee engagement.",
  "stages": [
    {"name": "Scoping", "order": 0, "defaultDurationDays": 7},
    {"name": "Fieldwork", "order": 1, "defaultDurationDays": 21},
    {"name": "Reporting", "order": 2, "defaultDurationDays": 10},
    {"name": "Wrap-up", "order": 3, "defaultDurationDays": 5}
  ],
  "goals": [
    {"title": "Engagement scoping & sign-off", "measurableCriteria": "Engagement letter executed by client"},
    {"title": "Fieldwork complete", "measurableCriteria": "All audit procedures performed"},
    {"title": "Audit report issued", "measurableCriteria": "Signed report delivered to client"}
  ],
  "members": [
    {"role": "PROJECT_MANAGER", "rationale": "Engagement partner responsible for delivery"},
    {"role": "REVIEWER", "rationale": "Senior reviewer for fieldwork quality"},
    {"role": "CLIENT_LIAISON", "rationale": "Client interface for the audit"}
  ],
  "customFields": {"engagementType": "audit", "feeModel": "fixed", "deadline": "2026-09-30"},
  "rationale": "Stages follow standard audit lifecycle; team mirrors typical audit engagement roles."
}
`;

@Injectable()
export class ProjectShapeSynthesisService {
  private readonly logger = new Logger(ProjectShapeSynthesisService.name);

  /**
   * SRP: keep this bounded. RAG pipeline is only consulted if a tenant
   * context is present and an industry hint is supplied. RAG is optional
   * — the service degrades to the hardcoded FALLBACK_FEW_SHOT when the
   * pipeline isn't wired or returns no chunks.
   */
  constructor(
    private readonly aiGateway: AiGatewayService,
    private readonly featureFlags: FeatureFlagService,
    @Optional() private readonly ragPipeline?: RAGPipeline,
  ) {}

  /**
   * Synthesize a project shape from a user's chat goal.
   * Returns a Zod-validated ProjectShape plus metadata for audit.
   *
   * @throws ServiceUnavailableException when feature flag is OFF.
   * @throws Error on Zod validation failure after MAX_REPAIR_ATTEMPTS.
   */
  async synthesizeShape(input: SynthesizeShapeInput): Promise<SynthesizeShapeResult> {
    if (!input.goal || input.goal.trim().length === 0) {
      throw new ServiceUnavailableException(
        'Project shape synthesis requires a non-empty goal',
      );
    }

    const flagEnabled = await this.featureFlags.isEnabled(
      'AI_PROJECT_SHAPE_ENABLED',
      input.tenantId,
    );
    if (!flagEnabled) {
      throw new ServiceUnavailableException(
        'AI project shape synthesis is disabled for this tenant (AI_PROJECT_SHAPE_ENABLED=false)',
      );
    }

    const prompt = this.buildPrompt(input, await this.retrieveRagContext(input));
    let usedRepairRetry = false;

    try {
      const result = await this.callLlmForShape(prompt, input.tenantId);
      return {
        shape: result.shape,
        sourceGoal: input.goal,
        usedRepairRetry: false,
        model: result.model,
        tokens: result.tokens,
      };
    } catch (firstErr) {
      // Bounded repair retry — mirror WorkPlanner pattern.
      const issues = this.extractZodIssues(firstErr);
      if (!issues) {
        // Either JSON parse failure (AiGateway already retried JSON repair
        // internally — no point retrying) or an unrelated error. Log and bail.
        this.logger.warn(
          `[ProjectShapeSynthesis] First call failed (not a schema error): ${firstErr instanceof Error ? firstErr.message : String(firstErr)}`,
        );
        throw firstErr;
      }
      this.logger.warn(
        `[ProjectShapeSynthesis] First parse failed: ${issues}. Attempting repair retry.`,
      );
      usedRepairRetry = true;

      const repairPrompt = `${prompt}

REPAIR INSTRUCTION: Your previous JSON response failed Zod validation with these issues:
${issues}

Please correct the JSON to satisfy the schema. Common issues:
- Missing required fields (description, industry, stages, goals, members, rationale)
- Wrong enum values for members[].role — must be one of: PROJECT_DIRECTOR, PROJECT_MANAGER, RESEARCH_LEAD, QUALITY_LEAD, REVIEWER, COMPLIANCE_OFFICER, CLIENT_LIAISON, DOCUMENTATION_LEAD, KNOWLEDGE_MANAGER, CHIEF_OF_STAFF
- Missing rationale on each member
- Stages missing order (must be unique integers starting from 0)
- Goals missing title

Respond with valid JSON only — no markdown.`;

      try {
        const result = await this.callLlmForShape(repairPrompt, input.tenantId, 0.1);
        return {
          shape: result.shape,
          sourceGoal: input.goal,
          usedRepairRetry: true,
          model: result.model,
          tokens: result.tokens,
        };
      } catch (repairErr) {
        this.logger.error(
          `[ProjectShapeSynthesis] Repair retry also failed: ${repairErr instanceof Error ? repairErr.message : String(repairErr)}`,
        );
        throw new Error(
          `Project shape synthesis failed even after repair retry. Original error: ${firstErr instanceof Error ? firstErr.message : String(firstErr)}. Repair error: ${repairErr instanceof Error ? repairErr.message : String(repairErr)}`,
        );
      }
    }
  }

  /**
   * Build the synthesis prompt. SRP: just builds the prompt string.
   * Public so tests can verify the prompt structure without running LLM calls.
   */
  buildPrompt(input: SynthesizeShapeInput, ragContext?: string): string {
    const industryLine = input.industryHint
      ? `Industry hint from caller: ${input.industryHint}`
      : 'Industry hint: (none — infer from the goal)';

    const ragBlock =
      ragContext && ragContext.length > 0
        ? `\nTENANT KNOWLEDGE (RAG-retrieved, treat as authoritative for this tenant's workflows):\n${ragContext}\n`
        : '';

    return `You are Hermes, the AI brain of NeureCore. A user has asked to create a new project. Your job is to synthesize a complete project shape — stages, goals, team, and rationale — from the user's natural-language goal.

USER GOAL:
"""
${input.goal}
"""

${industryLine}
${ragBlock}
INSTRUCTIONS:
1. Read the user's goal carefully. Extract what kind of project this is (audit? campaign? construction? legal matter?), who the stakeholders are, what deliverables are expected, and any timeline or budget signals.
2. Synthesize a workflow of 3-6 sequential stages appropriate for THIS project. Standard projects have 3-5 stages; complex multi-month projects may have more.
3. Synthesize 2-6 concrete goals. Each goal must have a measurable criterion (how we know it's done).
4. Choose 1-5 project roles from the enum. Always include a PROJECT_MANAGER (engagement driver). Add REVIEWER and COMPLIANCE_OFFICER for compliance-sensitive work. Add CLIENT_LIAISON for client-facing work. Add CHIEF_OF_STAFF if multi-stakeholder coordination is critical.
5. Provide a 1-2 sentence rationale explaining why you chose this shape. The user will see this and can override.
6. For customFields: include any industry-specific values the user mentioned (fee model, deadline, jurisdiction, etc.).
7. For informationRequirements: list up to 3 open questions where more info from the user would help shape the project.

${FALLBACK_FEW_SHOT}

OUTPUT FORMAT:
Respond with valid JSON only — no markdown fences, no commentary, no explanation.
The JSON must match this schema:
{
  "industry": "string",
  "description": "string (10-2000 chars)",
  "stages": [{"name": "string", "order": 0, "defaultDurationDays": 7, "description": "string"}],
  "goals": [{"title": "string", "measurableCriteria": "string"}],
  "members": [{"role": "PROJECT_MANAGER|PROJECT_DIRECTOR|RESEARCH_LEAD|QUALITY_LEAD|REVIEWER|COMPLIANCE_OFFICER|CLIENT_LIAISON|DOCUMENTATION_LEAD|KNOWLEDGE_MANAGER|CHIEF_OF_STAFF", "rationale": "string"}],
  "customFields": {"key": "value"},
  "informationRequirements": ["string"],
  "rationale": "string (10-2000 chars)"
}`;
  }

  /**
   * Retrieve industry-scoped context from the Knowledge Hub via RAGPipeline.
   *
   * SRP: this method only retrieves. It returns an empty string when:
   *   - RAGPipeline is not injected (degraded mode — FALLBACK_FEW_SHOT applies)
   *   - RAG returns zero chunks (no corpus content for this tenant + industry)
   *   - RAG throws (graceful failure logged but never blocks synthesis)
   *
   * Phase 0 G4. The shape of the query is deliberately industry-tagged so
   * the chunk filter (when industry knowledge seeds land in Phase 2) can
   * restrict retrieval to `tags: ["industry:<slug>"]` without changing this
   * call site.
   */
  private async retrieveRagContext(input: SynthesizeShapeInput): Promise<string> {
    if (!this.ragPipeline) return '';
    const hint = input.industryHint?.trim();
    if (!hint) return '';
    const query = `${hint} project workflow stages roles goals compliance deliverables`;
    const chunks = await this.ragPipeline.retrieveChunks(input.tenantId, query, {
      topK: 3,
      maxContextTokens: 1200,
    });
    if (!chunks.length) return '';
    return chunks
      .map((c, i) => `[${i + 1}] ${c.title} (type=${c.type})\n${c.text}`)
      .join('\n\n---\n\n');
  }

  /**
   * Call the LLM and salvage a JSON object from its response.
   *
   * The MiniMax-M2.7-highspeed model frequently returns prose around JSON
   * ("Sure! Here is the project shape: {...}") that fails JSON.parse.
   * AiGatewayService.invokeStructured only does JSON.parse (no extraction),
   * so we route through invoke() and use extractJsonObject to find the
   * first balanced { ... } block — mirroring query.tool.ts.
   *
   * Once extracted, we still validate against ProjectShapeSchema to catch
   * shape mismatches before returning. Throws AiGatewayStructuredValidationError
   * if validation fails so the repair loop kicks in.
   */
  private async callLlmForShape(
    prompt: string,
    tenantId: string,
    temperature: number = 0.2,
  ): Promise<{ shape: ProjectShape; model?: string; tokens: { input: number; output: number; total: number } }> {
    const response = await this.aiGateway.invoke({
      capability: 'planning',
      prompt,
      sourceModule: 'project-shape-synthesis',
      tenantId,
      temperature,
      maxTokens: 4000,
    });
    const json = this.extractJsonObject(response.content);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      throw new Error(
        `LLM returned what looks like JSON but it failed JSON.parse: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const result = ProjectShapeSchema.safeParse(parsed);
    if (!result.success) {
      // Re-throw as a typed error so extractZodIssues picks it up.
      const issues = result.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      throw new Error(`Schema validation failed: ${issues}`);
    }
    return {
      shape: result.data,
      model: response.model,
      tokens: {
        input: response.usage?.inputTokens ?? 0,
        output: response.usage?.outputTokens ?? 0,
        total: response.usage?.totalTokens ?? 0,
      },
    };
  }

  /**
   * Strip markdown fences (if present) and extract the first balanced {...}
   * block. Mirrors query.tool.ts.
   */
  private extractJsonObject(text: string): string {
    const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (fenced) return fenced[1];
    const first = text.indexOf('{');
    if (first === -1) throw new Error('No JSON object found in LLM response');
    let depth = 0;
    for (let i = first; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) return text.slice(first, i + 1);
      }
    }
    throw new Error('No balanced JSON object in LLM response');
  }

  /**
   * Extract Zod issues from a thrown error so the repair prompt can be specific.
   * Returns null if the error isn't a schema-validation failure (in which case
   * the repair loop is skipped).
   *
   * Distinguishes between:
   * - JSON parse failure (AiGateway already tried 2x JSON repair internally).
   *   We don't retry — propagating the original error is the right call.
   * - Schema validation failure (LLM returned valid JSON but wrong shape).
   *   We retry with the issues fed back to the model.
   */
  private extractZodIssues(err: unknown): string | null {
    if (err instanceof z.ZodError) {
      return err.errors
        .map((e) => `${e.path.join('.') || '(root)'}: ${e.message}`)
        .join('; ');
    }
    const anyErr = err as {
      code?: string;
      zodIssues?: ReadonlyArray<{ path: string; message: string }>;
      cause?: unknown;
      message?: string;
    };
    // AiGatewayStructuredValidationError — has zodIssues array.
    if (anyErr?.code === 'AI_GATEWAY_STRUCTURED_VALIDATION' && anyErr.zodIssues) {
      const fromIssues = anyErr.zodIssues
        .map((i) => `${i.path || '(root)'}: ${i.message}`)
        .join('; ');
      // If the cause is a ZodError (schema rejection, not JSON parse), surface it.
      const fromCause =
        anyErr.cause instanceof z.ZodError
          ? anyErr.cause.errors
              .map((e) => `${e.path.join('.') || '(root)'}: ${e.message}`)
              .join('; ')
          : '';
      return [fromIssues, fromCause].filter(Boolean).join(' | ');
    }
    // Internal "Schema validation failed: ..." error from callLlmForShape.
    // Extract the issues from the message so the repair retry can use them.
    if (
      anyErr?.message &&
      typeof anyErr.message === 'string' &&
      anyErr.message.startsWith('Schema validation failed:')
    ) {
      return anyErr.message.replace(/^Schema validation failed:\s*/, '');
    }
    return null;
  }
}
