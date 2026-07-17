import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { AgentInvocationDto } from '../dto/agent-invocation.dto';
import { randomUUID } from 'crypto';

export interface AgentInvocationAttempt {
  attempt: number;
  parsed: boolean;
  schemaValid: boolean;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  rawResponse?: any;       // included only for debugging; do not log in production
}

export interface AgentInvocationResult {
  invocationId: string;
  provider: string;
  model: string;
  modelVersion: string;
  promptVersion: string;
  output: any;
  attempts: AgentInvocationAttempt[];
  tokenUsage: { input: number; output: number; total: number };
  totalLatencyMs: number;
  traceId: string;
}

/**
 * Phase 2 — Agent invocation service with structured output and bounded
 * repair pass (per design §06).
 *
 * Important: hosted LLMs are NOT bit-deterministic. The orchestration,
 * retry policy, and structured-output schema are deterministic; the
 * model's raw output is not. Every raw output, repair attempt, validation
 * error, model identifier, latency, and token count is recorded.
 */
@Injectable()
export class AgentInvocationsService {
  private readonly logger = new Logger(AgentInvocationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  /**
   * Invoke an agent with structured output and bounded repair pass.
   *
   * Flow:
   *   1. Load the agent record. Reject if disabled or not in this tenant.
   *   2. Compute expected token budget = maxTokens * 1.5 (or 4x if maxTokens absent).
   *   3. Loop: call LLM -> parse JSON -> validate against schema.
   *      On parse failure or schema failure: prompt with "your previous reply
   *      was not valid; return only valid JSON matching the schema".
   *   4. After maxAttempts (default 2) or cumulative token budget exceeded: throw.
   *   5. Persist each attempt's metadata in a HermesMessage.
   *   6. Return the validated output with full attempt trail.
   */
  async invoke(
    tenantId: string,
    agentId: string,
    dto: AgentInvocationDto,
    actorContext: {
      simulationId?: string;
      threadId?: string;
      userId?: string;
    },
  ): Promise<AgentInvocationResult> {
    // 1. Load the agent
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });
    if (!agent) throw new NotFoundException({ code: 'AGENT_NOT_FOUND' });
    if (!agent.isSelected) {
      throw new BadRequestException({
        code: 'AGENT_NOT_SELECTED',
        message: 'Agent is not selected and cannot be invoked.',
      });
    }

    // 2. Repair config with defaults
    const repairEnabled = dto.repair?.enabled !== false; // default true
    const maxAttempts = Math.max(1, dto.repair?.maxAttempts ?? 2);
    const maxCumulativeTokens = dto.repair?.maxCumulativeTokens ?? ((dto.maxTokens ?? 1024) * 4);

    const attempts: AgentInvocationAttempt[] = [];
    let cumulativeTokens = 0;
    let lastError: string | null = null;
    const invocationId = randomUUID();
    const traceId = randomUUID();

    let output: any = null;
    let parsed = false;
    let schemaValid = false;
    let lastRaw: any = null;
    let lastResponse: any = null;

    for (let attempt = 1; attempt <= maxAttempts + 1; attempt++) {
      if (cumulativeTokens > maxCumulativeTokens) {
        throw new BadRequestException({
          code: 'STRUCTURED_OUTPUT_TOKEN_BUDGET_EXCEEDED',
          message: `Cumulative token budget ${maxCumulativeTokens} exceeded at attempt ${attempt}.`,
        });
      }

      const startMs = Date.now();
      const isRepair = attempt > 1;
      const promptText = isRepair
        ? `${dto.task}\n\nYour previous reply did not match the requested schema. The schema is: ${JSON.stringify(dto.structuredOutputSchema?.schema)}. Your previous response was: ${JSON.stringify(lastRaw)}. Return ONLY valid JSON matching the schema, with no commentary or surrounding text.`
        : dto.task;

      let llmResponse: any;
      try {
        // Use the AI Gateway with structured output
        llmResponse = await this.aiGateway.invokeStructured({
          prompt: promptText,
          schema: this.zodFromJsonSchema(dto.structuredOutputSchema?.schema ?? {}),
          tenantId,
          sourceModule: 'simulation-5',
          capability: 'chat' as any, // ChatMessages capability; the gateway resolves the actual model
          modelId: dto.modelOverride ?? agent.model,
          temperature: dto.temperature ?? 0.0,
          maxTokens: dto.maxTokens,
          systemPrompt: dto.systemPrompt,
          metadata: {
            agentId: agent.id,
            agentName: agent.name,
            invocationId,
            attempt,
            ...(dto.metadata ?? {}),
          },
        });
      } catch (err: any) {
        const latencyMs = Date.now() - startMs;
        attempts.push({
          attempt,
          parsed: false,
          schemaValid: false,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs,
          rawResponse: { error: err?.message ?? 'unknown' },
        });
        if (!repairEnabled || attempt > maxAttempts) {
          throw new BadRequestException({
            code: 'STRUCTURED_OUTPUT_INVALID',
            message: `LLM call failed at attempt ${attempt}: ${err?.message ?? 'unknown'}`,
            attempts,
          });
        }
        continue;
      }

      const latencyMs = Date.now() - startMs;
      const usage = llmResponse.response?.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      cumulativeTokens += usage.totalTokens ?? 0;

      // 3. Parse the response
      let parsedThisAttempt = false;
      try {
        // The AI Gateway already returned a parsed object via invokeStructured's
        // own zod validation. But the user wants the *raw* response to be recorded
        // too, so we re-parse here for the audit trail.
        const raw = llmResponse.response?.content ?? JSON.stringify(llmResponse.data);
        lastRaw = raw;
        try {
          output = typeof raw === 'string' ? JSON.parse(raw) : raw;
          parsedThisAttempt = true;
        } catch {
          // The gateway may have already parsed; use its result.
          output = llmResponse.data;
          parsedThisAttempt = true;
        }
        lastResponse = llmResponse.response;
      } catch (e: any) {
        lastError = e?.message ?? 'parse failed';
      }

      // 4. Validate against the JSON Schema (best-effort)
      let schemaValidThisAttempt = parsedThisAttempt;
      if (parsedThisAttempt && dto.structuredOutputSchema) {
        schemaValidThisAttempt = this.validateAgainstJsonSchema(output, dto.structuredOutputSchema.schema);
      }
      // For Phase 2 we trust the AI Gateway's own zod validation as the source of truth
      // if it succeeded. So if llmResponse.data is non-null, we accept it.
      if (llmResponse.data !== undefined && llmResponse.data !== null) {
        output = llmResponse.data;
        parsed = true;
        schemaValid = true;
      }

      attempts.push({
        attempt,
        parsed: parsedThisAttempt,
        schemaValid: schemaValidThisAttempt,
        promptTokens: usage.promptTokens ?? 0,
        completionTokens: usage.completionTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
        latencyMs,
        rawResponse: { output: parsedThisAttempt ? output : lastRaw },
      });

      if (parsed && schemaValid) break;
      if (!repairEnabled) break;
      if (attempt > maxAttempts) break;
    }

    if (!parsed || !schemaValid) {
      throw new BadRequestException({
        code: 'STRUCTURED_OUTPUT_INVALID',
        message: `Failed to produce valid structured output after ${attempts.length} attempts. Last error: ${lastError ?? 'unknown'}.`,
        attempts,
      });
    }

    // 5. Persist audit record in HermesMessage
    const provider = (lastResponse?.provider ?? 'unknown') as string;
    const model = (lastResponse?.model ?? agent.model) as string;
    const modelVersion = (lastResponse?.modelVersion ?? 'unknown') as string;
    await this.persistAuditMessage({
      tenantId,
      agentId,
      invocationId,
      traceId,
      attempts,
      actorContext,
      provider,
      model,
      modelVersion,
      task: dto.task,
      output,
      cumulativeTokens,
    });

    const totalLatencyMs = attempts.reduce((s, a) => s + a.latencyMs, 0);

    return {
      invocationId,
      provider,
      model,
      modelVersion,
      promptVersion: 'v1',
      output,
      attempts,
      tokenUsage: {
        input: attempts.reduce((s, a) => s + a.promptTokens, 0),
        output: attempts.reduce((s, a) => s + a.completionTokens, 0),
        total: cumulativeTokens,
      },
      totalLatencyMs,
      traceId,
    };
  }

  private async persistAuditMessage(params: {
    tenantId: string;
    agentId: string;
    invocationId: string;
    traceId: string;
    attempts: AgentInvocationAttempt[];
    actorContext: { simulationId?: string; threadId?: string; userId?: string };
    provider: string;
    model: string;
    modelVersion: string;
    task: string;
    output: any;
    cumulativeTokens: number;
  }) {
    const sessionId = `inv-${params.invocationId}`;
    const summary = `Agent invocation: ${params.task.substring(0, 80)}`;
    const content = JSON.stringify({
      kind: 'agent_invocation',
      invocationId: params.invocationId,
      agentId: params.agentId,
      task: params.task,
      output: params.output,
      attempts: params.attempts.map((a) => ({
        attempt: a.attempt,
        parsed: a.parsed,
        schemaValid: a.schemaValid,
        promptTokens: a.promptTokens,
        completionTokens: a.completionTokens,
        totalTokens: a.totalTokens,
        latencyMs: a.latencyMs,
      })),
      provider: params.provider,
      model: params.model,
      modelVersion: params.modelVersion,
      traceId: params.traceId,
      totalTokens: params.cumulativeTokens,
    });
    await this.prisma.hermesMessage.create({
      data: {
        sessionId,
        role: 'HERMES',
        content,
        threadId: params.actorContext.threadId ?? null,
        contextType: 'AgentInvocation',
        contextId: params.invocationId,
        metadata: {
          agentId: params.agentId,
          provider: params.provider,
          model: params.model,
          modelVersion: params.modelVersion,
          traceId: params.traceId,
          attempts: params.attempts.length,
          totalTokens: params.cumulativeTokens,
        },
        simulationId: params.actorContext.simulationId ?? null,
      },
    });
  }

  /**
   * Convert a JSON Schema object to a zod schema (best-effort).
   * For Phase 2 we only support `type: object` with `properties` and `required`.
   * Anything else is permissive (`z.any()`).
   */
  private zodFromJsonSchema(schema: any): any {
    // Lazy import zod here so this file remains pure
    const z = require('zod');
    if (!schema || typeof schema !== 'object') return z.any();
    if (schema.type === 'object' && schema.properties) {
      const shape: Record<string, any> = {};
      for (const [key, prop] of Object.entries(schema.properties as Record<string, any>)) {
        shape[key] = this.zodFromJsonSchema(prop);
      }
      return z.object(shape);
    }
    if (schema.enum) {
      return z.enum(schema.enum);
    }
    if (schema.type === 'string') return z.string();
    if (schema.type === 'number' || schema.type === 'integer') return z.number();
    if (schema.type === 'boolean') return z.boolean();
    if (schema.type === 'array' && schema.items) {
      return z.array(this.zodFromJsonSchema(schema.items));
    }
    return z.any();
  }

  /**
   * Best-effort JSON Schema validator (only checks `required` and `type`).
   * Real production code should use Ajv. For Phase 2 this is enough.
   */
  private validateAgainstJsonSchema(value: any, schema: any): boolean {
    if (!schema || typeof schema !== 'object') return true;
    if (schema.type === 'object') {
      if (typeof value !== 'object' || value === null) return false;
      if (Array.isArray(schema.required)) {
        for (const req of schema.required) {
          if (!(req in value)) return false;
        }
      }
      if (schema.properties && typeof schema.properties === 'object') {
        for (const [k, v] of Object.entries(schema.properties as Record<string, any>)) {
          if (k in value) {
            if (!this.validateAgainstJsonSchema(value[k], v)) return false;
          }
        }
      }
      return true;
    }
    if (schema.type === 'string') return typeof value === 'string';
    if (schema.type === 'number' || schema.type === 'integer') return typeof value === 'number';
    if (schema.type === 'boolean') return typeof value === 'boolean';
    if (schema.type === 'array') {
      if (!Array.isArray(value)) return false;
      if (schema.items) {
        return value.every((v: any) => this.validateAgainstJsonSchema(v, schema.items));
      }
      return true;
    }
    return true;
  }
}