/**
 * Cost Attributor
 *
 * Single writer for `CostRecord` rows. Idempotent on `sourceEventId`
 * (re-running safe). The gateway is the only caller in the codebase.
 *
 * SOLID: SRP — this class only writes cost rows. The calculation itself
 * is pure (`cost-calculator`) and reused by the test suite.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { computeCostCents, type CostInputs } from './cost-calculator';

export interface CostAttributionInput extends CostInputs {
  tenantId: string | null;
  sourceModule: string;
  sourceEventId: string;
  capability: string;
  providerId: string;
  aiModelId: string;
  latencyMs: number;
}

@Injectable()
export class CostAttributorService {
  private readonly logger = new Logger(CostAttributorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: CostAttributionInput): Promise<void> {
    const costCents = computeCostCents(input);
    if (
      costCents === 0 &&
      input.inputTokens === 0 &&
      input.outputTokens === 0
    ) {
      return; // no-op when there's nothing to attribute
    }
    try {
      const now = new Date();
      await this.prisma.costRecord.create({
        data: {
          ...(input.tenantId ? { tenantId: input.tenantId } : {}),
          sourceModule: input.sourceModule,
          sourceEventId: input.sourceEventId,
          provider: input.provider,
          model: input.modelId,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          costCents,
          windowStart: now,
          windowEnd: now,
          metadata: {
            capability: input.capability,
            providerId: input.providerId,
            aiModelId: input.aiModelId,
            latencyMs: input.latencyMs,
            costPer1kInput: input.costPer1kInput,
            costPer1kOutput: input.costPer1kOutput,
          },
        },
      });
    } catch (err) {
      // Idempotency: a `CostRecord` row with the same `sourceEventId` is
      // a soft error (a retry of the same call). We log and continue so
      // observability never breaks the user-facing flow.
      const msg = err instanceof Error ? err.message : String(err);
      if (/Unique constraint|sourceEventId/i.test(msg)) {
        return; // duplicate; safe to ignore
      }
      this.logger.warn(
        `Cost attribution failed for sourceEventId=${input.sourceEventId}: ${msg}`,
      );
    }
  }
}
