/**
 * Phase 7 G2 — WidgetRegistry.listForIndustryGroup filter tests.
 *
 * Covers:
 *   - non-industry widgets show up for every tenant
 *   - industryGroup-tagged widgets only show for matching group
 *   - unknown industryGroup falls back to non-industry widgets
 */

import { WidgetRegistry } from '../widget-registry';
import { FC_WIDGETS } from '../../financial-compliance/fc-widgets';
import type { WidgetDefinition } from '../widget-definition';

function coreWidget(id: string): WidgetDefinition {
  return {
    id,
    capability: 'FINANCIAL_PERFORMANCE',
    capabilityDomain: 'financial',
    dataSources: [{ entity: 'CUSTOMER', field: 'name' }],
    aggregationType: 'COUNT',
    computation: 'core',
    visualizations: ['CARD'],
    defaultVisualization: 'CARD',
    minSize: { w: 1, h: 1 },
    maxSize: { w: 4, h: 4 },
    defaultSize: { w: 2, h: 2 },
    configurableFields: [],
    refreshInterval: 0,
    title: id,
    entityTypes: ['CUSTOMER'],
    category: 'CORE',
  };
}

describe('WidgetRegistry.listForIndustryGroup — Phase 7 G2', () => {
  let registry: WidgetRegistry;

  beforeEach(() => {
    registry = new WidgetRegistry();
  });

  it('returns core widgets for every industry', () => {
    registry.register(coreWidget('core-1'));
    registry.register(coreWidget('core-2'));

    expect(registry.listForIndustryGroup('healthcare').map((w) => w.id)).toEqual([
      'core-1',
      'core-2',
    ]);
    expect(registry.listForIndustryGroup('agriculture-food').map((w) => w.id)).toEqual([
      'core-1',
      'core-2',
    ]);
  });

  it('returns F&C widgets only when industryGroup === financial-compliance', () => {
    for (const w of FC_WIDGETS) registry.register(w);
    registry.register(coreWidget('core-1'));

    const fcIds = registry
      .listForIndustryGroup('financial-compliance')
      .map((w) => w.id);
    expect(fcIds).toContain('fc-kpi:audit-completion-rate');
    expect(fcIds).toContain('fc-kpi:kyc-verification-rate');
    expect(fcIds).toContain('core-1');

    const healthcareIds = registry
      .listForIndustryGroup('healthcare')
      .map((w) => w.id);
    expect(healthcareIds).toEqual(['core-1']);
    expect(healthcareIds).not.toContain('fc-kpi:audit-completion-rate');
  });

  it('returns only core widgets when industryGroup is undefined', () => {
    for (const w of FC_WIDGETS) registry.register(w);
    registry.register(coreWidget('core-1'));

    const ids = registry.listForIndustryGroup(undefined).map((w) => w.id);
    expect(ids).toContain('core-1');
    // F&C widgets have industryGroup set, so they're filtered out
    // when the filter argument is undefined.
    expect(ids).not.toContain('fc-kpi:audit-completion-rate');
  });

  it('SRP: each F&C widget declares the correct industryGroup', () => {
    for (const w of FC_WIDGETS) {
      expect(w.industryGroup).toBe('financial-compliance');
    }
  });
});
