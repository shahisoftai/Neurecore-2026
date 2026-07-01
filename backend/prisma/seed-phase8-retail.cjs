/**
 * Seed Phase 8 — EAOS-6 First Vertical Pack (Retail).
 *
 * Per `EAOS-implementation-roadmap.md` §12 + `EAOS-implementation-plan.md`
 * §5.3 + §9.9. Ships a complete retail-ready seed:
 *
 *   - 12 retail AI actions (registered as Solution Pack extensions)
 *   - 6 retail KPI widgets
 *   - 50 retail knowledge entries (loss prevention, visual merch,
 *     inventory, customer service, returns, opening/closing SOPs)
 *   - 4 retail workflow templates (onboarding, opening, restock, EoD)
 *   - 2 integration definitions (Shopify, Square)
 *   - Mission Feed preview items
 *   - Theming impact (retail green accent)
 *   - Vertical-specific `EntitySubtype` definitions
 *
 * Run from backend directory:
 *   node prisma/seed-phase8-retail.cjs
 *
 * Idempotent — safe to re-run. Updates the existing `retail` SolutionPack
 * row with the full extension payload + seeds a standalone workflow + a
 * curated knowledge library that the demo tenant can install without
 * waiting for the pack-install transaction.
 */

const { PrismaClient } = require('@prisma/client');

// ─────────────────────────────────────────────────────────────────────────
// 12 retail AI Actions
// ─────────────────────────────────────────────────────────────────────────

const RETAIL_AI_ACTIONS = [
  {
    id: 'retail:inventory-forecast',
    name: 'Inventory Forecast',
    description: '7-day SKU-level inventory forecast using historical sales velocity and seasonality.',
    category: 'OPTIMIZATION',
    capability: 'insights',
    tags: ['inventory', 'forecast', 'replenishment'],
    supportedEntities: ['FACILITY'],
    requiresStreaming: false,
    timeoutMs: 20000,
    tierRequired: 'PRO',
    tokensEstimate: 1200,
    surfaces: ['command_palette', 'intelligence_panel'],
  },
  {
    id: 'retail:visual-merch',
    name: 'Visual Merchandising Plan',
    description: 'Generate a visual merchandising plan for the store, including focal points, signage, and product placement.',
    category: 'EXECUTION',
    capability: 'automation',
    tags: ['merchandising', 'visual', 'plan'],
    supportedEntities: ['FACILITY'],
    requiresStreaming: true,
    timeoutMs: 25000,
    tierRequired: 'PRO',
    tokensEstimate: 1500,
    surfaces: ['command_palette', 'intelligence_panel'],
  },
  {
    id: 'retail:nps-analysis',
    name: 'NPS Analysis',
    description: 'Analyse recent NPS survey responses, group by theme, and surface top drivers of promoter / detractor scores.',
    category: 'ANALYSIS',
    capability: 'intelligence',
    tags: ['nps', 'customer', 'sentiment'],
    supportedEntities: ['FACILITY', 'DEPARTMENT'],
    requiresStreaming: false,
    timeoutMs: 15000,
    tierRequired: 'PRO',
    tokensEstimate: 900,
    surfaces: ['command_palette', 'intelligence_panel'],
  },
  {
    id: 'retail:replenishment',
    name: 'Replenishment Order',
    description: 'Compute a replenishment order draft based on current stock, par levels, lead times, and forecasted demand.',
    category: 'EXECUTION',
    capability: 'operations',
    tags: ['inventory', 'replenishment', 'order'],
    supportedEntities: ['FACILITY'],
    requiresStreaming: false,
    timeoutMs: 18000,
    tierRequired: 'PRO',
    tokensEstimate: 1100,
    surfaces: ['command_palette', 'intelligence_panel'],
  },
  {
    id: 'retail:conversion-optimizer',
    name: 'Conversion Optimizer',
    description: 'Identify conversion funnel drop-offs and recommend A/B tests + landing-page changes to lift conversion rate.',
    category: 'OPTIMIZATION',
    capability: 'insights',
    tags: ['conversion', 'ecommerce', 'ab-test'],
    supportedEntities: ['FACILITY'],
    requiresStreaming: false,
    timeoutMs: 22000,
    tierRequired: 'PRO',
    tokensEstimate: 1400,
    surfaces: ['command_palette', 'intelligence_panel'],
  },
  {
    id: 'retail:loss-prevention',
    name: 'Loss Prevention Brief',
    description: 'Brief on shrinkage drivers, high-risk SKUs and times of day, with recommended LP actions.',
    category: 'ANALYSIS',
    capability: 'intelligence',
    tags: ['shrinkage', 'loss-prevention', 'security'],
    supportedEntities: ['FACILITY'],
    requiresStreaming: false,
    timeoutMs: 15000,
    tierRequired: 'PRO',
    tokensEstimate: 1000,
    surfaces: ['command_palette', 'intelligence_panel'],
  },
  {
    id: 'retail:staffing-forecast',
    name: 'Staffing Forecast',
    description: 'Hourly staffing recommendation for the next 7 days based on traffic, sales history, and labour budget.',
    category: 'PREDICTIVE',
    capability: 'intelligence',
    tags: ['staffing', 'schedule', 'labor'],
    supportedEntities: ['FACILITY'],
    requiresStreaming: false,
    timeoutMs: 18000,
    tierRequired: 'PRO',
    tokensEstimate: 1100,
    surfaces: ['command_palette', 'intelligence_panel'],
  },
  {
    id: 'retail:layout-optimize',
    name: 'Store Layout Optimizer',
    description: 'Suggest a planogram and floor-flow redesign optimised for dwell time, basket size, and safety.',
    category: 'OPTIMIZATION',
    capability: 'automation',
    tags: ['layout', 'planogram', 'flow'],
    supportedEntities: ['FACILITY'],
    requiresStreaming: true,
    timeoutMs: 28000,
    tierRequired: 'PRO',
    tokensEstimate: 1700,
    surfaces: ['command_palette', 'intelligence_panel'],
  },
  {
    id: 'retail:assortment-plan',
    name: 'Assortment Plan',
    description: 'Recommend SKU mix by category, including delists, listings, and depth-of-assortment targets.',
    category: 'OPTIMIZATION',
    capability: 'insights',
    tags: ['assortment', 'merchandising', 'category'],
    supportedEntities: ['FACILITY'],
    requiresStreaming: false,
    timeoutMs: 22000,
    tierRequired: 'PRO',
    tokensEstimate: 1400,
    surfaces: ['command_palette', 'intelligence_panel'],
  },
  {
    id: 'retail:markdown-optimizer',
    name: 'Markdown Optimizer',
    description: 'Recommend markdowns by SKU and week to clear aged inventory while protecting margin.',
    category: 'OPTIMIZATION',
    capability: 'insights',
    tags: ['markdown', 'pricing', 'clearance'],
    supportedEntities: ['FACILITY'],
    requiresStreaming: false,
    timeoutMs: 18000,
    tierRequired: 'PRO',
    tokensEstimate: 1100,
    surfaces: ['command_palette', 'intelligence_panel'],
  },
  {
    id: 'retail:demand-sensing',
    name: 'Demand Sensing',
    description: 'Short-horizon demand signal from POS, weather, events, and social — surfaced as an alert.',
    category: 'PREDICTIVE',
    capability: 'intelligence',
    tags: ['demand', 'forecast', 'signal'],
    supportedEntities: ['FACILITY'],
    requiresStreaming: false,
    timeoutMs: 12000,
    tierRequired: 'PRO',
    tokensEstimate: 700,
    surfaces: ['command_palette', 'intelligence_panel'],
  },
  {
    id: 'retail:shopper-segmentation',
    name: 'Shopper Segmentation',
    description: 'Cluster shoppers by RFM + behaviour and recommend segments for personalised marketing.',
    category: 'ANALYSIS',
    capability: 'intelligence',
    tags: ['segmentation', 'rfm', 'marketing'],
    supportedEntities: ['FACILITY', 'DEPARTMENT'],
    requiresStreaming: false,
    timeoutMs: 18000,
    tierRequired: 'PRO',
    tokensEstimate: 1100,
    surfaces: ['command_palette', 'intelligence_panel'],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 6 retail KPI widgets
// ─────────────────────────────────────────────────────────────────────────

const RETAIL_WIDGETS = [
  {
    id: 'retail-kpi:sales-per-sqft',
    capability: 'FINANCIAL_PERFORMANCE',
    capabilityDomain: 'financial',
    title: 'Sales per Sq Ft',
    subtitle: 'Daily revenue ÷ store area',
    icon: 'square',
    aggregationType: 'RATIO',
    defaultVisualization: 'CARD',
    visualizations: ['CARD', 'SPARKLINE'],
    entityTypes: ['FACILITY'],
    refreshInterval: 300000,
    category: 'INDUSTRY_SPECIFIC',
    description: 'Daily revenue per square foot of selling area.',
  },
  {
    id: 'retail-kpi:stockout-rate',
    capability: 'INVENTORY_STATUS',
    capabilityDomain: 'inventory',
    title: 'Stockout Rate',
    subtitle: '% of SKUs out of stock',
    icon: 'package-x',
    aggregationType: 'PERCENTAGE',
    defaultVisualization: 'GAUGE',
    visualizations: ['GAUGE', 'LINE_CHART'],
    entityTypes: ['FACILITY'],
    refreshInterval: 60000,
    category: 'INDUSTRY_SPECIFIC',
    description: 'Percentage of SKUs that hit zero on-hand in the period.',
  },
  {
    id: 'retail-kpi:inventory-heatmap',
    capability: 'INVENTORY_STATUS',
    capabilityDomain: 'inventory',
    title: 'Inventory Heatmap',
    subtitle: 'SKU × day sell-through %',
    icon: 'layout-grid',
    aggregationType: 'CUSTOM',
    defaultVisualization: 'HEATMAP',
    visualizations: ['HEATMAP'],
    entityTypes: ['FACILITY'],
    refreshInterval: 600000,
    category: 'INDUSTRY_SPECIFIC',
    description: 'Heatmap of SKU sell-through by day.',
  },
  {
    id: 'retail-kpi:customer-nps-gauge',
    capability: 'CUSTOMER_HEALTH',
    capabilityDomain: 'customer',
    title: 'Customer NPS',
    subtitle: 'Net promoter score',
    icon: 'smile',
    aggregationType: 'AVG',
    defaultVisualization: 'GAUGE',
    visualizations: ['GAUGE', 'LINE_CHART'],
    entityTypes: ['FACILITY'],
    refreshInterval: 600000,
    category: 'INDUSTRY_SPECIFIC',
    description: 'Net promoter score for the period.',
  },
  {
    id: 'retail-kpi:conversion-rate',
    capability: 'FINANCIAL_PERFORMANCE',
    capabilityDomain: 'financial',
    title: 'Conversion Rate',
    subtitle: 'Visitors → buyers',
    icon: 'target',
    aggregationType: 'PERCENTAGE',
    defaultVisualization: 'LINE_CHART',
    visualizations: ['LINE_CHART', 'SPARKLINE'],
    entityTypes: ['FACILITY'],
    refreshInterval: 300000,
    category: 'INDUSTRY_SPECIFIC',
    description: 'Percentage of visitors who made a purchase.',
  },
  {
    id: 'retail-kpi:sales-by-hour',
    capability: 'FINANCIAL_PERFORMANCE',
    capabilityDomain: 'financial',
    title: 'Sales by Hour',
    subtitle: 'Average hourly revenue',
    icon: 'clock',
    aggregationType: 'AVG',
    defaultVisualization: 'BAR_CHART',
    visualizations: ['BAR_CHART', 'LINE_CHART'],
    entityTypes: ['FACILITY'],
    refreshInterval: 600000,
    category: 'INDUSTRY_SPECIFIC',
    description: 'Average sales per hour of day across the period.',
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 6 retail KPI templates (for the catalogue + workspace KPIs panel)
// ─────────────────────────────────────────────────────────────────────────

const RETAIL_KPI_TEMPLATES = [
  { id: 'retail-kpi:sales-per-sqft', label: 'Sales per Sq Ft', unit: 'USD', aggregation: 'RATIO', dataSourceEntityType: 'FACILITY', description: 'Daily revenue per square foot of selling area.' },
  { id: 'retail-kpi:stockout-rate', label: 'Stockout Rate', unit: '%', aggregation: 'PERCENTAGE', dataSourceEntityType: 'FACILITY', description: '% of SKUs that hit zero in the period.' },
  { id: 'retail-kpi:inventory-heatmap', label: 'Inventory Heatmap', unit: 'heatmap', aggregation: 'CUSTOM', dataSourceEntityType: 'FACILITY', description: 'SKU × day sell-through heatmap.' },
  { id: 'retail-kpi:customer-nps-gauge', label: 'Customer NPS', unit: 'score', aggregation: 'AVG', dataSourceEntityType: 'FACILITY', description: 'Net promoter score.' },
  { id: 'retail-kpi:conversion-rate', label: 'Conversion Rate', unit: '%', aggregation: 'PERCENTAGE', dataSourceEntityType: 'FACILITY', description: '% of visitors who made a purchase.' },
  { id: 'retail-kpi:sales-by-hour', label: 'Sales by Hour', unit: 'USD', aggregation: 'AVG', dataSourceEntityType: 'FACILITY', description: 'Average sales per hour of day.' },
];

// ─────────────────────────────────────────────────────────────────────────
// 2 retail integrations
// ─────────────────────────────────────────────────────────────────────────

const RETAIL_INTEGRATIONS = [
  {
    providerId: 'shopify',
    name: 'Shopify',
    category: 'ecommerce',
    description: 'Sync products, orders, and customers from Shopify. Supports inventory updates and order webhook ingest.',
    capabilities: ['inventory-sync', 'order-sync', 'customer-sync', 'product-sync'],
    authType: 'oauth2',
  },
  {
    providerId: 'square',
    name: 'Square',
    category: 'payments',
    description: 'POS + payments sync from Square. Syncs line items, tenders, and inventory counts per location.',
    capabilities: ['payment-sync', 'order-sync', 'inventory-sync'],
    authType: 'oauth2',
  },
];

// ─────────────────────────────────────────────────────────────────────────
// 50 retail knowledge entries — comprehensive library
// ─────────────────────────────────────────────────────────────────────────

const RETAIL_KNOWLEDGE = [
  // ── Loss Prevention (10 entries)
  { title: 'Retail Loss Prevention Playbook', type: 'PLAYBOOK', content: 'Shrinkage drivers: employee theft (33%), shoplifting (36%), vendor fraud (5%), administrative error (20%). High-risk windows: 16:00-20:00 on weekends. LP actions: CCTV review, receipt checks, exit gates.', tags: ['shrinkage', 'loss-prevention', 'playbook'] },
  { title: 'Shoplifting Response Procedure', type: 'SOP', content: 'Do not physically confront suspected shoplifters. Engage LP-trained staff only. Witnesses should provide a written statement within 24 hours. File a police report within 48 hours if merchandise value exceeds the local threshold.', tags: ['shoplifting', 'safety'] },
  { title: 'CCTV Coverage Standards', type: 'POLICY', content: 'Cameras must cover all entrances/exits, POS lanes, high-shrink zones, and stockrooms. Recordings retained 30 days minimum. Frame rate ≥ 15 fps. Audio recording prohibited where state law requires consent.', tags: ['cctv', 'security'] },
  { title: 'High-Risk SKU Audit Cadence', type: 'SOP', content: 'Top 100 shrink SKUs are cycle-counted weekly. Discrepancies > 2% trigger an immediate re-count and LP review within 24 hours.', tags: ['inventory', 'audit'] },
  { title: 'Employee Theft Red Flags', type: 'GUIDE', content: 'Common indicators: voids without receipts, refund-to-gift-card abuse, after-hours register activity, sweetheart discounts for friends/family. Always cross-check with POS logs and CCTV.', tags: ['employee-theft', 'red-flags'] },
  { title: 'Vendor Fraud Indicators', type: 'GUIDE', content: 'Short deliveries, tampered seals, duplicate invoices, and unexpected substitution SKUs. Require photo evidence at receiving and reconcile within 4 hours.', tags: ['vendor-fraud', 'receiving'] },
  { title: 'Receipt Check Protocol', type: 'SOP', content: 'At randomly selected intervals (4–6 per shift), LP verifies that bagged merchandise matches the receipt. Train staff on a polite, non-confrontational script.', tags: ['receipt-check', 'lp'] },
  { title: 'Exit Gate Standards', type: 'POLICY', content: 'All stores > 5000 sq ft must have electronic article surveillance (EAS) gates. Daily battery test at opening. Alarms escalated to LP within 5 minutes.', tags: ['exit-gate', 'eas'] },
  { title: 'Shrinkage Reporting Template', type: 'TEMPLATE', content: 'Monthly shrink report: opening inventory + purchases − sales − closing inventory = shrink. Categorise by cause (employee / shoplift / vendor / admin) and submit by the 5th of the following month.', tags: ['reporting', 'shrinkage'] },
  { title: 'LP Communication Escalation Path', type: 'POLICY', content: 'Store associate → Store Manager → Regional LP → Corporate LP → Law Enforcement. Each level has a 24-hour response SLA.', tags: ['escalation', 'lp'] },

  // ── Visual Merchandising (8 entries)
  { title: 'Visual Merchandising Guide', type: 'GUIDE', content: 'Focal point at eye-level within first 5 metres. Use the "rule of three" for product groupings. Signage within 30-degree cone of vision. Update focal every 2 weeks.', tags: ['visual-merch', 'planogram'] },
  { title: 'Window Display Refresh Cadence', type: 'SOP', content: 'Street-facing windows are refreshed every 14 days. Hero product rotates monthly. Lighting check weekly. Mannequin styling refreshed every Friday for weekend traffic.', tags: ['windows', 'visual'] },
  { title: 'Signage Hierarchy Standards', type: 'GUIDE', content: 'Three tiers: (1) Department sign — 12pt bold sans-serif, (2) Category sign — 9pt semibold, (3) Product sign — 7pt regular. Maximum 5 words per sign. Brand colours only.', tags: ['signage', 'standards'] },
  { title: 'Product Adjacency Best Practices', type: 'GUIDE', content: 'Cross-merchandise complementary categories: socks near shoes, ties near shirts, batteries near electronics. Impulse items within 1.5m of POS.', tags: ['adjacency', 'merch'] },
  { title: 'Endcap Rotation Policy', type: 'POLICY', content: 'Endcaps rotate weekly. Top 20% velocity SKUs take priority. Use endcap for promotions, new arrivals, or seasonal heroes. Photo evidence to merch lead by Friday EOD.', tags: ['endcap', 'rotation'] },
  { title: 'Planogram Compliance Audit', type: 'SOP', content: 'Quarterly planogram compliance audit. Each fixture photographed top-down and matched to the master planogram. Deviation > 5% requires a corrective plan within 14 days.', tags: ['planogram', 'audit'] },
  { title: 'Lighting Standards', type: 'GUIDE', content: 'General floor: 750 lux. Feature displays: 1500 lux. Checkout: 500 lux. Use 3000K in apparel, 4000K in hardlines. LEDs only — no fluorescent in customer-facing zones.', tags: ['lighting'] },
  { title: 'Mannequin Styling Standards', type: 'GUIDE', content: 'Refresh weekly. Always complete head-to-toe looks. Include at least one accessory. Use only current-season merchandise. No sale items on mannequins.', tags: ['mannequin', 'styling'] },

  // ── Inventory & Replenishment (8 entries)
  { title: 'Replenishment Par Levels', type: 'POLICY', content: 'Par = (avg daily sales × lead time) + safety stock (7 days). Reviewed monthly. Out-of-stocks > 3% trigger a par review.', tags: ['par', 'replenishment'] },
  { title: 'Inbound Receiving SOP', type: 'SOP', content: 'All deliveries scanned against the PO within 30 minutes of arrival. Damages logged in the Damage Log and photographed. Vendor discrepancies escalated within 4 hours.', tags: ['receiving', 'inbound'] },
  { title: 'Cycle Count Schedule', type: 'POLICY', content: 'A-class SKUs (top 20% by revenue): weekly. B-class: monthly. C-class: quarterly. Random spot counts: daily for LP-flagged SKUs.', tags: ['cycle-count', 'inventory'] },
  { title: 'Stockout Response Protocol', type: 'SOP', content: 'Stockout > 4 hours → mark SKU as BO on the shelf, create a "want" list at POS. Stockout > 24 hours → notify category buyer. Stockout > 7 days → escalate to replenishment lead.', tags: ['stockout', 'protocol'] },
  { title: 'Returns to Vendor Process', type: 'SOP', content: 'Damaged or overstock returns processed weekly. RTVs require authorisation from the category buyer. Photo evidence attached in the RTV system.', tags: ['rtv', 'returns'] },
  { title: 'Inventory Adjustment Policy', type: 'POLICY', content: 'Adjustments > $500 require manager approval. Adjustments > $5000 require operations lead approval. Adjustment reasons must be selected from a controlled list.', tags: ['adjustment', 'inventory'] },
  { title: 'Cross-Docking Procedure', type: 'SOP', content: 'Pre-tagged inbound SKUs cross-docked within 4 hours of arrival. Cross-dock bays labelled per destination store. No cross-dock SKUs enter primary pick path.', tags: ['cross-dock', 'logistics'] },
  { title: 'Inventory Accuracy Target', type: 'POLICY', content: 'Store-wide inventory accuracy target: 98.5%+. Below 97% triggers a corrective plan and LP review. Accuracy measured weekly via cycle counts.', tags: ['accuracy', 'target'] },

  // ── Customer Service (8 entries)
  { title: 'Greeting Standards', type: 'POLICY', content: 'Greet every customer within 30 seconds of entering. Use "Welcome to [store], let me know if I can help". No "Hi, how are you". Tone: warm, not scripted.', tags: ['greeting', 'service'] },
  { title: 'Return Policy (Standard)', type: 'POLICY', content: '30 days for full refund with receipt. 60 days for store credit. Final sale items clearly tagged at the register. Refunds to original payment method only above $50 without manager approval.', tags: ['returns', 'policy'] },
  { title: 'Handling Customer Complaints', type: 'SOP', content: 'Listen first. Apologise sincerely. Offer a concrete solution (refund, exchange, manager callback within 24 hours). Document in the complaint log.', tags: ['complaints', 'service'] },
  { title: 'Loyalty Program Enrollment', type: 'SOP', content: 'Offer enrollment at POS for every customer. Use the 3-touchpoint rule: greeting, mid-shop, and checkout. Target: 60% of transactions include a loyalty offer.', tags: ['loyalty', 'enrollment'] },
  { title: 'BOPIS Pickup Standards', type: 'SOP', content: 'BOPIS orders must be ready within 2 hours. Customer notified by SMS. Pickup counter greeting includes name verification (last 4 of order number). Returns processed at the same counter.', tags: ['bopis', 'pickup'] },
  { title: 'Accessibility Standards', type: 'POLICY', content: 'All aisles ≥ 36 inches wide. Service counters at 34 inches height. Hearing loop at customer service. Staff trained on accessible communication on hire.', tags: ['accessibility', 'a11y'] },
  { title: 'NPS Survey Collection', type: 'SOP', content: 'Receipts include QR code for NPS survey. Goal: 8% response rate. Weekly review of detractor comments. Manager follow-up within 48 hours for any score ≤ 6.', tags: ['nps', 'survey'] },
  { title: 'Customer Data Privacy', type: 'POLICY', content: 'PCI DSS compliance for payment data. GDPR / CCPA rights respected. No customer PII shared with third parties without consent. Retention 7 years for transaction records.', tags: ['privacy', 'compliance'] },

  // ── Operations / SOPs (8 entries)
  { title: 'Daily Store Opening Checklist', type: 'SOP', content: '1) Unlock doors at posted time. 2) Power on POS lanes. 3) Count opening cash drawer. 4) Walk the floor for safety hazards. 5) Confirm receiving team is on schedule. 6) Brief team on daily focus.', tags: ['opening', 'checklist'] },
  { title: 'Daily Store Closing Checklist', type: 'SOP', content: '1) Announce closing 30 minutes before. 2) Recovery walk the entire store. 3) Cash drop + safe count. 4) Power down non-essential equipment. 5) Lock all back-of-house areas. 6) Arm alarm + lock up.', tags: ['closing', 'checklist'] },
  { title: 'New Hire Onboarding (Week 1)', type: 'SOP', content: 'Day 1: HR onboarding + safety briefing. Day 2: Register training + shadow shift. Day 3: Floor walkthrough + product overview. Day 4: Customer service roleplay. Day 5: First solo shift with mentor.', tags: ['onboarding', 'training'] },
  { title: 'Cash Handling Standards', type: 'POLICY', content: 'All cash drawers counted at open + close. Discrepancies > $5 require manager review. Safe combinations changed quarterly. No cash loans to staff, ever.', tags: ['cash', 'policy'] },
  { title: 'POS Downtime Procedure', type: 'SOP', content: 'If POS is down > 5 minutes: switch to manual receipts, capture customer contact info for follow-up, document items + prices. Reconcile within 24 hours.', tags: ['pos', 'downtime'] },
  { title: 'Severe Weather Protocol', type: 'SOP', content: 'Tornado/severe storm warning: shelter customers + staff in designated safe room (away from windows). Document any structural damage. Power off non-essential equipment only if safe.', tags: ['safety', 'weather'] },
  { title: 'Power Outage Procedure', type: 'SOP', content: 'Backup power supports POS + emergency lighting for 30 minutes. If outage > 30 minutes: close store, escort customers, secure cash, document incident.', tags: ['power', 'safety'] },
  { title: 'Weekly Stockroom Standards', type: 'SOP', content: 'Stockroom organised by category with clear signage. Top sellers at waist height. Returns processed daily. Trash + cardboard removed at end of each shift.', tags: ['stockroom', 'organisation'] },

  // ── Marketing / Loyalty (4 entries)
  { title: 'Email Campaign Best Practices', type: 'GUIDE', content: 'Subject ≤ 50 chars. Hero image with 1:1 ratio. Single CTA. Send Tuesday–Thursday 10am local. Always include an unsubscribe link.', tags: ['email', 'marketing'] },
  { title: 'Loyalty Tier Mechanics', type: 'POLICY', content: 'Tiers: Bronze (0–499 pts), Silver (500–1499), Gold (1500–4999), Platinum (5000+). Points expire after 12 months of inactivity. Tier review at calendar year end.', tags: ['loyalty', 'tiers'] },
  { title: 'Promotional Markdown Standards', type: 'POLICY', content: 'Markdown depths: 25% (slow movers), 40% (aged stock > 90 days), 60% (clearance floor). All markdowns > 50% require category buyer approval.', tags: ['markdown', 'promotion'] },
  { title: 'Store Events Playbook', type: 'PLAYBOOK', content: 'Plan events 6 weeks ahead. Coordinate with marketing (assets 4 weeks prior). Brief team 2 weeks out. Post-event NPS review within 7 days.', tags: ['events', 'marketing'] },

  // ── Compliance / Safety (4 entries)
  { title: 'OSHA Workplace Safety Standards', type: 'REGULATION', content: 'OSHA 1910 general industry standards apply. Reportable injuries logged within 8 hours. Ladder use only with a spotter. Box cutters stored blade-down.', tags: ['osha', 'safety'] },
  { title: 'Fire Safety Protocol', type: 'SOP', content: 'Fire extinguishers inspected monthly. Exit signs illuminated 24/7. Maximum occupancy posted. Annual fire drill + documentation required by local code.', tags: ['fire', 'safety'] },
  { title: 'ADA Accessibility Compliance', type: 'REGULATION', content: 'ADA Title III compliance: accessible entrances, restrooms, fitting rooms. Service animals welcome. Wheel availability at customer service.', tags: ['ada', 'accessibility'] },
  { title: 'Food Safety (if applicable)', type: 'REGULATION', content: 'For stores with consumables: FIFO rotation, daily temperature logs, allergen labelling per FDA. Perishable returns discarded immediately.', tags: ['food-safety', 'fda'] },
];

// ─────────────────────────────────────────────────────────────────────────
// 4 retail workflow templates
// ─────────────────────────────────────────────────────────────────────────

const RETAIL_WORKFLOW_TEMPLATES = [
  {
    slug: 'retail-employee-onboarding',
    name: 'Retail Employee Onboarding (7 days)',
    description: 'Welcome checklist + uniform issue + register certification + first solo shift.',
    trigger: 'user.created',
    steps: [
      { id: 'day1-hr', name: 'Day 1 — HR paperwork + safety briefing', assigneeRole: 'HR' },
      { id: 'day2-register', name: 'Day 2 — Register training + shadow', assigneeRole: 'TRAINER' },
      { id: 'day3-floor', name: 'Day 3 — Floor walkthrough + product tour', assigneeRole: 'DEPT_LEAD' },
      { id: 'day4-service', name: 'Day 4 — Customer service roleplay', assigneeRole: 'TRAINER' },
      { id: 'day5-solo', name: 'Day 5 — First solo shift with mentor', assigneeRole: 'DEPT_LEAD' },
      { id: 'day6-certify', name: 'Day 6 — Final certification + sign-off', assigneeRole: 'STORE_MGR' },
      { id: 'day7-launch', name: 'Day 7 — Full schedule begins', assigneeRole: 'STORE_MGR' },
    ],
  },
  {
    slug: 'retail-daily-opening',
    name: 'Daily Store Opening',
    description: 'Unlock, power up, count cash, walk the floor, brief team. Target completion: 30 minutes.',
    trigger: 'schedule.cron:0_6_*_*_*',
    steps: [
      { id: 'unlock', name: 'Unlock entrance + disarm alarm', assigneeRole: 'STORE_MGR' },
      { id: 'pos-power', name: 'Power on POS lanes (parallel)', assigneeRole: 'ASSOCIATE' },
      { id: 'cash-count', name: 'Count opening cash drawer', assigneeRole: 'ASSOC_LEAD' },
      { id: 'floor-walk', name: 'Floor safety walk + visual check', assigneeRole: 'STORE_MGR' },
      { id: 'brief', name: 'Daily team briefing (focus + promos)', assigneeRole: 'STORE_MGR' },
    ],
  },
  {
    slug: 'retail-restock-procedure',
    name: 'Restock Procedure (Daily)',
    description: 'Inbound receiving → back-stock → floor replenishment → facing. Target cycle time: 90 minutes.',
    trigger: 'inventory.received',
    steps: [
      { id: 'unload', name: 'Unload truck + verify PO', assigneeRole: 'RECEIVER' },
      { id: 'scan', name: 'Scan inbound against PO', assigneeRole: 'RECEIVER' },
      { id: 'back-stock', name: 'Back-stock overstock', assigneeRole: 'STOCKROOM' },
      { id: 'replenish', name: 'Replenish primary pick locations', assigneeRole: 'STOCKROOM' },
      { id: 'face', name: 'Face + front shelves', assigneeRole: 'ASSOCIATE' },
    ],
  },
  {
    slug: 'retail-end-of-day',
    name: 'End-of-Day Reconciliation',
    description: 'Closing walk + recovery + cash drop + register reconciliation + alarm + lock up.',
    trigger: 'schedule.cron:0_22_*_*_*',
    steps: [
      { id: 'announce', name: 'Announce closing (30 min prior)', assigneeRole: 'STORE_MGR' },
      { id: 'recovery', name: 'Full-store recovery + fitting rooms', assigneeRole: 'ASSOCIATE' },
      { id: 'cash-drop', name: 'Cash drop + safe count', assigneeRole: 'ASSOC_LEAD' },
      { id: 'reconcile', name: 'Register reconciliation + paperwork', assigneeRole: 'STORE_MGR' },
      { id: 'power-down', name: 'Power down non-essential equipment', assigneeRole: 'STORE_MGR' },
      { id: 'alarm', name: 'Arm alarm + lock up', assigneeRole: 'STORE_MGR' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Mission Feed preview items (post-install)
// ─────────────────────────────────────────────────────────────────────────

const RETAIL_MISSION_FEED = [
  {
    category: 'PACK_INSTALLED',
    priority: 'MEDIUM',
    title: 'Retail pack installed — 12 AI actions ready',
    description:
      'After install, you\'ll see 6 retail KPI widgets, 12 retail AI actions, 50 retail knowledge entries, and 4 workflow templates ready to use.',
    actionPayload: { kind: 'pack_installed', packSlug: 'retail' },
  },
  {
    category: 'INTEGRATION_AVAILABLE',
    priority: 'LOW',
    title: 'Connect Shopify or Square',
    description:
      'Sync products, orders, inventory and POS data from your existing commerce stack. Integrations are available in the Marketplace → Connectors tab.',
    actionPayload: { kind: 'integration_setup', packSlug: 'retail', providers: ['shopify', 'square'] },
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();
  console.log('Seeding Phase 8 — Retail Pack (vertical #1)');

  let knowledgeSeeded = 0;
  let workflowsSeeded = 0;

  try {
    // ── 1) Update the existing SolutionPack row with full extensions ──
    const existing = await prisma.solutionPack.findUnique({
      where: { slug: 'retail' },
    });
    if (!existing) {
      console.error('  ✗ retail SolutionPack not found — run seed-phase7.cjs first.');
      process.exitCode = 1;
      return;
    }

    const extensions = {
      entitySubtypes: [
        { baseType: 'FACILITY', subtype: 'retail-store', label: 'Retail Store', icon: 'shopping-bag', color: '#22c55e' },
        { baseType: 'CUSTOMER', subtype: 'shopper', label: 'Shopper', icon: 'user', color: '#16a34a' },
      ],
      widgetExtensions: RETAIL_WIDGETS,
      aiActionExtensions: RETAIL_AI_ACTIONS,
      kpiTemplates: RETAIL_KPI_TEMPLATES,
      integrationDefinitions: RETAIL_INTEGRATIONS,
      workflowTemplates: RETAIL_WORKFLOW_TEMPLATES.map((w) => ({
        slug: w.slug,
        name: w.name,
        description: w.description,
        trigger: w.trigger,
      })),
      knowledgePacks: RETAIL_KNOWLEDGE.map((k) => ({
        ...k,
        source: 'solution_pack:retail',
      })),
      previewMissionFeed: RETAIL_MISSION_FEED,
      themingImpact: {
        accentColor: '#22c55e',
        rationale:
          'Retail brand-friendly green palette (#22c55e). Drives workspace accents, AI roster chips, and storefront icons. Pairs with neutral chrome for dark-mode-first rendering per NUWS §7.5.2.',
      },
    };

    await prisma.solutionPack.update({
      where: { id: existing.id },
      data: {
        status: 'stable',
        version: '1.0.0',
        extensions,
        requiresPacks: ['corporate-services'],
        conflictsWith: [],
        tags: ['vertical', 'retail', 'pro'],
        monthlyPriceUsd: 199,
        estimatedAiCredits: 5000,
        sortOrder: 100,
      },
    });
    console.log(`  ✓ retail SolutionPack updated with ${RETAIL_AI_ACTIONS.length} actions, ${RETAIL_WIDGETS.length} widgets, ${RETAIL_KNOWLEDGE.length} knowledge entries`);

    // ── 2) Seed the 4 workflow templates (one row per template, isTemplate=true) ──
    // Workflows are tenant-scoped in the existing schema. We attach them
    // to a synthetic "platform-owner" tenant created on the fly if missing.
    const platformTenant = await ensurePlatformTenant(prisma);

    for (const tpl of RETAIL_WORKFLOW_TEMPLATES) {
      const def = {
        slug: tpl.slug,
        steps: tpl.steps,
        trigger: tpl.trigger,
        source: 'solution_pack:retail',
      };
      const existingWf = await prisma.workflow.findFirst({
        where: { tenantId: platformTenant.id, name: tpl.name },
      });
      if (existingWf) {
        await prisma.workflow.update({
          where: { id: existingWf.id },
          data: {
            description: tpl.description,
            status: 'DRAFT',
            isTemplate: true,
            definition: def,
          },
        });
      } else {
        await prisma.workflow.create({
          data: {
            tenantId: platformTenant.id,
            name: tpl.name,
            description: tpl.description,
            status: 'DRAFT',
            isTemplate: true,
            definition: def,
            config: { source: 'solution_pack:retail', trigger: tpl.trigger },
          },
        });
      }
      workflowsSeeded += 1;
    }
    console.log(`  ✓ ${workflowsSeeded} retail workflow templates seeded`);

    // ── 3) Seed the 50 knowledge entries (idempotent by title) ──
    for (const k of RETAIL_KNOWLEDGE) {
      const title = `[retail] ${k.title}`;
      const existingEntry = await prisma.knowledgeEntry.findFirst({
        where: { tenantId: platformTenant.id, title },
      });
      if (existingEntry) {
        await prisma.knowledgeEntry.update({
          where: { id: existingEntry.id },
          data: {
            type: k.type,
            content: k.content,
            tags: [...(k.tags || []), 'retail'],
            source: 'solution_pack:retail',
            status: 'published',
            version: '1.0.0',
          },
        });
      } else {
        await prisma.knowledgeEntry.create({
          data: {
            tenantId: platformTenant.id,
            type: k.type,
            title,
            content: k.content,
            tags: [...(k.tags || []), 'retail'],
            language: 'en',
            source: 'solution_pack:retail',
            status: 'published',
            version: '1.0.0',
            chunkCount: 1,
          },
        });
      }
      knowledgeSeeded += 1;
    }
    console.log(`  ✓ ${knowledgeSeeded} retail knowledge entries seeded`);

    // ── 4) Summary ──
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(' Phase 8 seed summary');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(` AI actions        : ${RETAIL_AI_ACTIONS.length}`);
    console.log(` KPI widgets       : ${RETAIL_WIDGETS.length}`);
    console.log(` Knowledge entries : ${knowledgeSeeded}`);
    console.log(` Workflow templates: ${workflowsSeeded}`);
    console.log(` Integrations      : ${RETAIL_INTEGRATIONS.length}`);
    console.log(` Mission Feed      : ${RETAIL_MISSION_FEED.length}`);
    console.log('═══════════════════════════════════════════════════════════');
  } catch (err) {
    console.error('Phase 8 seed failed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Ensure a synthetic platform-owner tenant exists. Workflows and
 * knowledge entries must be tenant-scoped (per the existing schema),
 * so the seed needs *some* tenant. The platform-owner tenant acts as
 * the canonical source of pack templates — when tenants install the
 * pack, the workflow + knowledge entries are cloned / referenced.
 */
async function ensurePlatformTenant(prisma) {
  const SLUG = 'platform-owner';
  let tenant = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug: SLUG,
        name: 'Platform Owner',
        plan: 'ENTERPRISE',
        status: 'ACTIVE',
      },
    });
    console.log(`  + created platform-owner tenant ${tenant.id}`);
  }
  return tenant;
}

main();