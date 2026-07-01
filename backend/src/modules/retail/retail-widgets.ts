/**
 * Retail widget definitions — Phase 8, Task 8.2.
 *
 * Per `EAOS-implementation-roadmap.md` §12 + `EAOS-implementation-plan.md` §5.3,
 * the retail pack ships 6 retail-specific KPI widgets. Each follows the 4-layer
 * widget contract from `widgets/widget-definition.ts`:
 *
 *   Layer 1: Capability  — `INVENTORY_STATUS` | `CUSTOMER_HEALTH` | `FINANCIAL_PERFORMANCE` | ...
 *   Layer 2: Data Source — `FACILITY` (retail-store)
 *   Layer 3: Aggregation — `SUM` | `AVG` | `PERCENTAGE` | `RATIO`
 *   Layer 4: Visualization — `CARD` | `GAUGE` | `HEATMAP` | `SPARKLINE` | `LINE_CHART`
 *
 * Each widget ID is prefixed `retail-kpi:` so they sort with the retail pack and
 * never collide with the 12 built-in widgets.
 *
 * SOLID:
 *  - SRP — this file only owns the *definition* of retail widgets. Runtime
 *    computation lives in the widgets module's aggregation engine.
 *  - OCP — new retail widgets can be added without modifying the engine.
 *  - ISP — each widget exposes only the data + visualization it needs.
 */
import type { WidgetDefinition } from '../widgets/widget-definition';

/**
 * Compute the canonical sales-per-sq-ft for a retail-store entity.
 * Reads the daily revenue (from POS sync) and divides by store sq-ft.
 * Output is a USD CARD with a 30-day sparkline.
 */
const SALES_PER_SQFT: WidgetDefinition = {
  id: 'retail-kpi:sales-per-sqft',
  capability: 'FINANCIAL_PERFORMANCE',
  capabilityDomain: 'financial',
  dataSources: [
    { entity: 'FACILITY', field: 'dailyRevenue' },
    { entity: 'FACILITY', field: 'squareFeet' },
  ],
  aggregationType: 'RATIO',
  computation: 'retailSalesPerSqFt',
  visualizations: ['CARD', 'SPARKLINE'],
  defaultVisualization: 'CARD',
  minSize: { w: 2, h: 2 },
  maxSize: { w: 4, h: 3 },
  defaultSize: { w: 3, h: 2 },
  configurableFields: [
    {
      key: 'days',
      label: 'Period',
      type: 'select',
      defaultValue: '30d',
      options: [
        { value: '7d', label: 'Last 7 days' },
        { value: '30d', label: 'Last 30 days' },
        { value: '90d', label: 'Last 90 days' },
      ],
    },
  ],
  refreshInterval: 300_000,
  title: 'Sales per Sq Ft',
  subtitle: 'Daily revenue ÷ store area',
  icon: 'square',
  entityTypes: ['FACILITY'],
  category: 'INDUSTRY_SPECIFIC',
};

/**
 * Stockout rate — % of SKUs that hit zero in the period. Computed as
 * COUNT(skus_with_zero_on_hand) / COUNT(skus_total). Output is a GAUGE.
 */
const STOCKOUT_RATE: WidgetDefinition = {
  id: 'retail-kpi:stockout-rate',
  capability: 'INVENTORY_STATUS',
  capabilityDomain: 'inventory',
  dataSources: [{ entity: 'FACILITY', field: 'skuStockoutCount' }],
  aggregationType: 'PERCENTAGE',
  computation: 'retailStockoutRate',
  visualizations: ['GAUGE', 'LINE_CHART'],
  defaultVisualization: 'GAUGE',
  minSize: { w: 3, h: 3 },
  maxSize: { w: 4, h: 4 },
  defaultSize: { w: 3, h: 3 },
  configurableFields: [
    {
      key: 'days',
      label: 'Period',
      type: 'select',
      defaultValue: '7d',
      options: [
        { value: '1d', label: 'Today' },
        { value: '7d', label: 'Last 7 days' },
        { value: '30d', label: 'Last 30 days' },
      ],
    },
  ],
  refreshInterval: 60_000,
  title: 'Stockout Rate',
  subtitle: '% of SKUs out of stock',
  icon: 'package-x',
  entityTypes: ['FACILITY'],
  category: 'INDUSTRY_SPECIFIC',
};

/**
 * Inventory heatmap — heatmap of SKU × day for the last 14 days, where
 * cell colour encodes sell-through %. Drives replenishment decisions.
 */
const INVENTORY_HEATMAP: WidgetDefinition = {
  id: 'retail-kpi:inventory-heatmap',
  capability: 'INVENTORY_STATUS',
  capabilityDomain: 'inventory',
  dataSources: [{ entity: 'FACILITY', field: 'skuDailySales' }],
  aggregationType: 'CUSTOM',
  computation: 'retailInventoryHeatmap',
  visualizations: ['HEATMAP'],
  defaultVisualization: 'HEATMAP',
  minSize: { w: 6, h: 4 },
  maxSize: { w: 12, h: 8 },
  defaultSize: { w: 8, h: 5 },
  configurableFields: [
    {
      key: 'days',
      label: 'Days',
      type: 'number',
      defaultValue: 14,
    },
    {
      key: 'topN',
      label: 'Top SKUs',
      type: 'number',
      defaultValue: 30,
    },
  ],
  refreshInterval: 600_000,
  title: 'Inventory Heatmap',
  subtitle: 'SKU × day sell-through %',
  icon: 'layout-grid',
  entityTypes: ['FACILITY'],
  category: 'INDUSTRY_SPECIFIC',
};

/**
 * Customer NPS — gauge of net promoter score for the period.
 */
const CUSTOMER_NPS_GAUGE: WidgetDefinition = {
  id: 'retail-kpi:customer-nps-gauge',
  capability: 'CUSTOMER_HEALTH',
  capabilityDomain: 'customer',
  dataSources: [{ entity: 'FACILITY', field: 'npsResponses' }],
  aggregationType: 'AVG',
  computation: 'retailCustomerNps',
  visualizations: ['GAUGE', 'LINE_CHART'],
  defaultVisualization: 'GAUGE',
  minSize: { w: 3, h: 3 },
  maxSize: { w: 4, h: 4 },
  defaultSize: { w: 3, h: 3 },
  configurableFields: [
    {
      key: 'days',
      label: 'Period',
      type: 'select',
      defaultValue: '30d',
      options: [
        { value: '7d', label: 'Last 7 days' },
        { value: '30d', label: 'Last 30 days' },
        { value: '90d', label: 'Last 90 days' },
      ],
    },
  ],
  refreshInterval: 600_000,
  title: 'Customer NPS',
  subtitle: 'Net promoter score',
  icon: 'smile',
  entityTypes: ['FACILITY'],
  category: 'INDUSTRY_SPECIFIC',
};

/**
 * Conversion rate — % of visitors who make a purchase.
 * Computation: COUNT(orders) / COUNT(visitors).
 */
const CONVERSION_RATE: WidgetDefinition = {
  id: 'retail-kpi:conversion-rate',
  capability: 'FINANCIAL_PERFORMANCE',
  capabilityDomain: 'financial',
  dataSources: [
    { entity: 'FACILITY', field: 'visitorCount' },
    { entity: 'FACILITY', field: 'orderCount' },
  ],
  aggregationType: 'PERCENTAGE',
  computation: 'retailConversionRate',
  visualizations: ['LINE_CHART', 'SPARKLINE'],
  defaultVisualization: 'LINE_CHART',
  minSize: { w: 4, h: 3 },
  maxSize: { w: 8, h: 5 },
  defaultSize: { w: 6, h: 4 },
  configurableFields: [
    {
      key: 'days',
      label: 'Days',
      type: 'number',
      defaultValue: 30,
    },
  ],
  refreshInterval: 300_000,
  title: 'Conversion Rate',
  subtitle: 'Visitors → buyers',
  icon: 'target',
  entityTypes: ['FACILITY'],
  category: 'INDUSTRY_SPECIFIC',
};

/**
 * Sales by hour — bar chart of average sales per hour of day over the
 * period. Drives staffing decisions.
 */
const SALES_BY_HOUR: WidgetDefinition = {
  id: 'retail-kpi:sales-by-hour',
  capability: 'FINANCIAL_PERFORMANCE',
  capabilityDomain: 'financial',
  dataSources: [{ entity: 'FACILITY', field: 'hourlySales' }],
  aggregationType: 'AVG',
  computation: 'retailSalesByHour',
  visualizations: ['BAR_CHART', 'LINE_CHART'],
  defaultVisualization: 'BAR_CHART',
  minSize: { w: 4, h: 3 },
  maxSize: { w: 12, h: 6 },
  defaultSize: { w: 6, h: 4 },
  configurableFields: [
    {
      key: 'days',
      label: 'Days',
      type: 'number',
      defaultValue: 14,
    },
  ],
  refreshInterval: 600_000,
  title: 'Sales by Hour',
  subtitle: 'Average hourly revenue',
  icon: 'clock',
  entityTypes: ['FACILITY'],
  category: 'INDUSTRY_SPECIFIC',
};

export const RETAIL_WIDGETS: ReadonlyArray<WidgetDefinition> = [
  SALES_PER_SQFT,
  STOCKOUT_RATE,
  INVENTORY_HEATMAP,
  CUSTOMER_NPS_GAUGE,
  CONVERSION_RATE,
  SALES_BY_HOUR,
];
