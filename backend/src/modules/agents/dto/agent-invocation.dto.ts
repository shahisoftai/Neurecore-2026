import { IsString, IsOptional, IsObject, IsInt, Min, Max } from 'class-validator';

/**
 * DTO for POST /api/v1/agents/:id/invocations
 *
 * Phase 2 — Simulation-5 structured-output invocation endpoint.
 *
 * The simulation framework calls this endpoint with a structured output
 * schema (the AI Gateway already supports zod-based schemas; this DTO
 * extends that with a `repair` config and a `metadata` block for tracing).
 */
export class AgentInvocationDto {
  @IsString()
  task!: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  /**
   * The structured output schema. For Phase 2 vertical slice we accept
   * the schema as a free-form JSON Schema object. The runtime validates
   * the LLM's response against it and applies a repair pass on failure.
   */
  @IsOptional()
  @IsObject()
  structuredOutputSchema?: {
    name: string;
    schema: Record<string, any>;
    strict?: boolean;
  };

  /**
   * References to persisted records that the agent should ground its
   * response in. Each entry is `{ entityType, entityId }`.
   */
  @IsOptional()
  contextRefs?: Array<{
    entityType: string;
    entityId: string;
  }>;

  /**
   * Metadata for audit logging. The simulation framework sets:
   *   metadata.simulationId, metadata.day, metadata.engine
   * The endpoint stores this verbatim on the resulting HermesMessage.
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  /**
   * Repair pass configuration (revision 6 of the design).
   * enabled:   default true — when false, malformed output returns 422 immediately.
   * maxAttempts: default 2 — total LLM calls before failing.
   * maxCumulativeTokens: default 4 * expected — abort if token budget exceeded.
   */
  @IsOptional()
  @IsObject()
  repair?: {
    enabled?: boolean;
    maxAttempts?: number;
    maxCumulativeTokens?: number;
  };

  /**
   * Optional: explicit model override. If absent, the agent's default model is used.
   */
  @IsOptional()
  @IsString()
  modelOverride?: string;

  /**
   * Optional: temperature. Default 0.0 (we want deterministic reasoning for the
   * simulation; the framework can override for stochastic runs in Phase 1.5).
   */
  @IsOptional()
  temperature?: number;

  /**
   * Optional: explicit max output tokens.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(32768)
  maxTokens?: number;
}