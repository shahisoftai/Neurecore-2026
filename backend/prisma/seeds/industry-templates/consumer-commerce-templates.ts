import { TemplateType } from '@prisma/client';

export interface SeedTemplate {
  templateType: TemplateType;
  slug: string;
  name: string;
  description?: string;
  industrySlug: string;
  config: Record<string, unknown>;
}

export const CONSUMER_COMMERCE_TEMPLATES: SeedTemplate[] = [
  // ═══ RETAIL / COMMERCE / CONSUMER ═══
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'retail-customer-lifecycle',
    name: 'Retail Customer Lifecycle',
    description: 'Customer lifecycle for retail: first-time buyer → repeat → VIP/loyalty → churn → win-back',
    industrySlug: 'retail-commerce-consumer',
    config: {
      stages: [
        { key: 'first-time-buyer', label: 'First-time Buyer', order: 1 },
        { key: 'repeat-customer', label: 'Repeat Customer', order: 2 },
        { key: 'vip-loyalty', label: 'VIP / Loyalty Member', order: 3 },
        { key: 'churn', label: 'Churn', order: 4 },
        { key: 'win-back', label: 'Win-back / Reactivation', order: 5 },
      ],
      defaultStage: 'first-time-buyer',
      customerFieldDefinitions: [
        { key: 'customerSegment', label: 'Segment', type: 'enum', options: ['Budget', 'Mid-Market', 'Premium', 'Luxury'] },
        { key: 'ltv', label: 'Lifetime Value', type: 'number' },
        { key: 'loyaltyTier', label: 'Loyalty Tier', type: 'enum', options: ['None', 'Silver', 'Gold', 'Platinum'] },
        { key: 'preferredChannel', label: 'Preferred Channel', type: 'enum', options: ['Online', 'In-Store', 'Mobile', 'Marketplace'] },
      ],
    },
  },
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'media-client-lifecycle',
    name: 'Media & Creative Client Lifecycle',
    description: 'Client lifecycle for media/creative: prospect → active client → long-term partnership → renewal → alumni',
    industrySlug: 'media-communications-creative',
    config: {
      stages: [
        { key: 'prospect', label: 'Prospect', order: 1 },
        { key: 'active-client', label: 'Active Client', order: 2 },
        { key: 'long-term-partnership', label: 'Long-term Partnership', order: 3 },
        { key: 'renewal', label: 'Renewal', order: 4 },
        { key: 'alumni', label: 'Alumni', order: 5 },
      ],
      defaultStage: 'prospect',
      customerFieldDefinitions: [
        { key: 'clientType', label: 'Client Type', type: 'enum', options: ['Brand', 'Agency', 'Publisher', 'Creator'] },
        { key: 'serviceLine', label: 'Service Line', type: 'enum', options: ['Content', 'Branding', 'Production', 'PR', 'Creative'] },
        { key: 'budgetTier', label: 'Budget Tier', type: 'enum', options: ['Small', 'Medium', 'Large', 'Enterprise'] },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'merchandiser',
    name: 'Merchandiser',
    industrySlug: 'retail-commerce-consumer',
    config: {
      systemPrompt: 'You are a Merchandiser for a retail company.\nYour role: assortment planning, pricing strategy, promotional planning, inventory optimization.\nAnalyze sales trends. Plan seasonal assortments. Optimize markdowns. Coordinate with suppliers.',
      kpis: [
        { name: 'Gross margin', target: '> 40%' },
        { name: 'Inventory turnover', target: '> 4x per year' },
        { name: 'Sell-through rate', target: '> 80%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'marketing-manager',
    name: 'Marketing Manager',
    industrySlug: 'retail-commerce-consumer',
    config: {
      systemPrompt: 'You are a Marketing Manager for a retail company.\nYour role: campaign planning, audience targeting, budget management, performance optimization.\nExecute multi-channel campaigns. Track ROI. Optimize spend. Grow customer base.',
      kpis: [
        { name: 'Campaign ROI', target: '> 3x' },
        { name: 'Customer acquisition cost', target: '< benchmark' },
        { name: 'Conversion rate', target: '> 3%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'operations-manager',
    name: 'Operations Manager',
    industrySlug: 'retail-commerce-consumer',
    config: {
      systemPrompt: 'You are an Operations Manager for a retail company.\nYour role: inventory management, staffing, scheduling, cash management.\nEnsure store efficiency. Monitor stock levels. Optimize labor allocation. Maintain operational standards.',
      kpis: [
        { name: 'Stockout rate', target: '< 2%' },
        { name: 'Labor efficiency', target: '> 85%' },
        { name: 'Shrinkage rate', target: '< 1%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'customer-service-rep',
    name: 'Customer Service Representative',
    industrySlug: 'retail-commerce-consumer',
    config: {
      systemPrompt: 'You are a Customer Service Representative for a retail company.\nYour role: issue resolution, feedback collection, retention efforts, product knowledge.\nResolve inquiries promptly. Collect and escalate feedback. Drive customer satisfaction.',
      kpis: [
        { name: 'First contact resolution', target: '> 75%' },
        { name: 'Customer satisfaction', target: '> 4.5/5' },
        { name: 'Response time', target: '< 1 hour' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'analytics-manager',
    name: 'Analytics Manager',
    industrySlug: 'retail-commerce-consumer',
    config: {
      systemPrompt: 'You are an Analytics Manager for a retail company.\nYour role: sales tracking, inventory analytics, customer insights, forecasting.\nBuild dashboards. Analyze trends. Provide data-driven recommendations. Forecast demand.',
      kpis: [
        { name: 'Forecast accuracy', target: '> 85%' },
        { name: 'Report turnaround', target: '< 24 hours' },
        { name: 'Insights actioned', target: '> 80%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'creative-director',
    name: 'Creative Director',
    industrySlug: 'media-communications-creative',
    config: {
      systemPrompt: 'You are a Creative Director for a media/creative agency.\nYour role: creative vision, art direction, quality assurance, team leadership.\nGuide creative strategy. Ensure creative excellence. Mentor creative teams. Present to clients.',
      kpis: [
        { name: 'Creative awards won', target: '> 2 per year' },
        { name: 'Client creative satisfaction', target: '> 4.5/5' },
        { name: 'Team retention', target: '> 90%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'content-producer',
    name: 'Content Producer',
    industrySlug: 'media-communications-creative',
    config: {
      systemPrompt: 'You are a Content Producer for a media/creative agency.\nYour role: content ideation, production coordination, publishing, quality control.\nManage content calendars. Coordinate production resources. Ensure on-brand delivery.',
      kpis: [
        { name: 'Content output', target: 'On schedule' },
        { name: 'Content engagement rate', target: '> 5%' },
        { name: 'Production budget adherence', target: '±5%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'copywriter',
    name: 'Copywriter',
    industrySlug: 'media-communications-creative',
    config: {
      systemPrompt: 'You are a Copywriter for a media/creative agency.\nYour role: messaging, storytelling, content creation, brand voice.\nCraft compelling copy. Adapt tone per brand. Meet deadlines. Collaborate with creative teams.',
      kpis: [
        { name: 'Copy approval rate', target: '> 90% first pass' },
        { name: 'Project deadlines met', target: '100%' },
        { name: 'Client revisions', target: '< 2 rounds' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'media-planner',
    name: 'Media Planner',
    industrySlug: 'media-communications-creative',
    config: {
      systemPrompt: 'You are a Media Planner for a media/creative agency.\nYour role: channel selection, audience targeting, budget allocation, performance optimization.\nPlan media strategies. Negotiate placements. Track performance. Optimize spend.',
      kpis: [
        { name: 'CPM efficiency', target: 'Below benchmark' },
        { name: 'Reach vs target', target: '> 95%' },
        { name: 'Budget utilization', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'project-manager-creative',
    name: 'Creative Project Manager',
    industrySlug: 'media-communications-creative',
    config: {
      systemPrompt: 'You are a Creative Project Manager for a media/creative agency.\nYour role: timeline management, budget tracking, approval workflow, delivery coordination.\nKeep projects on track. Manage stakeholder expectations. Coordinate reviews and approvals.',
      kpis: [
        { name: 'On-time delivery', target: '> 95%' },
        { name: 'Project margin', target: '> 25%' },
        { name: 'Client satisfaction', target: '> 4.5/5' },
      ],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-inventory-sync',
    name: 'Daily Inventory Level Sync',
    industrySlug: 'retail-commerce-consumer',
    config: {
      trigger: 'time: 6:00 AM daily',
      action: 'Sync inventory levels across all channels. Flag items below reorder point. Generate restock recommendations.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-sales-digest',
    name: 'Weekly Sales Performance Digest',
    industrySlug: 'retail-commerce-consumer',
    config: {
      trigger: 'time: Monday 8:00 AM',
      action: 'Generate weekly sales summary: revenue, units sold, top products, store performance, promo effectiveness.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'monthly-customer-ltv-update',
    name: 'Monthly Customer LTV Update',
    industrySlug: 'retail-commerce-consumer',
    config: {
      trigger: 'time: 1st of month 9:00 AM',
      action: 'Recalculate customer lifetime values. Update segments. Flag churn risk customers for retention campaigns.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-content-calendar-review',
    name: 'Daily Content Calendar Review',
    industrySlug: 'media-communications-creative',
    config: {
      trigger: 'time: 9:00 AM daily',
      action: 'Review today\'s content calendar. Confirm publish readiness. Flag any delays or blockers.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-campaign-performance',
    name: 'Weekly Campaign Performance Review',
    industrySlug: 'media-communications-creative',
    config: {
      trigger: 'time: Friday 3:00 PM',
      action: 'Review all active campaigns: engagement, reach, conversion, budget pacing. Flag underperforming campaigns.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'REPORT',
    slug: 'sales-performance-dashboard',
    name: 'Sales Performance Dashboard',
    industrySlug: 'retail-commerce-consumer',
    config: {
      metrics: ['totalRevenue', 'unitsSold', 'averageOrderValue', 'conversionRate', 'returnRate'],
      period: 'weekly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'inventory-health-report',
    name: 'Inventory Health Report',
    industrySlug: 'retail-commerce-consumer',
    config: {
      metrics: ['stockLevel', 'daysOfSupply', 'sellThroughRate', 'agedInventory', 'stockoutRate'],
      period: 'weekly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'customer-insights-report',
    name: 'Customer Insights & Segmentation Report',
    industrySlug: 'retail-commerce-consumer',
    config: {
      metrics: ['customerCount', 'ltv', 'repeatPurchaseRate', 'churnRate', 'nps'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'campaign-roi-dashboard',
    name: 'Campaign ROI Dashboard',
    industrySlug: 'media-communications-creative',
    config: {
      metrics: ['campaignSpend', 'impressions', 'engagement', 'conversions', 'roi'],
      period: 'weekly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'content-performance-report',
    name: 'Content Performance Report',
    industrySlug: 'media-communications-creative',
    config: {
      metrics: ['contentPublished', 'totalEngagement', 'shareRate', 'audienceGrowth', 'topPerformingContent'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'product-launch',
    name: 'Product Launch Campaign',
    industrySlug: 'retail-commerce-consumer',
    config: {
      description: 'Execute a new product launch: planning, marketing, inventory, and go-to-market',
      estimatedDuration: '4 weeks',
      assignToRole: 'marketing-manager',
      subtasks: [
        'Define product positioning and messaging',
        'Create marketing assets (images, copy, videos)',
        'Set up promotional pricing',
        'Coordinate inventory allocation',
        'Brief sales and customer service teams',
        'Launch across all channels',
        'Monitor first-week performance',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'seasonal-campaign',
    name: 'Seasonal Campaign Execution',
    industrySlug: 'retail-commerce-consumer',
    config: {
      description: 'Plan and execute a seasonal retail campaign (holiday, back-to-school, etc.)',
      estimatedDuration: '6 weeks',
      assignToRole: 'marketing-manager',
      subtasks: [
        'Define campaign theme and target audience',
        'Plan promotional calendar',
        'Coordinate with merchandising on seasonal assortment',
        'Brief creative team on campaign assets',
        'Set up multi-channel ads and emails',
        'Prepare stores for seasonal display',
        'Launch and monitor daily',
        'Post-campaign ROI analysis',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'inventory-audit',
    name: 'Inventory Audit & Reconciliation',
    industrySlug: 'retail-commerce-consumer',
    config: {
      description: 'Conduct physical inventory audit and reconcile with system records',
      estimatedDuration: '3 days',
      assignToRole: 'operations-manager',
      subtasks: [
        'Schedule physical count date',
        'Prepare count sheets and assign zones',
        'Conduct physical count',
        'Reconcile with system inventory',
        'Investigate discrepancies',
        'Update system records',
        'Report findings to finance',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'content-campaign-production',
    name: 'Content Campaign Production',
    industrySlug: 'media-communications-creative',
    config: {
      description: 'Produce a multi-channel content campaign: brief, creative, production, publishing',
      estimatedDuration: '3 weeks',
      assignToRole: 'content-producer',
      subtasks: [
        'Receive and clarify creative brief',
        'Develop content plan and calendar',
        'Assign writers and designers',
        'Create content drafts',
        'Internal review and revisions',
        'Client review and approval',
        'Schedule and publish across channels',
        'Monitor initial performance',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'brand-development',
    name: 'Brand Development Project',
    industrySlug: 'media-communications-creative',
    config: {
      description: 'Develop or refresh a brand: strategy, identity, guidelines, rollout',
      estimatedDuration: '8 weeks',
      assignToRole: 'creative-director',
      subtasks: [
        'Conduct brand audit and competitive research',
        'Define brand strategy and positioning',
        'Develop visual identity (logo, colors, typography)',
        'Create brand voice and messaging guidelines',
        'Design key collateral and templates',
        'Present to client for approval',
        'Create brand guidelines document',
        'Plan brand rollout strategy',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'pr-campaign',
    name: 'PR Campaign Execution',
    industrySlug: 'media-communications-creative',
    config: {
      description: 'Execute a PR campaign: media outreach, coverage tracking, crisis communications',
      estimatedDuration: '6 weeks',
      assignToRole: 'media-planner',
      subtasks: [
        'Define PR objectives and key messages',
        'Build media list and journalist contacts',
        'Draft press release and media kit',
        'Pitch to journalists and outlets',
        'Track coverage and sentiment',
        'Manage media inquiries',
        'Generate coverage report',
        'Assess campaign impact',
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'retail-dept-structure',
    name: 'Retail & Commerce Department Structure',
    industrySlug: 'retail-commerce-consumer',
    config: {
      departments: [
        { name: 'Merchandising', roles: ['Merchandiser', 'Buyer', 'Category Manager'] },
        { name: 'Marketing', roles: ['Marketing Manager', 'Digital Marketer', 'Content Creator'] },
        { name: 'Operations', roles: ['Operations Manager', 'Store Manager', 'Logistics Coordinator'] },
        { name: 'Customer Service', roles: ['Customer Service Rep', 'Returns Specialist'] },
        { name: 'Analytics', roles: ['Analytics Manager', 'Data Analyst'] },
        { name: 'Administration', roles: ['Office Manager', 'Executive Assistant'] },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'media-dept-structure',
    name: 'Media & Creative Department Structure',
    industrySlug: 'media-communications-creative',
    config: {
      departments: [
        { name: 'Creative', roles: ['Creative Director', 'Art Director', 'Copywriter', 'Designer'] },
        { name: 'Production', roles: ['Content Producer', 'Video Editor', 'Photographer'] },
        { name: 'Media', roles: ['Media Planner', 'Media Buyer', 'Analytics Specialist'] },
        { name: 'Client Services', roles: ['Account Manager', 'Project Manager'] },
        { name: 'Administration', roles: ['Office Manager', 'Executive Assistant'] },
      ],
    },
  },
];
