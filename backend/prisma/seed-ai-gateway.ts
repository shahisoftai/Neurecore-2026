/**
 * AI Gateway Catalog Seed (idempotent)
 *
 * Populates 5 providers (MiniMax, DeepSeek, MiMo, OpenAI, Anthropic) and 12
 * models with capability flags and default priorities. Safe to re-run.
 *
 * Usage:  pnpm ts-node prisma/seed-ai-gateway.ts
 *   or:  node --loader ts-node/esm prisma/seed-ai-gateway.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const PROVIDERS: Array<{
  slug: string;
  name: string;
  apiBaseUrl: string;
  apiKeyEnv: string;
  isActive: boolean;
}> = [
  {
    slug: 'minimax',
    name: 'MiniMax',
    apiBaseUrl: 'https://api.minimaxi.com/v1',
    apiKeyEnv: 'MINIMAX_API_KEY',
    isActive: true,
  },
  {
    slug: 'deepseek',
    name: 'DeepSeek',
    apiBaseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    isActive: true,
  },
  {
    slug: 'mimo',
    name: 'Xiaomi MiMo',
    apiBaseUrl: 'https://api.mimo.ai/v1',
    apiKeyEnv: 'MIMO_API_KEY',
    isActive: true,
  },
  {
    slug: 'openai',
    name: 'OpenAI',
    apiBaseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    isActive: true,
  },
  {
    slug: 'anthropic',
    name: 'Anthropic',
    apiBaseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    isActive: false,
  },
];

type ModelSeed = {
  providerSlug: string;
  modelId: string;
  displayName: string;
  capabilities: string[];
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  isDefault?: boolean;
  priority: number;
  isAvailable?: boolean;
};

const MODELS: ModelSeed[] = [
  {
    providerSlug: 'minimax',
    modelId: 'MiniMax-M2.7-highspeed',
    displayName: 'MiniMax M2.7 Highspeed',
    capabilities: ['conversation', 'tools', 'execution', 'evaluation', 'planning'],
    contextWindow: 245760,
    costPer1kInput: 0.0004,
    costPer1kOutput: 0.0008,
    isDefault: true,
    priority: 10,
  },
  {
    providerSlug: 'minimax',
    modelId: 'MiniMax-M2.5',
    displayName: 'MiniMax M2.5',
    capabilities: ['conversation', 'tools'],
    contextWindow: 128000,
    costPer1kInput: 0.0002,
    costPer1kOutput: 0.0006,
    priority: 20,
  },
  {
    providerSlug: 'minimax',
    modelId: 'MiniMax-Text-01',
    displayName: 'MiniMax Text 01',
    capabilities: ['conversation'],
    contextWindow: 64000,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0003,
    priority: 30,
  },
  {
    providerSlug: 'deepseek',
    modelId: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    capabilities: ['conversation', 'planning', 'execution', 'evaluation'],
    contextWindow: 64000,
    costPer1kInput: 0.00014,
    costPer1kOutput: 0.00028,
    priority: 50,
  },
  {
    providerSlug: 'deepseek',
    modelId: 'deepseek-reasoner',
    displayName: 'DeepSeek Reasoner',
    capabilities: ['reasoning', 'planning', 'evaluation'],
    contextWindow: 64000,
    costPer1kInput: 0.00055,
    costPer1kOutput: 0.00219,
    isDefault: true,
    priority: 5,
  },
  {
    providerSlug: 'deepseek',
    modelId: 'deepseek-coder',
    displayName: 'DeepSeek Coder',
    capabilities: ['coding', 'tools'],
    contextWindow: 32000,
    costPer1kInput: 0.00014,
    costPer1kOutput: 0.00028,
    isDefault: true,
    priority: 5,
  },
  {
    providerSlug: 'mimo',
    modelId: 'MiMo-72B-Instruct',
    displayName: 'MiMo 72B Instruct',
    capabilities: ['conversation', 'execution'],
    contextWindow: 32000,
    costPer1kInput: 0.0001,
    costPer1kOutput: 0.0002,
    priority: 60,
  },
  {
    providerSlug: 'openai',
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o mini',
    capabilities: [
      'planning',
      'execution',
      'evaluation',
      'tools',
      'conversation',
    ],
    contextWindow: 128000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    isDefault: true,
    priority: 5,
  },
  {
    providerSlug: 'openai',
    modelId: 'gpt-4o',
    displayName: 'GPT-4o',
    capabilities: ['planning', 'reasoning', 'evaluation'],
    contextWindow: 128000,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
    priority: 20,
  },
  {
    providerSlug: 'openai',
    modelId: 'text-embedding-3-small',
    displayName: 'Text Embedding 3 Small',
    capabilities: ['embedding'],
    contextWindow: 8191,
    costPer1kInput: 0.00002,
    costPer1kOutput: 0,
    isDefault: true,
    priority: 5,
  },
  {
    providerSlug: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    capabilities: ['reasoning', 'planning', 'evaluation'],
    contextWindow: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    isAvailable: false,
    priority: 30,
  },
  {
    providerSlug: 'anthropic',
    modelId: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    capabilities: ['conversation', 'tools'],
    contextWindow: 200000,
    costPer1kInput: 0.00025,
    costPer1kOutput: 0.00125,
    isAvailable: false,
    priority: 50,
  },
];

async function seedProviders(): Promise<Map<string, string>> {
  const idBySlug = new Map<string, string>();
  for (const p of PROVIDERS) {
    const row = await prisma.modelProvider.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        apiBaseUrl: p.apiBaseUrl,
        apiKeyEnv: p.apiKeyEnv,
        isActive: p.isActive,
      },
      create: {
        slug: p.slug,
        name: p.name,
        apiBaseUrl: p.apiBaseUrl,
        apiKeyEnv: p.apiKeyEnv,
        isActive: p.isActive,
      },
    });
    idBySlug.set(p.slug, row.id);
  }
  return idBySlug;
}

async function seedModels(providerIds: Map<string, string>): Promise<void> {
  for (const m of MODELS) {
    const providerId = providerIds.get(m.providerSlug);
    if (!providerId) {
      throw new Error(
        `Seed integrity: provider ${m.providerSlug} not registered`,
      );
    }
    await prisma.aiModel.upsert({
      where: {
        providerId_modelId: { providerId, modelId: m.modelId },
      },
      update: {
        displayName: m.displayName,
        capabilities: m.capabilities,
        contextWindow: m.contextWindow,
        costPer1kInput: new Prisma.Decimal(m.costPer1kInput),
        costPer1kOutput: new Prisma.Decimal(m.costPer1kOutput),
        priority: m.priority,
        isAvailable: m.isAvailable ?? true,
        isDefault: m.isDefault ?? false,
      },
      create: {
        providerId,
        modelId: m.modelId,
        displayName: m.displayName,
        capabilities: m.capabilities,
        contextWindow: m.contextWindow,
        costPer1kInput: new Prisma.Decimal(m.costPer1kInput),
        costPer1kOutput: new Prisma.Decimal(m.costPer1kOutput),
        priority: m.priority,
        isAvailable: m.isAvailable ?? true,
        isDefault: m.isDefault ?? false,
      },
    });
  }
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[seed-ai-gateway] Upserting providers…');
  const providerIds = await seedProviders();
  // eslint-disable-next-line no-console
  console.log(`[seed-ai-gateway] ${providerIds.size} providers ready`);

  // eslint-disable-next-line no-console
  console.log('[seed-ai-gateway] Upserting models…');
  await seedModels(providerIds);

  const providerCount = await prisma.modelProvider.count();
  const modelCount = await prisma.aiModel.count();
  // eslint-disable-next-line no-console
  console.log(
    `[seed-ai-gateway] Done. model_providers=${providerCount} ai_models=${modelCount}`,
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-ai-gateway] failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
