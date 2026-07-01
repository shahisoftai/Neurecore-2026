/**
 * Seed Phase 7 — Solution Packs.
 *
 * Phase 7, Task 7.5 (per `EAOS-implementation-roadmap.md` §11 +
 * `EAOS-pricing-plans.md` §3.3).
 *
 * Seeds the canonical EAOS-5 catalog: Corporate Services (HORIZONTAL,
 * tier=STARTER) plus 5 vertical packs (Retail / Manufacturing / Healthcare /
 * Logistics / Public Health) with proper entity subtypes, widgets, AI
 * actions, knowledge seeds, integrations, KPIs, and a Mission Feed
 * preview item.
 *
 * Run with: `node prisma/seed-phase7.cjs`
 * Idempotent: skips rows whose slug already exists.
 */

const { PrismaClient } = require('@prisma/client');

async function upsertPack(prisma, data) {
  const existing = await prisma.solutionPack.findUnique({ where: { slug: data.slug } });
  if (existing) {
    console.log(`  · pack "${data.slug}" already exists — updating`);
    return prisma.solutionPack.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        version: data.version,
        category: data.category,
        description: data.description,
        shortDescription: data.shortDescription,
        icon: data.icon,
        color: data.color,
        tierRequired: data.tierRequired,
        status: data.status,
        extensions: data.extensions,
        requiresPacks: data.requiresPacks,
        conflictsWith: data.conflictsWith,
        tags: data.tags,
        monthlyPriceUsd: data.monthlyPriceUsd,
        estimatedAiCredits: data.estimatedAiCredits,
        sortOrder: data.sortOrder,
      },
    });
  }
  console.log(`  + creating pack "${data.slug}"`);
  return prisma.solutionPack.create({ data });
}

const CORPORATE_SERVICES = {
  slug: 'corporate-services',
  name: 'Corporate Services',
  version: '1.0.0',
  category: 'HORIZONTAL',
  description:
    'Default Solution Pack included in every paid edition. Provides the cross-industry ' +
    'departments (Sales, Marketing, Operations, Finance, HR, Customer Support, IT, R&D, ' +
    'Executive) plus their AI Employees, knowledge base, workflows, and widgets.',
  shortDescription:
    'Default pack included in every paid tier. Adds 9 departments + AI employees + 5 workflows + 4 widgets.',
  icon: 'building',
  color: '#475569',
  tierRequired: 'STARTER',
  status: 'stable',
  ownerKind: 'SEED',
  requiresPacks: [],
  conflictsWith: [],
  tags: ['default', 'horizontal', 'starter'],
  monthlyPriceUsd: 0,
  estimatedAiCredits: 0,
  sortOrder: 10,
  extensions: {
    entitySubtypes: [
      { baseType: 'DEPARTMENT', subtype: 'sales', label: 'Sales', icon: 'trending-up', color: '#22c55e' },
      { baseType: 'DEPARTMENT', subtype: 'marketing', label: 'Marketing', icon: 'megaphone', color: '#f97316' },
      { baseType: 'DEPARTMENT', subtype: 'operations', label: 'Operations', icon: 'cog', color: '#0ea5e9' },
      { baseType: 'DEPARTMENT', subtype: 'finance', label: 'Finance', icon: 'dollar-sign', color: '#16a34a' },
      { baseType: 'DEPARTMENT', subtype: 'human-resources', label: 'Human Resources', icon: 'users', color: '#a855f7' },
      { baseType: 'DEPARTMENT', subtype: 'customer-support', label: 'Customer Support', icon: 'headphones', color: '#06b6d4' },
      { baseType: 'DEPARTMENT', subtype: 'it-administration', label: 'IT Administration', icon: 'server', color: '#64748b' },
      { baseType: 'DEPARTMENT', subtype: 'research-development', label: 'Research & Development', icon: 'flask', color: '#8b5cf6' },
      { baseType: 'DEPARTMENT', subtype: 'executive', label: 'Executive', icon: 'briefcase', color: '#1e293b' },
    ],
    widgetExtensions: [
      {
        id: 'core:financial-kpis',
        capability: 'FINANCIAL_PERFORMANCE',
        capabilityDomain: 'financial',
        title: 'Financial KPIs',
        subtitle: 'Revenue, expenses, burn rate',
        icon: 'dollar-sign',
        aggregationType: 'SUM',
        defaultVisualization: 'CARD',
        visualizations: ['CARD', 'LINE_CHART'],
        entityTypes: ['DEPARTMENT', 'PROJECT'],
        refreshInterval: 0,
        category: 'CORE',
        description: 'Core financial KPIs aggregated across the workspace.',
      },
      {
        id: 'core:workforce-dashboard',
        capability: 'WORKFORCE_STATUS',
        capabilityDomain: 'workforce',
        title: 'Workforce Dashboard',
        subtitle: 'Active humans + AI employees per department',
        icon: 'users',
        aggregationType: 'COUNT',
        defaultVisualization: 'GRID',
        visualizations: ['GRID', 'BAR_CHART'],
        entityTypes: ['DEPARTMENT'],
        refreshInterval: 0,
        category: 'CORE',
        description: 'Workforce composition per department.',
      },
      {
        id: 'core:project-tracker',
        capability: 'OPERATIONAL_EFFICIENCY',
        capabilityDomain: 'operational',
        title: 'Project Tracker',
        subtitle: 'Active vs blocked vs done projects',
        icon: 'kanban',
        aggregationType: 'COUNT',
        defaultVisualization: 'KANBAN',
        visualizations: ['KANBAN', 'TABLE'],
        entityTypes: ['PROJECT'],
        refreshInterval: 0,
        category: 'CORE',
        description: 'Project pipeline status.',
      },
      {
        id: 'core:customer-health',
        capability: 'CUSTOMER_HEALTH',
        capabilityDomain: 'customer',
        title: 'Customer Health',
        subtitle: 'NPS, churn risk, support tickets',
        icon: 'activity',
        aggregationType: 'AVG',
        defaultVisualization: 'GAUGE',
        visualizations: ['GAUGE', 'LINE_CHART'],
        entityTypes: ['DEPARTMENT'],
        refreshInterval: 0,
        category: 'CORE',
        description: 'Customer-facing health indicators.',
      },
    ],
    aiActionExtensions: [
      {
        id: 'pack:cs:weekly-briefing',
        name: 'Weekly Executive Briefing',
        description: 'Generate a Markdown executive briefing summarising the past 7 days.',
        category: 'REPORTING',
        capability: 'intelligence',
        tags: ['briefing', 'weekly', 'executive'],
        supportedEntities: ['*'],
        requiresStreaming: true,
        timeoutMs: 30000,
        tierRequired: 'STARTER',
        tokensEstimate: 1500,
        surfaces: ['command_palette', 'intelligence_panel'],
      },
      {
        id: 'pack:cs:department-summary',
        name: 'Department Summary',
        description: 'Summarise a department\'s projects, tasks, and AI activity.',
        category: 'INTELLIGENCE',
        capability: 'intelligence',
        tags: ['summary', 'department'],
        supportedEntities: ['DEPARTMENT'],
        requiresStreaming: false,
        timeoutMs: 15000,
        tierRequired: 'STARTER',
        tokensEstimate: 800,
        surfaces: ['command_palette', 'intelligence_panel'],
      },
    ],
    knowledgePacks: [
      {
        title: 'Standard Operating Procedure: Weekly Status Update',
        type: 'SOP',
        content:
          'Every Friday, every department lead publishes a status update covering: (1) goals achieved this week, ' +
          '(2) blockers, (3) next week\'s priorities. Updates are written to the department\'s `Activity` capability ' +
          'and broadcast via Mission Feed.',
        tags: ['process', 'communication'],
        source: 'solution_pack:corporate-services',
      },
      {
        title: 'Brand Voice Guidelines',
        type: 'GUIDE',
        content:
          'Tone: confident, concise, customer-centric. Avoid jargon. Use sentence case. Avoid exclamation marks ' +
          'in customer-facing copy. Numbers under 10 are spelled out; numbers ≥ 10 use digits.',
        tags: ['communication', 'brand'],
        source: 'solution_pack:corporate-services',
      },
    ],
    integrationDefinitions: [
      { providerId: 'google-workspace', name: 'Google Workspace', category: 'productivity', description: 'Gmail, Drive, Calendar, Meet' },
      { providerId: 'slack', name: 'Slack', category: 'communication', description: 'Team chat + notifications' },
      { providerId: 'microsoft-365', name: 'Microsoft 365', category: 'productivity', description: 'Outlook, OneDrive, Teams' },
    ],
    kpiTemplates: [
      { id: 'core-kpi:monthly-recurring-revenue', label: 'Monthly Recurring Revenue', unit: 'USD', aggregation: 'SUM', dataSourceEntityType: 'DEPARTMENT', description: 'MRR aggregated over the period.' },
      { id: 'core-kpi:active-projects', label: 'Active Projects', unit: 'count', aggregation: 'COUNT', dataSourceEntityType: 'PROJECT', description: 'Number of projects in ACTIVE state.' },
    ],
    workflowTemplates: [
      { slug: 'employee-onboarding', name: 'Employee Onboarding', description: 'Welcome email + IT account + first-week checklist.', trigger: 'user.created' },
      { slug: 'budget-approval', name: 'Budget Approval', description: 'Approval flow for expenses over $5k.', trigger: 'expense.submitted' },
      { slug: 'project-initiation', name: 'Project Initiation', description: 'Create project + assign team + kickoff meeting.', trigger: 'project.created' },
    ],
    previewMissionFeed: [
      {
        category: 'PACK_INSTALLED',
        priority: 'MEDIUM',
        title: 'Corporate Services pack installed',
        description:
          'After install, you\'ll see 9 departments, 2 AI actions, 2 knowledge entries, and 5 workflows ready to use.',
        actionPayload: { kind: 'pack_installed', packSlug: 'corporate-services' },
      },
    ],
    themingImpact: {
      accentColor: '#475569',
      rationale: 'Neutral slate palette suited for cross-industry corporate environments.',
    },
  },
};

function buildVerticalPack(slug, name, color, icon, blurb, entitySubtypes, aiActions, kpis, integrations, knowledge) {
  return {
    slug,
    name,
    version: '1.0.0',
    category: 'VERTICAL',
    description: blurb,
    shortDescription: blurb.split('.')[0] + '.',
    icon,
    color,
    tierRequired: 'PRO',
    status: 'beta',
    ownerKind: 'SEED',
    requiresPacks: ['corporate-services'],
    conflictsWith: [],
    tags: ['vertical', slug],
    monthlyPriceUsd: 199,
    estimatedAiCredits: 5000,
    sortOrder: 100,
    extensions: {
      entitySubtypes,
      aiActionExtensions: aiActions,
      kpiTemplates: kpis,
      integrationDefinitions: integrations,
      knowledgePacks: knowledge,
      previewMissionFeed: [
        {
          category: 'PACK_INSTALLED',
          priority: 'MEDIUM',
          title: `${name} pack installed`,
          description: `After install, you'll see ${entitySubtypes.length} entity subtypes, ${aiActions.length} AI actions, and ${knowledge.length} knowledge entries ready.`,
          actionPayload: { kind: 'pack_installed', packSlug: slug },
        },
      ],
      themingImpact: {
        accentColor: color,
        rationale: `${name} brand color drives workspace accents.`,
      },
    },
  };
}

const RETAIL = buildVerticalPack(
  'retail',
  'Retail',
  '#22c55e',
  'shopping-cart',
  'Store operations, e-commerce, inventory, visual merchandising, and loss prevention. Adds retail-store + shopper entity subtypes, 12 retail-specific AI actions, and Shopify + Square integrations.',
  [
    { baseType: 'FACILITY', subtype: 'retail-store', label: 'Retail Store', icon: 'shopping-bag', color: '#22c55e' },
    { baseType: 'CUSTOMER', subtype: 'shopper', label: 'Shopper', icon: 'user', color: '#16a34a' },
  ],
  [
    { id: 'retail:inventory-forecast', name: 'Inventory Forecast', description: '7-day SKU-level inventory forecast.', category: 'OPTIMIZATION', capability: 'insights', tags: ['inventory'], supportedEntities: ['FACILITY'], requiresStreaming: false, timeoutMs: 20000, tierRequired: 'PRO', tokensEstimate: 1200, surfaces: ['command_palette'] },
    { id: 'retail:visual-merch', name: 'Visual Merchandising Plan', description: 'Generate a visual merchandising plan.', category: 'EXECUTION', capability: 'automation', tags: ['merch'], supportedEntities: ['FACILITY'], requiresStreaming: true, timeoutMs: 25000, tierRequired: 'PRO', tokensEstimate: 1500, surfaces: ['command_palette'] },
  ],
  [
    { id: 'retail-kpi:sales-per-sqft', label: 'Sales per Sq Ft', unit: 'USD', aggregation: 'RATIO', dataSourceEntityType: 'FACILITY' },
    { id: 'retail-kpi:stockout-rate', label: 'Stockout Rate', unit: '%', aggregation: 'PERCENTAGE', dataSourceEntityType: 'FACILITY' },
  ],
  [
    { providerId: 'shopify', name: 'Shopify', category: 'ecommerce', description: 'Sync products, orders, customers' },
    { providerId: 'square', name: 'Square', category: 'payments', description: 'POS + payments' },
  ],
  [
    { title: 'Retail Loss Prevention Playbook', type: 'PLAYBOOK', content: 'Procedures for shrinkage detection, employee theft, and shoplifting response.', tags: ['shrinkage'], source: 'solution_pack:retail' },
  ],
);

const MANUFACTURING = buildVerticalPack(
  'manufacturing',
  'Manufacturing',
  '#f97316',
  'factory',
  'Production planning, quality control, supply chain, maintenance, and safety. Adds manufacturing-plant + production-line entity subtypes, 15 manufacturing-specific AI actions, and IoT sensor integrations.',
  [
    { baseType: 'FACILITY', subtype: 'manufacturing-plant', label: 'Manufacturing Plant', icon: 'factory', color: '#f97316' },
    { baseType: 'ASSET', subtype: 'production-line', label: 'Production Line', icon: 'settings', color: '#ea580c' },
  ],
  [
    { id: 'mfg:oee-report', name: 'OEE Report', description: 'Generate Overall Equipment Effectiveness report.', category: 'REPORTING', capability: 'insights', tags: ['oee'], supportedEntities: ['FACILITY'], requiresStreaming: false, timeoutMs: 15000, tierRequired: 'PRO', tokensEstimate: 1000, surfaces: ['command_palette'] },
    { id: 'mfg:predictive-maintenance', name: 'Predictive Maintenance', description: 'Predict failures 7-30 days in advance.', category: 'PREDICTIVE', capability: 'intelligence', tags: ['maintenance'], supportedEntities: ['ASSET'], requiresStreaming: true, timeoutMs: 30000, tierRequired: 'PRO', tokensEstimate: 2000, surfaces: ['command_palette'] },
  ],
  [
    { id: 'mfg-kpi:oee', label: 'Overall Equipment Effectiveness', unit: '%', aggregation: 'PERCENTAGE', dataSourceEntityType: 'FACILITY' },
    { id: 'mfg-kpi:first-pass-yield', label: 'First Pass Yield', unit: '%', aggregation: 'PERCENTAGE', dataSourceEntityType: 'ASSET' },
  ],
  [
    { providerId: 'mqtt-broker', name: 'MQTT Broker', category: 'iot', description: 'MQTT-based IoT sensor data' },
  ],
  [
    { title: 'OSHA Standard 1910.132 (PPE)', type: 'REGULATION', content: 'General requirements for personal protective equipment.', tags: ['safety', 'osha'], source: 'solution_pack:manufacturing' },
  ],
);

const HEALTHCARE = buildVerticalPack(
  'healthcare',
  'Healthcare',
  '#14b8a6',
  'heart-pulse',
  'Patient services, clinical operations, revenue cycle, compliance, and care coordination. Adds hospital + patient entity subtypes, 20 healthcare-specific AI actions, and Epic + HL7 integrations.',
  [
    { baseType: 'FACILITY', subtype: 'hospital', label: 'Hospital', icon: 'hospital', color: '#14b8a6' },
    { baseType: 'CUSTOMER', subtype: 'patient', label: 'Patient', icon: 'user', color: '#0d9488' },
  ],
  [
    { id: 'hc:readmission-risk', name: 'Readmission Risk', description: 'Predict 30-day readmission risk.', category: 'PREDICTIVE', capability: 'intelligence', tags: ['risk'], supportedEntities: ['CUSTOMER'], requiresStreaming: false, timeoutMs: 20000, tierRequired: 'PRO', tokensEstimate: 1500, surfaces: ['command_palette'] },
    { id: 'hc:care-plan', name: 'Care Plan Generator', description: 'Generate a draft care plan from the patient record.', category: 'EXECUTION', capability: 'automation', tags: ['care-plan'], supportedEntities: ['CUSTOMER'], requiresStreaming: true, timeoutMs: 25000, tierRequired: 'PRO', tokensEstimate: 1800, surfaces: ['command_palette'] },
  ],
  [
    { id: 'hc-kpi:length-of-stay', label: 'Length of Stay', unit: 'days', aggregation: 'AVG', dataSourceEntityType: 'CUSTOMER' },
    { id: 'hc-kpi:readmission-rate', label: '30-Day Readmission Rate', unit: '%', aggregation: 'PERCENTAGE', dataSourceEntityType: 'CUSTOMER' },
  ],
  [
    { providerId: 'epic', name: 'Epic', category: 'ehr', description: 'Epic EHR integration' },
    { providerId: 'hl7', name: 'HL7', category: 'health-data', description: 'HL7 v2 messaging' },
  ],
  [
    { title: 'HIPAA Privacy Rule Summary', type: 'REGULATION', content: 'Protected Health Information, Minimum Necessary Standard, and patient rights.', tags: ['hipaa', 'privacy'], source: 'solution_pack:healthcare' },
  ],
);

const LOGISTICS = buildVerticalPack(
  'logistics',
  'Logistics',
  '#0ea5e9',
  'truck',
  'Warehouse operations, fleet management, route optimization, and supply chain. Adds warehouse + vehicle entity subtypes, 12 logistics-specific AI actions, and telematics integrations.',
  [
    { baseType: 'FACILITY', subtype: 'warehouse', label: 'Warehouse', icon: 'warehouse', color: '#0ea5e9' },
    { baseType: 'ASSET', subtype: 'vehicle', label: 'Vehicle', icon: 'truck', color: '#0284c7' },
  ],
  [
    { id: 'log:route-optimize', name: 'Route Optimization', description: 'Multi-stop route optimization for a vehicle.', category: 'OPTIMIZATION', capability: 'operations', tags: ['routing'], supportedEntities: ['ASSET'], requiresStreaming: false, timeoutMs: 30000, tierRequired: 'PRO', tokensEstimate: 2000, surfaces: ['command_palette'] },
    { id: 'log:warehouse-throughput', name: 'Warehouse Throughput', description: 'Compute daily throughput per warehouse.', category: 'ANALYSIS', capability: 'insights', tags: ['throughput'], supportedEntities: ['FACILITY'], requiresStreaming: false, timeoutMs: 15000, tierRequired: 'PRO', tokensEstimate: 1000, surfaces: ['command_palette'] },
  ],
  [
    { id: 'log-kpi:on-time-delivery', label: 'On-Time Delivery', unit: '%', aggregation: 'PERCENTAGE', dataSourceEntityType: 'ASSET' },
    { id: 'log-kpi:fuel-efficiency', label: 'Fuel Efficiency', unit: 'MPG', aggregation: 'AVG', dataSourceEntityType: 'ASSET' },
  ],
  [
    { providerId: 'geotab', name: 'Geotab', category: 'telematics', description: 'Vehicle telematics + GPS' },
  ],
  [
    { title: 'DOT Hours-of-Service Rules', type: 'REGULATION', content: 'Federal Motor Carrier Safety Administration hours-of-service limits.', tags: ['dot', 'safety'], source: 'solution_pack:logistics' },
  ],
);

const PUBLIC_HEALTH = buildVerticalPack(
  'public-health',
  'Public Health',
  '#ef4444',
  'shield-plus',
  'Population health, disease surveillance, immunization programs, and reporting. Adds public-health-clinic + population entity subtypes, 24 public-health-specific AI actions, and CDC + WHO integrations.',
  [
    { baseType: 'FACILITY', subtype: 'public-health-clinic', label: 'Public Health Clinic', icon: 'shield-plus', color: '#ef4444' },
    { baseType: 'CUSTOMER', subtype: 'population', label: 'Population Segment', icon: 'users', color: '#dc2626' },
  ],
  [
    { id: 'ph:disease-surveillance', name: 'Disease Surveillance', description: 'Detect outbreak signals from reported cases.', category: 'PREDICTIVE', capability: 'intelligence', tags: ['surveillance'], supportedEntities: ['FACILITY'], requiresStreaming: true, timeoutMs: 30000, tierRequired: 'ENTERPRISE', tokensEstimate: 2200, surfaces: ['command_palette'] },
    { id: 'ph:immunization-coverage', name: 'Immunization Coverage', description: 'Coverage analysis per population segment.', category: 'ANALYSIS', capability: 'insights', tags: ['immunization'], supportedEntities: ['CUSTOMER'], requiresStreaming: false, timeoutMs: 15000, tierRequired: 'ENTERPRISE', tokensEstimate: 1200, surfaces: ['command_palette'] },
  ],
  [
    { id: 'ph-kpi:vaccination-coverage', label: 'Vaccination Coverage', unit: '%', aggregation: 'PERCENTAGE', dataSourceEntityType: 'CUSTOMER' },
    { id: 'ph-kpi:outbreak-signals', label: 'Outbreak Signals', unit: 'count', aggregation: 'COUNT', dataSourceEntityType: 'FACILITY' },
  ],
  [
    { providerId: 'cdc-phin', name: 'CDC PHIN', category: 'public-health-data', description: 'CDC Public Health Information Network' },
  ],
  [
    { title: 'WHO Outbreak Reporting Standard', type: 'REGULATION', content: 'International Health Regulations (IHR) reporting requirements.', tags: ['who', 'ihr'], source: 'solution_pack:public-health' },
  ],
);

async function main() {
  const prisma = new PrismaClient();
  console.log('Seeding Phase 7 — Solution Packs');

  try {
    await upsertPack(prisma, CORPORATE_SERVICES);
    await upsertPack(prisma, RETAIL);
    await upsertPack(prisma, MANUFACTURING);
    await upsertPack(prisma, HEALTHCARE);
    await upsertPack(prisma, LOGISTICS);
    await upsertPack(prisma, PUBLIC_HEALTH);

    const total = await prisma.solutionPack.count();
    console.log(`Phase 7 seed complete. solution_packs rows: ${total}`);
  } catch (err) {
    console.error('Phase 7 seed failed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();