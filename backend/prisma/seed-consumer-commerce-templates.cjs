#!/usr/bin/env node
/**
 * seed-consumer-commerce-templates.cjs
 *
 * Stage 1 Phase 1A — Seeds system-level tenant templates (tenantId = null)
 * for the Retail & Commerce and Media & Communications industry groups.
 *
 * IDEMPOTENT: upsert keyed on (tenantId=null, slug, templateType).
 * Safe to run multiple times.
 *
 * Run: node prisma/seed-consumer-commerce-templates.cjs
 *
 * Flags:
 *   --check      Dry run; prints what would be seeded without writing.
 *   --verbose    Log every row.
 *
 * Reads DATABASE_URL from backend/.env.production (falls back to .env).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.production');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const TEMPLATES = [
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'retail-customer-lifecycle',
    name: 'Retail Customer Lifecycle',
    description: 'Standard customer lifecycle for retail: first-time buyer → repeat customer → VIP loyalty → churn → win-back',
    industrySlug: 'retail-commerce-consumer',
    config: {
      stages: [
        { key: 'first-time-buyer', label: 'First-Time Buyer', order: 1 },
        { key: 'repeat-customer', label: 'Repeat Customer', order: 2 },
        { key: 'vip-loyalty', label: 'VIP Loyalty', order: 3 },
        { key: 'churn', label: 'Churn', order: 4 },
        { key: 'win-back', label: 'Win-Back', order: 5 },
      ],
      defaultStage: 'first-time-buyer',
      customerFieldDefinitions: [
        { key: 'clientType', label: 'Client Type', type: 'enum', options: ['Startup', 'SME', 'Enterprise', 'Government'] },
        { key: 'ltv', label: 'LTV', type: 'number' },
        { key: 'loyaltyTier', label: 'Loyalty Tier', type: 'enum', options: ['None', 'Silver', 'Gold', 'Platinum'] },
        { key: 'preferredChannel', label: 'Preferred Channel', type: 'enum', options: ['Online', 'In-Store', 'Mobile', 'Marketplace'] },
      ],
    },
  },
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'media-client-lifecycle',
    name: 'Media Client Lifecycle',
    description: 'Standard client lifecycle for media/creative agencies: prospect → active client → long-term partnership → renewal → alumni',
    industrySlug: 'media-communications-creative',
    config: {
      stages: [
        { key: 'prospect', label: 'Prospect', order: 1 },
        { key: 'active-client', label: 'Active Client', order: 2 },
        { key: 'long-term-partnership', label: 'Long-Term Partnership', order: 3 },
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
    description: 'Retail merchandiser role for assortment, pricing, and promotions',
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
    description: 'Retail marketing manager role for campaigns, targeting, and budget',
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
    description: 'Retail operations manager role for store efficiency and logistics',
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
    description: 'Retail customer service role for issue resolution and retention',
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
    description: 'Retail analytics manager role for sales tracking and forecasting',
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
    description: 'Media creative director role for vision, art direction, and quality',
    industrySlug: 'media-communications-creative',
    config: {
      systemPrompt: 'You are a Creative Director for a media/creative agency.\nYour role: creative vision, art direction, quality assurance, team leadership.\nSet creative direction. Review and approve creative work. Mentor creative team members. Ensure brand consistency.',
      kpis: [
        { name: 'Creative awards', target: '> 2 per year' },
        { name: 'Client creative satisfaction', target: '> 4.5/5' },
        { name: 'Team retention', target: '> 90%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'content-producer',
    name: 'Content Producer',
    description: 'Media content producer role for ideation, production, and publishing',
    industrySlug: 'media-communications-creative',
    config: {
      systemPrompt: 'You are a Content Producer for a media/creative agency.\nYour role: content ideation, production, publishing, quality control.\nGenerate content ideas. Manage production schedules. Ensure content quality. Coordinate publishing across channels.',
      kpis: [
        { name: 'On schedule', target: '> 95%' },
        { name: 'Engagement rate', target: '> 5%' },
        { name: 'Budget adherence', target: 'within ±5%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'copywriter',
    name: 'Copywriter',
    description: 'Media copywriter role for messaging, storytelling, and brand voice',
    industrySlug: 'media-communications-creative',
    config: {
      systemPrompt: 'You are a Copywriter for a media/creative agency.\nYour role: messaging, storytelling, content writing, brand voice.\nCraft compelling copy. Maintain brand voice consistency. Adapt messaging for different channels. Collaborate with creative team.',
      kpis: [
        { name: 'First pass approval', target: '> 90%' },
        { name: 'Deadlines met', target: '100%' },
        { name: 'Revision rounds', target: '< 2 rounds' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'media-planner',
    name: 'Media Planner',
    description: 'Media planner role for channel selection, audience, and budget',
    industrySlug: 'media-communications-creative',
    config: {
      systemPrompt: 'You are a Media Planner for a media/creative agency.\nYour role: channel selection, audience targeting, budget allocation, performance tracking.\nPlan media mix across channels. Optimize for reach and frequency. Track campaign performance. Manage media budgets.',
      kpis: [
        { name: 'CPM', target: 'below benchmark' },
        { name: 'Reach', target: '> 95% of target' },
        { name: 'Budget utilization', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'project-manager-creative',
    name: 'Project Manager (Creative)',
    description: 'Creative project manager role for timelines, budget, and delivery',
    industrySlug: 'media-communications-creative',
    config: {
      systemPrompt: 'You are a Project Manager for a media/creative agency.\nYour role: timeline management, budget tracking, approval workflows, delivery coordination.\nManage project schedules. Track project budgets. Coordinate reviews and approvals. Ensure on-time delivery.',
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
    name: 'Daily Inventory Sync',
    description: 'Daily inventory synchronization across all channels',
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
    name: 'Weekly Sales Digest',
    description: 'Weekly sales summary with revenue, units, and performance',
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
    description: 'Monthly recalculation of customer lifetime values and segments',
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
    description: 'Daily review of content calendar and publish readiness',
    industrySlug: 'media-communications-creative',
    config: {
      trigger: 'time: 9:00 AM daily',
      action: "Review today's content calendar. Confirm publish readiness. Flag any delays or blockers.",
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-campaign-performance',
    name: 'Weekly Campaign Performance Review',
    description: 'Weekly review of all active campaign performance',
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
    description: 'Weekly sales performance dashboard with key retail metrics',
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
    description: 'Weekly inventory health dashboard with stock and supply metrics',
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
    name: 'Customer Insights Report',
    description: 'Monthly customer insights dashboard with LTV, churn, and NPS',
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
    description: 'Weekly campaign ROI dashboard with spend, engagement, and conversions',
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
    description: 'Monthly content performance dashboard with engagement and growth',
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
    name: 'Product Launch',
    description: 'Execute a new product launch: planning, marketing, inventory, and go-to-market',
    industrySlug: 'retail-commerce-consumer',
    config: {
      description: 'Execute a new product launch: planning, marketing, inventory, and go-to-market',
      estimatedDuration: '4 weeks',
      assignToRole: 'marketing-manager',
      subtasks: [
        'Define product positioning and messaging',
        'Create launch assets (images, copy, videos)',
        'Set pricing and promotional strategy',
        'Coordinate inventory allocation',
        'Brief store teams and customer service',
        'Execute launch across channels',
        'Monitor launch performance and adjust',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'seasonal-campaign',
    name: 'Seasonal Campaign',
    description: 'Plan and execute a seasonal retail campaign',
    industrySlug: 'retail-commerce-consumer',
    config: {
      description: 'Plan and execute a seasonal retail campaign',
      estimatedDuration: '6 weeks',
      assignToRole: 'marketing-manager',
      subtasks: [
        'Research seasonal trends and competitor activity',
        'Define campaign theme and creative direction',
        'Plan merchandising and assortment strategy',
        'Set promotional calendar and pricing',
        'Create campaign assets across channels',
        'Coordinate in-store and online execution',
        'Launch campaign with coordinated rollout',
        'Track performance and optimize mid-campaign',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'inventory-audit',
    name: 'Inventory Audit',
    description: 'Conduct physical inventory audit and reconcile with system records',
    industrySlug: 'retail-commerce-consumer',
    config: {
      description: 'Conduct physical inventory audit and reconcile with system records',
      estimatedDuration: '3 days',
      assignToRole: 'operations-manager',
      subtasks: [
        'Prepare audit plan and assign zones',
        'Freeze inventory movements during count',
        'Conduct physical count by zone',
        'Enter count data into system',
        'Reconcile variances with system records',
        'Investigate significant discrepancies',
        'Finalize audit report and adjustments',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'content-campaign-production',
    name: 'Content Campaign Production',
    description: 'Produce a multi-channel content campaign: brief, creative, production, publishing',
    industrySlug: 'media-communications-creative',
    config: {
      description: 'Produce a multi-channel content campaign: brief, creative, production, publishing',
      estimatedDuration: '3 weeks',
      assignToRole: 'content-producer',
      subtasks: [
        'Gather and finalize creative brief',
        'Develop content strategy and channel plan',
        'Create content assets (copy, visuals, video)',
        'Internal review and client approval',
        'Revise based on feedback',
        'Schedule publishing across channels',
        'Publish and monitor initial performance',
        'Compile post-campaign performance report',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'brand-development',
    name: 'Brand Development',
    description: 'Develop or refresh a brand: strategy, identity, guidelines, rollout',
    industrySlug: 'media-communications-creative',
    config: {
      description: 'Develop or refresh a brand: strategy, identity, guidelines, rollout',
      estimatedDuration: '8 weeks',
      assignToRole: 'creative-director',
      subtasks: [
        'Conduct brand audit and competitive analysis',
        'Define brand strategy and positioning',
        'Develop visual identity concepts',
        'Design logo, typography, and color system',
        'Create brand guidelines document',
        'Design key brand collateral',
        'Present and get stakeholder approval',
        'Plan and execute brand rollout',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'pr-campaign',
    name: 'PR Campaign',
    description: 'Execute a PR campaign: media outreach, coverage tracking, crisis communications',
    industrySlug: 'media-communications-creative',
    config: {
      description: 'Execute a PR campaign: media outreach, coverage tracking, crisis communications',
      estimatedDuration: '6 weeks',
      assignToRole: 'media-planner',
      subtasks: [
        'Define PR objectives and key messages',
        'Build media list and journalist contacts',
        'Draft press materials and pitch angles',
        'Conduct media outreach and follow-ups',
        'Track coverage and sentiment',
        'Manage press inquiries and interviews',
        'Compile coverage report and metrics',
        'Archive and share results with stakeholders',
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'retail-dept-structure',
    name: 'Retail Department Structure',
    description: 'Default department structure for retail companies',
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
    name: 'Media Agency Department Structure',
    description: 'Default department structure for media and creative agencies',
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

async function seedTemplates() {
  console.log(`\nSeed consumer-commerce templates — ${DRY_RUN ? 'DRY RUN (checking only)' : 'WRITING to database'}\n`);

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const t of TEMPLATES) {
    const existing = await prisma.tenantTemplate.findFirst({
      where: {
        tenantId: null,
        slug: t.slug,
        templateType: t.templateType,
      },
    });

    if (existing) {
      if (VERBOSE) console.log(`  SKIP  ${t.templateType} / ${t.slug} (exists: ${existing.id})`);
      skipped++;

      const configChanged = JSON.stringify(existing.config) !== JSON.stringify(t.config);
      const nameChanged = existing.name !== t.name;
      const descChanged = (existing.description || '') !== (t.description || '');

      if (configChanged || nameChanged || descChanged) {
        if (!DRY_RUN) {
          await prisma.tenantTemplate.update({
            where: { id: existing.id },
            data: {
              name: t.name,
              description: t.description,
              config: t.config,
            },
          });
        }
        if (configChanged) console.log(`  UPDATE config  ${t.templateType} / ${t.slug}`);
        if (nameChanged) console.log(`  UPDATE name   ${t.templateType} / ${t.slug}`);
        updated++;
      }
      continue;
    }

    if (VERBOSE) console.log(`  CREATE ${t.templateType} / ${t.slug}`);

    if (!DRY_RUN) {
      await prisma.tenantTemplate.create({
        data: {
          tenantId: null,
          slug: t.slug,
          name: t.name,
          description: t.description,
          templateType: t.templateType,
          industrySlug: t.industrySlug,
          config: t.config,
          isActive: true,
          version: 1,
        },
      });
    }
    created++;
  }

  console.log(
    `\nDone. created=${created} skipped=${skipped} updated=${updated} total=${TEMPLATES.length}` +
      (DRY_RUN ? ' (dry run — no changes written)' : ''),
  );
}

seedTemplates()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
