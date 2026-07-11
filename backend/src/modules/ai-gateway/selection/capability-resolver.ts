/**
 * Capability Resolver
 *
 * Single public method: `resolve(tenantId, capability, opts)` →
 *   `{ provider, model, apiKey, overrides }`.
 *
 * The resolver:
 *   1. Builds the candidate chain via `FallbackChainBuilder`.
 *   2. Applies the `preferSpeed` policy (currently: pick first link).
 *   3. Validates the budget pre-check (if `budgetCents` provided).
 *   4. Resolves the API key via `SecretProviderService`.
 *   5. Returns the first link that has an API key configured.
 *
 * If no link is usable, throws `AiGatewayUnconfiguredError`.
 *
 * SOLID: SRP — resolution only. Selection, cost, transport are elsewhere.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SecretProviderService } from '../../security/providers/secret.provider';
import type { Capability } from '../domain/capabilities';
import { AiGatewayBudgetExceededError } from '../domain/errors';
import type { ResolvedModel, SelectOptions } from '../domain/types';
import { FallbackChainBuilder } from '../failover/fallback-chain';
import { AiModelRepository } from './ai-model.repository';

@Injectable()
export class CapabilityResolver {
  private readonly logger = new Logger(CapabilityResolver.name);

  constructor(
    private readonly chainBuilder: FallbackChainBuilder,
    private readonly secrets: SecretProviderService,
    private readonly modelRepo: AiModelRepository,
  ) {}

  async resolve(
    tenantId: string | null,
    capability: Capability,
    opts: SelectOptions & { modelId?: string } = {},
  ): Promise<ResolvedModel> {
    const chain = await this.chainBuilder.build(
      tenantId,
      capability,
      opts.modelId,
    );
    if (chain.length === 0) {
      throw new Error(
        `No models available for capability ${capability}. Add one via /admin/models.`,
      );
    }
    if (opts.preferSpeed) {
      chain.sort((a, b) => a.priorityHint - b.priorityHint);
    }
    for (const link of chain) {
      const apiKey = this.secrets.resolve(`env:${link.apiKeyEnv}`).value;
      if (!apiKey) {
        this.logger.warn(
          `Skipping ${link.providerSlug}/${link.modelId} (capability=${capability}): ` +
            `env ${link.apiKeyEnv} is not set`,
        );
        continue;
      }
      const fullModel = await this.modelRepo.findById(link.aiModelId);
      if (!fullModel) continue;

      if (opts.budgetCents !== undefined && opts.estTokens !== undefined) {
        const estimatedCents =
          (opts.estTokens / 1000) *
          (fullModel.costPer1kInput + fullModel.costPer1kOutput) *
          100;
        if (estimatedCents > opts.budgetCents) {
          throw new AiGatewayBudgetExceededError(
            opts.budgetCents,
            estimatedCents,
          );
        }
      }

      return {
        provider: {
          id: link.providerId,
          slug: link.providerSlug,
          name: link.providerName,
          apiBaseUrl: link.apiBaseUrl,
        },
        model: {
          id: fullModel.id,
          modelId: fullModel.modelId,
          displayName: fullModel.displayName,
          contextWindow: fullModel.contextWindow,
          costPer1kInput: fullModel.costPer1kInput,
          costPer1kOutput: fullModel.costPer1kOutput,
        },
        apiKey,
        overrides: {
          viaTenant: link.reason === 'tenant-override',
          viaFallback: link.reason === 'fallback' || link.reason === 'catalog',
        },
      };
    }
    throw new Error(
      `No usable model for capability ${capability}. ` +
        `All candidates lack a configured API key.`,
    );
  }
}
