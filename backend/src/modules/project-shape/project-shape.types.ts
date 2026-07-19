/**
 * ProjectShape — the contract between Hermes LLM synthesis (ProjectShapeSynthesisService)
 * and the DB applier (DerivedShapeApplier).
 *
 * Hermes extracts intent from the user's chat message and emits this shape.
 * The shape is then materialized as Project + Stages + Goals + Members + CoS.
 *
 * This is a practical subset of the EUL v2.2 design (entity-agnostic) —
 * specifically for EntityKind=PROJECT only. See
 * memory-bank-new/plans/ai-driven-project-shape-synthesis-2026-07-19.md
 */

import { z } from 'zod';

/**
 * Roles that map cleanly to the Prisma ProjectRole enum
 * (see backend/prisma/schema.prisma: ProjectRole).
 * SRP: enum-only — no free-form strings. The synthesizer must emit
 * one of these values; the applier passes it through verbatim.
 */
export const ProjectRoleEnum = z.enum([
  'PROJECT_DIRECTOR',
  'PROJECT_MANAGER',
  'RESEARCH_LEAD',
  'QUALITY_LEAD',
  'REVIEWER',
  'COMPLIANCE_OFFICER',
  'CLIENT_LIAISON',
  'DOCUMENTATION_LEAD',
  'KNOWLEDGE_MANAGER',
  'CHIEF_OF_STAFF',
]);
export type ProjectRoleName = z.infer<typeof ProjectRoleEnum>;

/** Stage in the synthesized workflow. */
export const StageSchema = z.object({
  name: z.string().min(1).max(80).describe('Stage name, e.g. "Scoping", "Execute", "Deliver"'),
  order: z
    .number()
    .int()
    .min(0)
    .max(50)
    .describe('Zero-indexed sequential order of this stage in the workflow'),
  defaultDurationDays: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe('Expected duration in days for this stage (used for timeline planning)'),
  description: z.string().max(500).optional().describe('Short description of what this stage covers'),
});
export type Stage = z.infer<typeof StageSchema>;

/** Goal in the synthesized project. */
export const GoalSchema = z.object({
  title: z.string().min(1).max(200).describe('Concrete outcome the project must deliver'),
  measurableCriteria: z
    .string()
    .max(500)
    .optional()
    .describe('How we will know the goal is achieved — observable, testable'),
});
export type Goal = z.infer<typeof GoalSchema>;

/** Member in the synthesized project team. */
export const MemberSchema = z.object({
  role: ProjectRoleEnum.describe('ProjectRole enum value for this member'),
  rationale: z
    .string()
    .min(1)
    .max(300)
    .describe('Why this role is needed for THIS specific project (used to choose the agent template)'),
});
export type Member = z.infer<typeof MemberSchema>;

/**
 * ProjectShape — the full synthesized shape.
 *
 * Single source of truth for what "AI-synthesized project" means. SRP: this
 * type only describes the shape; it does not declare how to apply it.
 */
export const ProjectShapeSchema = z.object({
  industry: z
    .string()
    .min(1)
    .max(80)
    .describe("Best-guess industry vertical — used to pick AgentTemplate categories and to label the project"),
  description: z
    .string()
    .min(10)
    .max(2000)
    .describe('One-paragraph description of what this project is and why it matters. Surfaces to the user.'),
  stages: z
    .array(StageSchema)
    .min(1)
    .max(10)
    .describe('Sequential workflow phases the project moves through'),
  goals: z
    .array(GoalSchema)
    .min(1)
    .max(10)
    .describe('Concrete outcomes the project must deliver'),
  members: z
    .array(MemberSchema)
    .min(1)
    .max(8)
    .describe('Project team composition (Chief of Staff is added automatically if not present)'),
  customFields: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .describe('Industry-specific values inferred from the goal (e.g. {"industryVertical": "audit"})'),
  informationRequirements: z
    .array(z.string().max(200))
    .optional()
    .describe('Open questions where more info from the user would help — surfaced for follow-up'),
  rationale: z
    .string()
    .min(10)
    .max(2000)
    .describe("Why the LLM chose this shape — surfaces to the user so they can override"),
});
export type ProjectShape = z.infer<typeof ProjectShapeSchema>;

/**
 * Input for synthesis.
 */
export interface SynthesizeShapeInput {
  /** User's raw chat message — what they want to create. */
  goal: string;
  /** Tenant context — used for feature-flag overrides and RAG retrieval. */
  tenantId: string;
  /** Optional industry hint to guide Hermes (e.g. "audit", "construction"). */
  industryHint?: string;
  /** Optional user context — JWT user id (for traceability). */
  userId?: string;
}

/**
 * Output wrapper — includes the shape plus metadata for audit + UI.
 */
export interface SynthesizeShapeResult {
  shape: ProjectShape;
  /** Echoed user message — what was synthesized from. */
  sourceGoal: string;
  /** True if synthesis succeeded on first LLM call; false if repair retry fired. */
  usedRepairRetry: boolean;
  /** Model used for synthesis — useful for cost attribution and debugging. */
  model?: string;
  /** Token usage (input/output). */
  tokens?: { input: number; output: number; total: number };
}
