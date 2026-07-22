/**
 * Industry Integration Presets
 *
 * Stage 2 Phase 2C: Per-industry connector/integration recommendations.
 *
 * Each industry defines a list of recommended integrations to help
 * tenants discover and connect the right tools. The Marketplace page
 * filters and sorts by industry relevance.
 *
 * SOLID:
 * - OCP: New industry = add entry to this registry. Zero code changes.
 * - ISP: IntegrationPresetDef is a focused type.
 */

export interface IntegrationPresetDef {
  slug: string;
  name: string;
  type: string;
  description?: string;
  tier: 'basic' | 'business' | 'professional' | 'enterprise';
  setupGuide?: {
    authType: string;
    docs: string;
  };
  category?: string;
  icon?: string;
}

export const INDUSTRY_INTEGRATION_PRESETS: Record<
  string,
  IntegrationPresetDef[]
> = {
  // ─── Financial & Compliance ────────────────────────────────────────────
  'financial-services': [
    {
      slug: 'quickbooks',
      name: 'QuickBooks',
      type: 'accounting',
      tier: 'business',
      description: 'Sync invoices, expenses, and client data with QuickBooks',
      setupGuide: { authType: 'oauth2', docs: '/docs/integrations/quickbooks' },
      category: 'Finance',
    },
    {
      slug: 'xero',
      name: 'Xero',
      type: 'accounting',
      tier: 'professional',
      description: 'Cloud-based accounting for financial firms',
      setupGuide: { authType: 'oauth2', docs: '/docs/integrations/xero' },
      category: 'Finance',
    },
    {
      slug: 'sage',
      name: 'Sage',
      type: 'accounting',
      tier: 'enterprise',
      description: 'Enterprise accounting and financial management',
      category: 'Finance',
    },
    {
      slug: 'salesforce',
      name: 'Salesforce CRM',
      type: 'crm',
      tier: 'professional',
      description: 'Customer relationship management for financial advisors',
      setupGuide: { authType: 'oauth2', docs: '/docs/integrations/salesforce' },
      category: 'CRM',
    },
    {
      slug: 'stripe',
      name: 'Stripe',
      type: 'payments',
      tier: 'business',
      description: 'Payment processing for client billing',
      setupGuide: { authType: 'api-key', docs: '/docs/integrations/stripe' },
      category: 'Payments',
    },
    {
      slug: 'plaid',
      name: 'Plaid',
      type: 'banking',
      tier: 'professional',
      description: 'Bank account linking and financial data aggregation',
      setupGuide: { authType: 'oauth2', docs: '/docs/integrations/plaid' },
      category: 'Banking',
    },
  ],

  'accounting-audit-services': [
    {
      slug: 'quickbooks',
      name: 'QuickBooks',
      type: 'accounting',
      tier: 'business',
      description: 'Sync invoices, expenses, and client data',
      category: 'Finance',
    },
    {
      slug: 'xero',
      name: 'Xero',
      type: 'accounting',
      tier: 'professional',
      description: 'Cloud-based accounting platform',
      category: 'Finance',
    },
    {
      slug: 'thomson-reuters',
      name: 'Thomson Reuters',
      type: 'tax',
      tier: 'professional',
      description: 'Tax research, compliance, and filing automation',
      category: 'Tax & Legal',
    },
    {
      slug: 'wolters-kluwer',
      name: 'Wolters Kluwer',
      type: 'tax',
      tier: 'enterprise',
      description: 'Tax and accounting research and workflow tools',
      category: 'Tax & Legal',
    },
    {
      slug: 'caseware',
      name: 'CaseWare',
      type: 'audit',
      tier: 'professional',
      description: 'Audit engagement and working paper management',
      category: 'Audit',
    },
    {
      slug: 'drake',
      name: 'Drake Tax',
      type: 'tax',
      tier: 'business',
      description: 'Professional tax preparation software',
      category: 'Tax & Legal',
    },
  ],

  insurance: [
    {
      slug: 'salesforce',
      name: 'Salesforce Financial Cloud',
      type: 'crm',
      tier: 'professional',
      description: 'Insurance CRM and policy management',
      category: 'CRM',
    },
    {
      slug: 'applied-epic',
      name: 'Applied Epic',
      type: 'insurance',
      tier: 'enterprise',
      description: 'Insurance agency management system',
      category: 'Insurance',
    },
    {
      slug: 'duck-creek',
      name: 'Duck Creek',
      type: 'insurance',
      tier: 'enterprise',
      description: 'P&C insurance core system',
      category: 'Insurance',
    },
    {
      slug: 'stripe',
      name: 'Stripe',
      type: 'payments',
      tier: 'business',
      description: 'Premium collection and payment processing',
      category: 'Payments',
    },
  ],

  // ─── Technology & Digital Services ─────────────────────────────────────
  'technology-digital-services': [
    {
      slug: 'jira',
      name: 'Jira',
      type: 'dev',
      tier: 'business',
      description: 'Issue tracking and agile project management',
      setupGuide: { authType: 'oauth2', docs: '/docs/integrations/jira' },
      category: 'Development',
    },
    {
      slug: 'github',
      name: 'GitHub',
      type: 'dev',
      tier: 'business',
      description: 'Code hosting, version control, and CI/CD',
      setupGuide: { authType: 'oauth2', docs: '/docs/integrations/github' },
      category: 'Development',
    },
    {
      slug: 'gitlab',
      name: 'GitLab',
      type: 'dev',
      tier: 'business',
      description: 'Complete DevOps platform',
      category: 'Development',
    },
    {
      slug: 'slack',
      name: 'Slack',
      type: 'comms',
      tier: 'basic',
      description: 'Team communication and real-time messaging',
      setupGuide: { authType: 'oauth2', docs: '/docs/integrations/slack' },
      category: 'Communication',
    },
    {
      slug: 'datadog',
      name: 'Datadog',
      type: 'monitoring',
      tier: 'professional',
      description: 'Infrastructure and application monitoring',
      category: 'Operations',
    },
    {
      slug: 'sentry',
      name: 'Sentry',
      type: 'monitoring',
      tier: 'business',
      description: 'Error tracking and performance monitoring',
      category: 'Operations',
    },
    {
      slug: 'linear',
      name: 'Linear',
      type: 'dev',
      tier: 'business',
      description: 'Modern issue tracking for software teams',
      category: 'Development',
    },
    {
      slug: 'figma',
      name: 'Figma',
      type: 'design',
      tier: 'business',
      description: 'Collaborative design and prototyping',
      category: 'Design',
    },
  ],

  'professional-business-services': [
    {
      slug: 'salesforce',
      name: 'Salesforce',
      type: 'crm',
      tier: 'professional',
      description: 'Client relationship and pipeline management',
      setupGuide: { authType: 'oauth2', docs: '/docs/integrations/salesforce' },
      category: 'CRM',
    },
    {
      slug: 'hubspot',
      name: 'HubSpot',
      type: 'crm',
      tier: 'business',
      description: 'Marketing, sales, and service CRM',
      setupGuide: { authType: 'oauth2', docs: '/docs/integrations/hubspot' },
      category: 'CRM',
    },
    {
      slug: 'quickbooks',
      name: 'QuickBooks',
      type: 'accounting',
      tier: 'business',
      description: 'Billing, invoicing, and expense tracking',
      category: 'Finance',
    },
    {
      slug: 'slack',
      name: 'Slack',
      type: 'comms',
      tier: 'basic',
      description: 'Team communication',
      category: 'Communication',
    },
    {
      slug: 'microsoft-365',
      name: 'Microsoft 365',
      type: 'collaboration',
      tier: 'business',
      description: 'Email, documents, and calendar integration',
      category: 'Collaboration',
    },
    {
      slug: 'asana',
      name: 'Asana',
      type: 'pm',
      tier: 'business',
      description: 'Project and task management',
      category: 'Project Management',
    },
  ],

  // ─── Retail & Commerce ─────────────────────────────────────────────────
  'retail-commerce-consumer': [
    {
      slug: 'shopify',
      name: 'Shopify',
      type: 'ecommerce',
      tier: 'business',
      description: 'E-commerce platform for online stores',
      setupGuide: { authType: 'oauth2', docs: '/docs/integrations/shopify' },
      category: 'E-Commerce',
    },
    {
      slug: 'square',
      name: 'Square',
      type: 'pos',
      tier: 'business',
      description: 'Point-of-sale and payment processing',
      setupGuide: { authType: 'oauth2', docs: '/docs/integrations/square' },
      category: 'Payments',
    },
    {
      slug: 'stripe',
      name: 'Stripe',
      type: 'payments',
      tier: 'business',
      description: 'Online payment processing',
      category: 'Payments',
    },
    {
      slug: 'klaviyo',
      name: 'Klaviyo',
      type: 'marketing',
      tier: 'professional',
      description: 'Email and SMS marketing automation',
      category: 'Marketing',
    },
    {
      slug: 'mailchimp',
      name: 'Mailchimp',
      type: 'marketing',
      tier: 'business',
      description: 'Email marketing and customer engagement',
      category: 'Marketing',
    },
    {
      slug: 'zendesk',
      name: 'Zendesk',
      type: 'support',
      tier: 'business',
      description: 'Customer service and support ticketing',
      category: 'Support',
    },
    {
      slug: 'snowflake',
      name: 'Snowflake',
      type: 'analytics',
      tier: 'professional',
      description: 'Data warehouse for retail analytics',
      category: 'Analytics',
    },
  ],

  'media-communications-creative': [
    {
      slug: 'adobe-cc',
      name: 'Adobe Creative Cloud',
      type: 'creative',
      tier: 'professional',
      description: 'Creative suite for design, video, and media production',
      category: 'Creative',
    },
    {
      slug: 'figma',
      name: 'Figma',
      type: 'design',
      tier: 'business',
      description: 'Collaborative design platform',
      category: 'Design',
    },
    {
      slug: 'hubspot',
      name: 'HubSpot',
      type: 'marketing',
      tier: 'business',
      description: 'Marketing campaigns and lead management',
      category: 'Marketing',
    },
    {
      slug: 'hootsuite',
      name: 'Hootsuite',
      type: 'social',
      tier: 'business',
      description: 'Social media scheduling and analytics',
      category: 'Social Media',
    },
    {
      slug: 'mailchimp',
      name: 'Mailchimp',
      type: 'marketing',
      tier: 'business',
      description: 'Email marketing campaigns',
      category: 'Marketing',
    },
    {
      slug: 'stripe',
      name: 'Stripe',
      type: 'payments',
      tier: 'business',
      description: 'Client billing and subscription management',
      category: 'Payments',
    },
  ],

  // ─── Healthcare & Life Sciences ────────────────────────────────────────
  'healthcare-life-sciences': [
    {
      slug: 'epic',
      name: 'Epic EHR',
      type: 'ehr',
      tier: 'professional',
      description: 'Electronic health records and clinical workflows',
      setupGuide: { authType: 'hl7', docs: '/docs/integrations/epic' },
      category: 'EHR/Clinical',
    },
    {
      slug: 'cerner',
      name: 'Cerner',
      type: 'ehr',
      tier: 'professional',
      description: 'Health information technology and EHR',
      category: 'EHR/Clinical',
    },
    {
      slug: 'labcorp',
      name: 'LabCorp',
      type: 'lab',
      tier: 'professional',
      description: 'Laboratory testing and diagnostic services',
      setupGuide: { authType: 'api-key', docs: '/docs/integrations/labcorp' },
      category: 'Lab/Diagnostics',
    },
    {
      slug: 'twilio',
      name: 'Twilio',
      type: 'comms',
      tier: 'business',
      description: 'SMS appointment reminders and patient communication',
      category: 'Communication',
    },
    {
      slug: 'salesforce-health',
      name: 'Salesforce Health Cloud',
      type: 'crm',
      tier: 'professional',
      description: 'Patient relationship management',
      category: 'CRM',
    },
    {
      slug: 'athenahealth',
      name: 'athenahealth',
      type: 'ehr',
      tier: 'professional',
      description: 'Cloud-based EHR and practice management',
      category: 'EHR/Clinical',
    },
  ],

  // ─── Industrial & Infrastructure ────────────────────────────────────────
  'manufacturing-industrial': [
    {
      slug: 'sap',
      name: 'SAP',
      type: 'erp',
      tier: 'enterprise',
      description: 'Enterprise resource planning for manufacturing',
      setupGuide: { authType: 'api-key', docs: '/docs/integrations/sap' },
      category: 'ERP',
    },
    {
      slug: 'oracle-erp',
      name: 'Oracle ERP',
      type: 'erp',
      tier: 'enterprise',
      description: 'Manufacturing and supply chain management',
      category: 'ERP',
    },
    {
      slug: 'siemens-mindsphere',
      name: 'Siemens MindSphere',
      type: 'iot',
      tier: 'enterprise',
      description: 'Industrial IoT platform for manufacturing data',
      category: 'IoT & SCADA',
    },
    {
      slug: 'maintenance-connection',
      name: 'Maintenance Connection',
      type: 'cmm',
      tier: 'professional',
      description: 'Computerized maintenance management',
      category: 'Maintenance',
    },
    {
      slug: 'tableau',
      name: 'Tableau',
      type: 'analytics',
      tier: 'professional',
      description: 'Production analytics and quality dashboards',
      category: 'Analytics',
    },
  ],

  'construction-engineering-infrastructure': [
    {
      slug: 'procore',
      name: 'Procore',
      type: 'construction',
      tier: 'professional',
      description: 'Construction project management platform',
      setupGuide: { authType: 'oauth2', docs: '/docs/integrations/procore' },
      category: 'Construction',
    },
    {
      slug: 'autodesk',
      name: 'Autodesk BIM 360',
      type: 'construction',
      tier: 'professional',
      description: 'Building information modeling and field management',
      category: 'Construction',
    },
    {
      slug: 'sage-300',
      name: 'Sage 300 CRE',
      type: 'accounting',
      tier: 'professional',
      description: 'Construction real estate accounting',
      category: 'Finance',
    },
    {
      slug: 'plan-grid',
      name: 'PlanGrid',
      type: 'construction',
      tier: 'business',
      description: 'Construction document management and collaboration',
      category: 'Construction',
    },
  ],

  'energy-utilities-natural-resources': [
    {
      slug: 'ossoft',
      name: 'OSIsoft PI',
      type: 'scada',
      tier: 'enterprise',
      description: 'Real-time operational data infrastructure',
      category: 'IoT & SCADA',
    },
    {
      slug: 'ge-digital',
      name: 'GE Digital',
      type: 'industrial',
      tier: 'enterprise',
      description: 'Power generation and grid management',
      category: 'Operations',
    },
    {
      slug: 'aspentech',
      name: 'AspenTech',
      type: 'industrial',
      tier: 'enterprise',
      description: 'Process optimization for energy and chemicals',
      category: 'Operations',
    },
    {
      slug: 'salesforce',
      name: 'Salesforce',
      type: 'crm',
      tier: 'professional',
      description: 'Customer relationship and billing management',
      category: 'CRM',
    },
  ],

  'logistics-transportation-supply-chain': [
    {
      slug: 'oracle-tms',
      name: 'Oracle TMS',
      type: 'logistics',
      tier: 'enterprise',
      description: 'Transportation and logistics management',
      category: 'Logistics',
    },
    {
      slug: 'project44',
      name: 'project44',
      type: 'logistics',
      tier: 'professional',
      description: 'Real-time shipment visibility',
      category: 'Logistics',
    },
    {
      slug: 'samsara',
      name: 'Samsara',
      type: 'fleet',
      tier: 'business',
      description: 'Fleet tracking and driver safety',
      setupGuide: { authType: 'api-key', docs: '/docs/integrations/samsara' },
      category: 'Fleet',
    },
    {
      slug: 'quickbooks',
      name: 'QuickBooks',
      type: 'accounting',
      tier: 'business',
      description: 'Freight billing and expense management',
      category: 'Finance',
    },
    {
      slug: 'salesforce',
      name: 'Salesforce',
      type: 'crm',
      tier: 'professional',
      description: 'Customer and carrier relationship management',
      category: 'CRM',
    },
  ],

  // ─── Public & Social ───────────────────────────────────────────────────
  'government-public-sector': [
    {
      slug: 'microsoft-365',
      name: 'Microsoft 365 GCC',
      type: 'collaboration',
      tier: 'enterprise',
      description: 'Government Community Cloud collaboration suite',
      category: 'Collaboration',
    },
    {
      slug: 'salesforce-gov',
      name: 'Salesforce Government Cloud',
      type: 'crm',
      tier: 'enterprise',
      description: 'CRM for government agencies',
      category: 'CRM',
    },
    {
      slug: 'servicenow',
      name: 'ServiceNow',
      type: 'itsm',
      tier: 'enterprise',
      description: 'IT service management for public sector',
      category: 'ITSM',
    },
    {
      slug: 'esri',
      name: 'Esri ArcGIS',
      type: 'gis',
      tier: 'enterprise',
      description: 'Geographic information systems and mapping',
      category: 'GIS/Mapping',
    },
  ],

  'education-research': [
    {
      slug: 'canvas',
      name: 'Canvas LMS',
      type: 'lms',
      tier: 'professional',
      description: 'Learning management system',
      category: 'Education',
    },
    {
      slug: 'blackboard',
      name: 'Blackboard',
      type: 'lms',
      tier: 'professional',
      description: 'Educational technology and learning platform',
      category: 'Education',
    },
    {
      slug: 'microsoft-365',
      name: 'Microsoft 365 Education',
      type: 'collaboration',
      tier: 'business',
      description: 'Collaboration and productivity for education',
      category: 'Collaboration',
    },
    {
      slug: 'salesforce-edu',
      name: 'Salesforce Education Cloud',
      type: 'crm',
      tier: 'professional',
      description: 'Student lifecycle and enrollment management',
      category: 'CRM',
    },
    {
      slug: 'tableau',
      name: 'Tableau',
      type: 'analytics',
      tier: 'professional',
      description: 'Research data visualization and analytics',
      category: 'Analytics',
    },
  ],

  'nonprofit-international': [
    {
      slug: 'salesforce-npsp',
      name: 'Salesforce NPSP',
      type: 'crm',
      tier: 'professional',
      description: 'Nonprofit Success Pack — donor and program management',
      setupGuide: {
        authType: 'oauth2',
        docs: '/docs/integrations/salesforce-npsp',
      },
      category: 'CRM',
    },
    {
      slug: 'mailchimp',
      name: 'Mailchimp',
      type: 'marketing',
      tier: 'business',
      description: 'Donor communication and newsletter campaigns',
      category: 'Marketing',
    },
    {
      slug: 'stripe',
      name: 'Stripe',
      type: 'payments',
      tier: 'business',
      description: 'Online donation processing',
      category: 'Payments',
    },
    {
      slug: 'quickbooks-np',
      name: 'QuickBooks Nonprofit',
      type: 'accounting',
      tier: 'business',
      description: 'Nonprofit accounting and grant tracking',
      category: 'Finance',
    },
    {
      slug: 'microsoft-365',
      name: 'Microsoft 365',
      type: 'collaboration',
      tier: 'business',
      description: 'Team collaboration and document management',
      category: 'Collaboration',
    },
  ],

  // ─── Agriculture & Food ────────────────────────────────────────────────
  'agriculture-food-systems': [
    {
      slug: 'john-deere',
      name: 'John Deere Operations Center',
      type: 'agtech',
      tier: 'professional',
      description: 'Farm equipment telemetry and field data',
      category: 'AgTech',
    },
    {
      slug: 'climate-fieldview',
      name: 'Climate FieldView',
      type: 'agtech',
      tier: 'professional',
      description: 'Digital farming and field analytics platform',
      category: 'AgTech',
    },
    {
      slug: 'granular',
      name: 'Granular',
      type: 'agtech',
      tier: 'professional',
      description: 'Farm management software and analytics',
      category: 'AgTech',
    },
    {
      slug: 'quickbooks',
      name: 'QuickBooks',
      type: 'accounting',
      tier: 'business',
      description: 'Farm accounting and expense management',
      category: 'Finance',
    },
    {
      slug: 'tableau',
      name: 'Tableau',
      type: 'analytics',
      tier: 'professional',
      description: 'Crop yield and market price analytics',
      category: 'Analytics',
    },
  ],

  // ─── Other ──────────────────────────────────────────────────────────────
  'special-purpose-organizations': [
    {
      slug: 'microsoft-365',
      name: 'Microsoft 365',
      type: 'collaboration',
      tier: 'business',
      description: 'Email, documents, and calendar for portfolio management',
      category: 'Collaboration',
    },
    {
      slug: 'quickbooks',
      name: 'QuickBooks',
      type: 'accounting',
      tier: 'business',
      description: 'Multi-entity accounting and financial consolidation',
      category: 'Finance',
    },
    {
      slug: 'salesforce',
      name: 'Salesforce',
      type: 'crm',
      tier: 'professional',
      description: 'Relationship management for investments and holdings',
      category: 'CRM',
    },
    {
      slug: 'stripe',
      name: 'Stripe',
      type: 'payments',
      tier: 'business',
      description: 'Payment processing and treasury management',
      category: 'Payments',
    },
  ],
};

export function getIntegrationPresets(
  industrySlug: string,
): IntegrationPresetDef[] {
  return INDUSTRY_INTEGRATION_PRESETS[industrySlug] ?? [];
}

export function getIntegrationPresetsSorted(
  industrySlug: string,
  tier?: string,
): IntegrationPresetDef[] {
  const presets = getIntegrationPresets(industrySlug);

  if (!tier) return presets;

  const tierRank: Record<string, number> = {
    basic: 0,
    business: 1,
    professional: 2,
    enterprise: 3,
  };

  return [...presets].sort((a, b) => {
    const aMatch = a.tier === tier ? -1 : 0;
    const bMatch = b.tier === tier ? -1 : 0;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return (tierRank[a.tier] ?? 0) - (tierRank[b.tier] ?? 0);
  });
}

export function getAllIndustrySlugsWithPresets(): string[] {
  return Object.keys(INDUSTRY_INTEGRATION_PRESETS);
}
