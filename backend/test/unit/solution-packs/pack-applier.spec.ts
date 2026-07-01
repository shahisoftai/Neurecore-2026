import { PackApplier } from '../../../src/modules/solution-packs/services/pack-applier';
import type { SolutionPack } from '../../../src/modules/solution-packs/interfaces/solution-pack.interface';

/**
 * Unit tests for `PackApplier` — Phase 7, Task 7.11.
 *
 * These tests verify the pure-transformation helpers (used internally
 * during install) without hitting Prisma. The full transactional path is
 * covered by Phase 7 e2e (out of scope here).
 */

function makePack(extensions: Partial<SolutionPack['extensions']> = {}): SolutionPack {
  return {
    id: 'pack-id-1',
    slug: 'retail',
    name: 'Retail',
    version: '1.0.0',
    category: 'VERTICAL',
    description: 'Retail',
    shortDescription: 'Retail',
    icon: 'shopping-cart',
    color: '#22c55e',
    tierRequired: 'PRO',
    status: 'stable',
    ownerKind: 'SEED',
    ownerId: null,
    extensions: {
      widgetExtensions: [],
      aiActionExtensions: [],
      knowledgePacks: [],
      entitySubtypes: [],
      ...extensions,
    } as SolutionPack['extensions'],
    requiresPacks: [],
    conflictsWith: [],
    tags: [],
    monthlyPriceUsd: 199,
    estimatedAiCredits: 5000,
    sortOrder: 100,
    publishedAt: '2026-06-28T00:00:00.000Z',
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T00:00:00.000Z',
  };
}

describe('PackApplier helpers', () => {
  let applier: PackApplier;

  beforeEach(() => {
    applier = new PackApplier(
      null as never,
      null as never,
      null as never,
      null as never,
      null as never,
    );
  });

  it('buildDefaultPreview includes widget count when widgets are present', () => {
    const preview = (applier as unknown as {
      buildDefaultPreview: (p: SolutionPack) => Array<{ description: string }>;
    }).buildDefaultPreview(
      makePack({
        widgetExtensions: [
          { id: 'w1', title: 'W1' } as never,
          { id: 'w2', title: 'W2' } as never,
          { id: 'w3', title: 'W3' } as never,
        ],
      }),
    );
    expect(preview).toHaveLength(1);
    expect(preview[0].description).toContain('3 widgets');
  });

  it('buildDefaultPreview includes all extension kinds', () => {
    const preview = (applier as unknown as {
      buildDefaultPreview: (p: SolutionPack) => Array<{ description: string }>;
    }).buildDefaultPreview(
      makePack({
        widgetExtensions: [{ id: 'w1', title: 'W1' } as never],
        aiActionExtensions: [{ id: 'a1', name: 'A1' } as never],
        knowledgePacks: [{ title: 'K1' } as never, { title: 'K2' } as never],
        entitySubtypes: [{ subtype: 'retail-store' } as never],
        kpiTemplates: [{ id: 'k1' } as never],
        workflowTemplates: [{ slug: 'wf1' } as never],
        integrationDefinitions: [{ providerId: 'shopify' } as never],
      }),
    );
    expect(preview[0].description).toContain('1 widgets');
    expect(preview[0].description).toContain('1 AI actions');
    expect(preview[0].description).toContain('2 knowledge entries');
    expect(preview[0].description).toContain('1 entity subtypes');
    expect(preview[0].description).toContain('1 KPI templates');
    expect(preview[0].description).toContain('1 workflow templates');
    expect(preview[0].description).toContain('1 integrations');
  });

  it('buildDefaultPreview returns a generic message when no extensions are provided', () => {
    const preview = (applier as unknown as {
      buildDefaultPreview: (p: SolutionPack) => Array<{ description: string }>;
    }).buildDefaultPreview(makePack({}));
    expect(preview[0].description).toContain('no new extensions');
  });

  it('buildKnowledgeEntry tags source with the pack slug', () => {
    const seed = {
      title: 'Sample SOP',
      type: 'SOP' as const,
      content: 'Procedure content',
      tags: ['process'],
    };
    const input = (applier as unknown as {
      buildKnowledgeEntry: (s: typeof seed, t: string, slug: string) => Record<string, unknown>;
    }).buildKnowledgeEntry(seed, 'tenant-1', 'retail');
    expect(input.source).toBe('solution_pack:retail');
    expect(input.title).toBe('[retail] Sample SOP');
    expect(input.tags).toEqual(['process']);
    expect(input.tenantId).toBe('tenant-1');
  });

  it('toWidgetDefinition maps pack fields to a full WidgetDefinition', () => {
    const def = (applier as unknown as {
      toWidgetDefinition: (w: {
        id: string;
        title: string;
        capability: 'OPERATIONAL_EFFICIENCY';
        aggregationType: 'COUNT';
        entityTypes: Array<'PROJECT'>;
        visualizations: Array<'KANBAN'>;
        defaultVisualization: 'KANBAN';
        refreshInterval: number;
        category: 'CORE';
      }) => { id: string; title: string; aggregationType: string; entityTypes: string[] };
    }).toWidgetDefinition({
      id: 'retail:inventory',
      title: 'Inventory',
      capability: 'OPERATIONAL_EFFICIENCY',
      aggregationType: 'COUNT',
      entityTypes: ['PROJECT'],
      visualizations: ['KANBAN'],
      defaultVisualization: 'KANBAN',
      refreshInterval: 0,
      category: 'CORE',
    });
    expect(def.id).toBe('retail:inventory');
    expect(def.aggregationType).toBe('COUNT');
    expect(def.entityTypes).toEqual(['PROJECT']);
  });

  it('toAIActionDefinition returns a working async handler', async () => {
    const def = (applier as unknown as {
      toAIActionDefinition: (
        a: { id: string; name: string; description: string; capability: 'intelligence'; category: 'INTELLIGENCE'; tags: string[]; supportedEntities: string[]; requiresStreaming: boolean; timeoutMs: number; tierRequired: 'PRO'; tokensEstimate: number },
        t: string,
      ) => { id: string; name: string; handler: () => Promise<{ output: string }> };
    }).toAIActionDefinition(
      {
        id: 'retail:foo',
        name: 'Foo',
        description: 'Foo action',
        capability: 'intelligence',
        category: 'INTELLIGENCE',
        tags: ['demo'],
        supportedEntities: ['*'],
        requiresStreaming: false,
        timeoutMs: 10000,
        tierRequired: 'PRO',
        tokensEstimate: 500,
      },
      'tenant-1',
    );
    expect(def.id).toBe('retail:foo');
    expect(def.name).toBe('Foo');
    expect(def.handler).toBeDefined();
    const result = await def.handler();
    expect(result.output).toContain('Placeholder');
  });
});