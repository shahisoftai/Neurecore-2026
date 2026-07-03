#!/usr/bin/env node
/**
 * seed-templates.cjs
 *
 * Seeds the three template catalogs that the FA / FT surfaces depend on:
 *   • Agent Templates        — platform-public LLM blueprints (isPublic=true, tenantId=null)
 *   • Department Templates   — platform-public org blueprints (isPublic=true)
 *   • Tier Templates         — subscription plans + TierAgentPool allocations
 *
 * Idempotent: safe to run multiple times. Existing rows are upserted by
 * stable keys (slug for dept templates + tiers; name for agent templates).
 *
 * Run: node prisma/seed-templates.cjs
 */

'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MODEL_EXEC = 'gpt-4o';
const MODEL_DEFAULT = 'gpt-4o-mini';

function buildTor({
  role,
  department,
  purpose,
  responsibilities = [],
  outputs = [],
  kpis = [],
  escalations = [],
  disclaimers,
}) {
  const list = (title, items) =>
    items && items.length
      ? `\n${title}:\n${items.map((x) => `- ${x}`).join('\n')}`
      : '';

  const systemPrompt = `You are the ${role} AI agent in the ${department} department.

TERMS OF REFERENCE (TOR) — Editable
Purpose: ${purpose}
Scope: Operate within your department domain. When information is missing, ask clarifying questions and state assumptions.
Decisioning: Provide recommendations by default. Escalate when approvals are required.

Operating Principles:
- Be accurate, concise, and business-safe.
- Produce structured outputs (bullets, tables, checklists) when helpful.
- Cite inputs (source systems, IDs, dates) when available.
- Never fabricate numbers; mark unknowns.
${list('Core responsibilities', responsibilities)}
${list('Primary outputs / deliverables', outputs)}
${list('KPIs / quality signals', kpis)}
${list('Escalations / approvals', escalations)}
${disclaimers ? `\nNotes / disclaimers:\n${disclaimers}` : ''}`.trim();

  const instructions =
    'Work to your TOR. Keep deliverables actionable and ready to execute. TORs are editable by SuperAdmin and tenant admins.';

  return { systemPrompt, instructions };
}

function makeAgentTemplate(def) {
  const tor = buildTor(def.tor);
  return {
    name: def.name,
    description: def.description,
    type: def.type,
    model: def.model ?? MODEL_DEFAULT,
    systemPrompt: tor.systemPrompt,
    instructions: tor.instructions,
    permissions: def.permissions ?? [],
    config: {
      department: def.department,
      roleKey: def.roleKey ?? def.name,
      torVersion: '1.0.0',
      allowTenantEditing: def.allowTenantEditing ?? true,
      ...(def.config ?? {}),
    },
    version: '1.0.0',
  };
}

// ─── Agent Templates ────────────────────────────────────────────────────────
// Compact, useful set covering every AgentType enum + a realistic org map.
// Each template is keyed by name (the upsert key) and tagged with department
// so it can be mapped to dept templates downstream.

const AGENT_TEMPLATES = [
  // ── EXECUTIVE ───────────────────────────────────────────────────────────
  makeAgentTemplate({
    name: 'CEO Agent',
    description:
      'Executive strategy, prioritization, and final approvals across departments.',
    type: 'EXECUTIVE',
    department: 'EXECUTIVE',
    model: MODEL_EXEC,
    config: { authorityLevel: 'APPROVAL' },
    tor: {
      role: 'CEO',
      department: 'Executive',
      purpose:
        'Set strategy, align departments, and approve high-impact decisions.',
      responsibilities: [
        'Define company objectives and quarterly priorities',
        'Resolve cross-department conflicts and trade-offs',
        'Approve high-risk / high-spend actions per policy',
        'Issue executive summaries and action directives',
      ],
      outputs: ['Quarterly OKR drafts', 'Decision memos', 'Board summaries'],
      kpis: ['% decisions on time', 'Cross-dept NPS'],
      escalations: ['Legal action', 'Spend > $10k', 'Public statements'],
    },
  }),
  makeAgentTemplate({
    name: 'COO Agent',
    description: 'Operational execution, throughput, and process integrity.',
    type: 'EXECUTIVE',
    department: 'EXECUTIVE',
    model: MODEL_EXEC,
    tor: {
      role: 'COO',
      department: 'Executive',
      purpose:
        'Run the operating system of the company — process, capacity, SLAs.',
      responsibilities: [
        'Monitor cross-functional throughput and bottlenecks',
        'Codify SOPs and ensure adoption',
        'Approve resource reallocation between departments',
      ],
      outputs: ['Weekly ops review', 'Bottleneck report', 'SOP updates'],
      kpis: ['SLA hit rate', 'Cycle time', 'Capacity utilization'],
      escalations: ['SLA breach risk', 'Headcount change'],
    },
  }),

  // ── CORE ────────────────────────────────────────────────────────────────
  makeAgentTemplate({
    name: 'Chief of Staff Agent',
    description:
      'Calendar, comms triage, and follow-through for the leadership team.',
    type: 'CORE',
    department: 'EXECUTIVE',
    tor: {
      role: 'Chief of Staff',
      department: 'Executive',
      purpose:
        'Keep leadership focused by handling logistics, triage, and follow-ups.',
      responsibilities: [
        'Triage inbound messages and flag urgent items',
        'Maintain meeting agendas, notes, and action items',
        'Track commitments and nudge owners',
      ],
      outputs: ['Daily briefing', 'Action tracker', 'Meeting notes'],
      kpis: ['% actions closed on time'],
      escalations: ['Missed commitment', 'Scheduling conflict'],
    },
  }),
  makeAgentTemplate({
    name: 'Strategy Agent',
    description: 'Market intel, competitive reads, and growth strategy drafts.',
    type: 'CORE',
    department: 'EXECUTIVE',
    tor: {
      role: 'Strategy',
      department: 'Executive',
      purpose:
        'Synthesize market, customer, and internal signals into strategy drafts.',
      responsibilities: [
        'Run weekly market read',
        'Draft strategy memos for CEO review',
        'Track assumption register and revisit quarterly',
      ],
      outputs: ['Weekly market brief', 'Strategy memo', 'Assumption register'],
      kpis: ['Memo turnaround', 'Assumption accuracy'],
      escalations: ['Material market shift'],
    },
  }),

  // ── FUNCTIONAL — Sales ──────────────────────────────────────────────────
  makeAgentTemplate({
    name: 'Sales Development Rep',
    description:
      'Outbound prospecting, lead qualification, and meeting booking.',
    type: 'FUNCTIONAL',
    department: 'SALES',
    permissions: ['email.send', 'crm.write'],
    tor: {
      role: 'SDR',
      department: 'Sales',
      purpose:
        'Fill the top of the funnel with qualified meetings for Account Executives.',
      responsibilities: [
        'Research accounts and identify decision makers',
        'Run multi-touch outbound sequences',
        'Qualify inbound leads and route to AEs',
      ],
      outputs: ['SQL meetings booked', 'Sequence performance report'],
      kpis: ['Meetings booked / week', 'Reply rate', 'SQL→Opportunity %'],
      escalations: ['Enterprise lead', 'Pricing objection'],
    },
  }),
  makeAgentTemplate({
    name: 'Account Executive',
    description:
      'Deal management, proposal drafting, and closing through signature.',
    type: 'FUNCTIONAL',
    department: 'SALES',
    permissions: ['email.send', 'crm.write', 'proposal.create'],
    tor: {
      role: 'AE',
      department: 'Sales',
      purpose: 'Move qualified opportunities from discovery to signed contract.',
      responsibilities: [
        'Run discovery and demo',
        'Draft proposals and handle pricing questions',
        'Coordinate procurement, security review, and signature',
      ],
      outputs: ['Proposal', 'Mutual action plan', 'Closed-won forecast'],
      kpis: ['Win rate', 'ACV', 'Sales cycle length'],
      escalations: ['Discount > 15%', 'Legal redlines'],
    },
  }),

  // ── FUNCTIONAL — Marketing ──────────────────────────────────────────────
  makeAgentTemplate({
    name: 'Content Marketer',
    description:
      'Long-form content production: blog posts, briefs, social copy.',
    type: 'FUNCTIONAL',
    department: 'MARKETING',
    permissions: ['docs.write'],
    tor: {
      role: 'Content Marketing',
      department: 'Marketing',
      purpose:
        'Produce high-quality written content that drives qualified traffic.',
      responsibilities: [
        'Maintain editorial calendar',
        'Draft blog posts, briefs, and social copy',
        'Coordinate with SEO and Design',
      ],
      outputs: ['Blog post', 'Editorial calendar', 'Social copy pack'],
      kpis: ['Articles shipped / month', 'Organic traffic lift'],
      escalations: ['Brand-voice dispute'],
    },
  }),
  makeAgentTemplate({
    name: 'SEO Specialist',
    description:
      'Keyword research, on-page optimization, and SERP monitoring.',
    type: 'FUNCTIONAL',
    department: 'MARKETING',
    tor: {
      role: 'SEO',
      department: 'Marketing',
      purpose: 'Grow qualified organic traffic through search-driven content.',
      responsibilities: [
        'Run keyword research and intent mapping',
        'Audit on-page SEO and ship recommendations',
        'Monitor SERP movement and report weekly',
      ],
      outputs: ['Keyword map', 'On-page audit', 'Weekly SERP report'],
      kpis: ['Indexed pages', 'SERP rank movement', 'Organic CTR'],
      escalations: ['Algorithm update impact'],
    },
  }),

  // ── FUNCTIONAL — Engineering ────────────────────────────────────────────
  makeAgentTemplate({
    name: 'Software Engineer',
    description:
      'Code generation, refactoring, PR review, and test authoring.',
    type: 'FUNCTIONAL',
    department: 'ENGINEERING',
    permissions: ['code.read', 'code.write', 'pr.create'],
    tor: {
      role: 'Software Engineer',
      department: 'Engineering',
      purpose:
        'Ship reliable, well-tested code that advances the team roadmap.',
      responsibilities: [
        'Implement features and bug fixes',
        'Author and review PRs',
        'Maintain test coverage on owned areas',
      ],
      outputs: ['Merged PR', 'Test suite', 'Design note'],
      kpis: ['PR cycle time', 'Defect escape rate', 'Coverage %'],
      escalations: ['Production incident', 'Security finding'],
    },
  }),
  makeAgentTemplate({
    name: 'Site Reliability Engineer',
    description:
      'Incident response, on-call rotation, and reliability engineering.',
    type: 'FUNCTIONAL',
    department: 'ENGINEERING',
    permissions: ['infra.read', 'infra.write'],
    tor: {
      role: 'SRE',
      department: 'Engineering',
      purpose:
        'Keep production reliable and continuously reduce toil.',
      responsibilities: [
        'Run on-call and lead incident response',
        'Maintain SLOs and error budgets',
        'Automate manual operational work',
      ],
      outputs: ['Incident report', 'SLO dashboard', 'Toil reduction log'],
      kpis: ['MTTR', 'SLO attainment', 'Toil hours / week'],
      escalations: ['SEV-1 incident', 'Budget exhaustion'],
    },
  }),

  // ── FUNCTIONAL — Customer Success ───────────────────────────────────────
  makeAgentTemplate({
    name: 'Customer Success Manager',
    description:
      'Onboarding, adoption, retention, and expansion plays for accounts.',
    type: 'FUNCTIONAL',
    department: 'CUSTOMER_SUCCESS',
    permissions: ['crm.read', 'crm.write'],
    tor: {
      role: 'CSM',
      department: 'Customer Success',
      purpose: 'Drive adoption and renewals; surface expansion opportunities.',
      responsibilities: [
        'Run onboarding and first-90-days plans',
        'Hold QBRs and track adoption metrics',
        'Coordinate with Sales on renewals and expansion',
      ],
      outputs: ['Onboarding plan', 'QBR deck', 'Renewal forecast'],
      kpis: ['NRR', 'Onboarding NPS', 'Renewal rate'],
      escalations: ['At-risk renewal', 'Churn signal'],
    },
  }),
  makeAgentTemplate({
    name: 'Support Specialist',
    description:
      'Tier-1 / Tier-2 ticket triage, response, and root-cause tracking.',
    type: 'FUNCTIONAL',
    department: 'CUSTOMER_SUCCESS',
    permissions: ['ticket.read', 'ticket.write'],
    tor: {
      role: 'Support',
      department: 'Customer Success',
      purpose:
        'Resolve customer issues quickly and feed product with patterns.',
      responsibilities: [
        'Triage and respond to inbound tickets',
        'Reproduce bugs and file detailed reports',
        'Maintain help-center and macros',
      ],
      outputs: ['Resolved tickets', 'Bug reports', 'Help-center articles'],
      kpis: ['First response time', 'CSAT', 'Resolution time'],
      escalations: ['SEV-1 customer issue'],
    },
  }),

  // ── FUNCTIONAL — Finance ────────────────────────────────────────────────
  makeAgentTemplate({
    name: 'Accountant',
    description:
      'Bookkeeping, reconciliation, and month-end close support.',
    type: 'FUNCTIONAL',
    department: 'FINANCE',
    permissions: ['books.read', 'books.write'],
    tor: {
      role: 'Accountant',
      department: 'Finance',
      purpose: 'Keep the books accurate and the close on schedule.',
      responsibilities: [
        'Reconcile bank, cards, and platform ledgers',
        'Prepare journal entries and supporting schedules',
        'Support month-end close',
      ],
      outputs: ['Reconciliation report', 'Journal entries', 'Close checklist'],
      kpis: ['Days to close', 'Reconciliation accuracy'],
      escalations: ['Variance > $5k', 'Missing source docs'],
    },
  }),

  // ── FUNCTIONAL — HR / People Ops ────────────────────────────────────────
  makeAgentTemplate({
    name: 'HR Generalist',
    description:
      'Onboarding coordination, policy Q&A, and people-ops workflows.',
    type: 'FUNCTIONAL',
    department: 'PEOPLE_OPS',
    permissions: ['hr.read', 'hr.write'],
    tor: {
      role: 'HR Generalist',
      department: 'People Ops',
      purpose:
        'Support the employee lifecycle from offer to offboarding.',
      responsibilities: [
        'Coordinate onboarding logistics and first-week readiness',
        'Answer policy and benefits questions',
        'Maintain HRIS hygiene',
      ],
      outputs: ['Onboarding checklist', 'Policy FAQ', 'HRIS report'],
      kpis: ['Time-to-productive', 'Ticket CSAT'],
      escalations: ['ER issue', 'Compensation exception'],
    },
  }),

  // ── FUNCTIONAL — Legal ──────────────────────────────────────────────────
  makeAgentTemplate({
    name: 'Legal Assistant',
    description:
      'Contract drafting from templates, NDA triage, and clause lookup.',
    type: 'FUNCTIONAL',
    department: 'LEGAL',
    permissions: ['docs.read', 'docs.write'],
    tor: {
      role: 'Legal Assistant',
      department: 'Legal',
      purpose:
        'Accelerate routine legal work while flagging risk to counsel.',
      responsibilities: [
        'Draft NDAs and standard agreements from approved templates',
        'Track contract status and renewals',
        'Triage inbound legal requests',
      ],
      outputs: ['Draft agreement', 'Contract status report'],
      kpis: ['Draft turnaround', 'Renewal on-time %'],
      escalations: ['Non-standard terms', 'Litigation signal'],
    },
  }),

  // ── META ────────────────────────────────────────────────────────────────
  makeAgentTemplate({
    name: 'Agent Supervisor',
    description:
      'Routes work between agents, watches for stalls, and escalates.',
    type: 'META',
    department: 'META',
    tor: {
      role: 'Agent Supervisor',
      department: 'Meta',
      purpose: 'Coordinate agent work and keep flows moving.',
      responsibilities: [
        'Assign incoming tasks to the right agent',
        'Watch for stalled work and reassign',
        'Escalate ambiguous or high-risk tasks',
      ],
      outputs: ['Routing log', 'Stall report'],
      kpis: ['Task assignment latency', 'Stall rate'],
      escalations: ['Repeated stall', 'Cross-agent conflict'],
    },
  }),
];

// ─── Department Templates ──────────────────────────────────────────────────
// Org blueprints. Each structure[] item uses the deployed schema
// (name, description?, headAgentType?, parentName?).

const DEPT_TEMPLATES = [
  {
    slug: 'startup-core',
    name: 'Startup Core',
    description:
      'Lean org for early-stage startups: every essential function, no redundancy.',
    category: 'startup',
    tags: ['early-stage', 'lean', 'generalist'],
    structure: [
      {
        name: 'Executive',
        description: 'CEO, COO, and Chiefs of Staff.',
        headAgentType: 'EXECUTIVE',
      },
      {
        name: 'Sales',
        description: 'Outbound and closing motions.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Marketing',
        description: 'Content, SEO, and demand gen.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Engineering',
        description: 'Product engineering and SRE.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Customer Success',
        description: 'Onboarding, support, and retention.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Finance',
        description: 'Bookkeeping, reporting, and runway.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
    ],
  },
  {
    slug: 'saas-growth',
    name: 'SaaS Growth',
    description:
      'Org for a B2B SaaS in growth stage: PLG, ABM, and customer outcomes.',
    category: 'saas',
    tags: ['b2b', 'plg', 'growth'],
    structure: [
      { name: 'Executive', headAgentType: 'EXECUTIVE' },
      {
        name: 'Sales',
        description: 'SDR + AE motions.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Marketing',
        description: 'Demand gen, content, SEO.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Customer Success',
        description: 'Onboarding, CSM, support.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Engineering',
        description: 'Product + platform.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'People Ops',
        description: 'Hiring and people ops.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Finance',
        description: 'FP&A and accounting.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
    ],
  },
  {
    slug: 'agency-services',
    name: 'Agency / Services',
    description:
      'Org for a client-services firm: delivery, account management, and growth.',
    category: 'agency',
    tags: ['services', 'delivery', 'agency'],
    structure: [
      { name: 'Executive', headAgentType: 'EXECUTIVE' },
      {
        name: 'Sales',
        description: 'New logos and proposals.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Client Delivery',
        description: 'Active engagements and delivery quality.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Marketing',
        description: 'Brand, content, partnerships.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'People Ops',
        description: 'Hiring, onboarding, retention.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Finance',
        description: 'Billing, AR, FP&A.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
    ],
  },
  {
    slug: 'ecommerce-ops',
    name: 'E-Commerce Ops',
    description:
      'Org for an e-commerce operator: storefront, ops, growth, and CX.',
    category: 'ecommerce',
    tags: ['d2c', 'retail', 'ops'],
    structure: [
      { name: 'Executive', headAgentType: 'EXECUTIVE' },
      {
        name: 'Marketing',
        description: 'Acquisition and retention.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Sales',
        description: 'Wholesale and partnerships.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Operations',
        description: 'Fulfilment, inventory, suppliers.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Customer Success',
        description: 'Support and CX.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
      {
        name: 'Finance',
        description: 'Accounting and FP&A.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
      },
    ],
  },
  {
    slug: 'enterprise-suite',
    name: 'Enterprise Suite',
    description:
      'Org for mid-to-large enterprises with formal functions and governance.',
    category: 'enterprise',
    tags: ['enterprise', 'governance', 'compliance'],
    structure: [
      { name: 'Executive', headAgentType: 'EXECUTIVE' },
      {
        name: 'Sales',
        parentName: 'Executive',
      },
      {
        name: 'Marketing',
        parentName: 'Executive',
      },
      {
        name: 'Engineering',
        parentName: 'Executive',
      },
      {
        name: 'Customer Success',
        parentName: 'Executive',
      },
      {
        name: 'People Ops',
        parentName: 'Executive',
      },
      {
        name: 'Finance',
        parentName: 'Executive',
      },
      {
        name: 'Legal',
        parentName: 'Executive',
      },
      {
        name: 'Meta',
        description: 'Supervisory and routing agents.',
        headAgentType: 'META',
        parentName: 'Executive',
      },
    ],
  },
];

// ─── Tier Templates ────────────────────────────────────────────────────────
// One row per canonical tier in PACK_TIER_ORDER. `tier_starter`, `tier_pro`,
// `tier_enterprise` already exist with their internal IDs; we update them
// (do NOT rename — FKs reference id) and add a new `tier_community`.

const TIER_TEMPLATES = [
  {
    slug: 'community',
    name: 'Community',
    description: 'Free tier — try the platform with limited capacity.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'USD',
    isActive: true,
    isDefault: true,
    sortOrder: 1,
    maxUsers: 2,
    maxAgents: 3,
    maxDepartments: 1,
    maxStorageGB: 1,
    maxApiCalls: 1000,
    maxConversationMessages: 500,
    maxFileSizeMB: 10,
    allowCustomBranding: false,
    allowApiAccess: false,
    allowSso: false,
    allowAuditExport: false,
  },
  {
    slug: 'starter',
    name: 'Starter',
    description: 'For small teams getting started with AI agents.',
    monthlyPrice: 29,
    yearlyPrice: 290,
    currency: 'USD',
    isActive: true,
    isDefault: false,
    sortOrder: 2,
    maxUsers: 5,
    maxAgents: 6,
    maxDepartments: 3,
    maxStorageGB: 5,
    maxApiCalls: 5000,
    maxConversationMessages: 2000,
    maxFileSizeMB: 25,
    allowCustomBranding: false,
    allowApiAccess: true,
    allowSso: false,
    allowAuditExport: false,
  },
  {
    slug: 'pro',
    name: 'Professional',
    description: 'For growing teams with broader agent needs.',
    monthlyPrice: 99,
    yearlyPrice: 990,
    currency: 'USD',
    isActive: true,
    isDefault: false,
    sortOrder: 3,
    maxUsers: 25,
    maxAgents: 20,
    maxDepartments: 8,
    maxStorageGB: 25,
    maxApiCalls: 25000,
    maxConversationMessages: 10000,
    maxFileSizeMB: 50,
    allowCustomBranding: true,
    allowApiAccess: true,
    allowSso: false,
    allowAuditExport: true,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited scale, SSO, and governance controls.',
    monthlyPrice: 499,
    yearlyPrice: 4990,
    currency: 'USD',
    isActive: true,
    isDefault: false,
    sortOrder: 4,
    maxUsers: 500,
    maxAgents: 200,
    maxDepartments: 50,
    maxStorageGB: 500,
    maxApiCalls: 250000,
    maxConversationMessages: 100000,
    maxFileSizeMB: 200,
    allowCustomBranding: true,
    allowApiAccess: true,
    allowSso: true,
    allowAuditExport: true,
  },
];

// Tier × Agent Template allocations. The slot number = position in the
// tier agent picker; lower = pre-selected. `isRequired` agents are always
// provisioned; the rest are opt-in defaults.

const TIER_POOL_ALLOCATIONS = [
  // COMMUNITY — minimal starter set
  {
    tierSlug: 'community',
    entries: [
      { templateName: 'Chief of Staff Agent', slot: 1, isRequired: true, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 0.5 },
      { templateName: 'Content Marketer',     slot: 2, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 0.5 },
    ],
  },
  // STARTER — adds sales + support
  {
    tierSlug: 'starter',
    entries: [
      { templateName: 'Chief of Staff Agent', slot: 1, isRequired: true,  isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 1.0 },
      { templateName: 'Content Marketer',     slot: 2, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 1.0 },
      { templateName: 'Sales Development Rep',slot: 3, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 1.0 },
      { templateName: 'Support Specialist',   slot: 4, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 1.0 },
    ],
  },
  // PRO — adds SEO, AE, CSM, engineer
  {
    tierSlug: 'pro',
    entries: [
      { templateName: 'Chief of Staff Agent', slot: 1, isRequired: true,  isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 2.0 },
      { templateName: 'Strategy Agent',       slot: 2, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_EXEC,    defaultBudgetPerDay: 2.0 },
      { templateName: 'Content Marketer',     slot: 3, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 2.0 },
      { templateName: 'SEO Specialist',       slot: 4, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 2.0 },
      { templateName: 'Sales Development Rep',slot: 5, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 2.0 },
      { templateName: 'Account Executive',    slot: 6, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 2.0 },
      { templateName: 'Customer Success Manager', slot: 7, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 2.0 },
      { templateName: 'Support Specialist',   slot: 8, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 2.0 },
      { templateName: 'Software Engineer',    slot: 9, isRequired: false, isDefaultSelected: false, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 2.0 },
    ],
  },
  // ENTERPRISE — full org
  {
    tierSlug: 'enterprise',
    entries: [
      { templateName: 'CEO Agent',            slot: 1,  isRequired: true,  isDefaultSelected: true, defaultModel: MODEL_EXEC, defaultBudgetPerDay: 5.0 },
      { templateName: 'COO Agent',            slot: 2,  isRequired: false, isDefaultSelected: true, defaultModel: MODEL_EXEC, defaultBudgetPerDay: 5.0 },
      { templateName: 'Chief of Staff Agent', slot: 3,  isRequired: true,  isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 5.0 },
      { templateName: 'Strategy Agent',       slot: 4,  isRequired: false, isDefaultSelected: true, defaultModel: MODEL_EXEC,    defaultBudgetPerDay: 5.0 },
      { templateName: 'Agent Supervisor',     slot: 5,  isRequired: true,  isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 5.0 },
      { templateName: 'Sales Development Rep',slot: 6,  isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 5.0 },
      { templateName: 'Account Executive',    slot: 7,  isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 5.0 },
      { templateName: 'Content Marketer',     slot: 8,  isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 5.0 },
      { templateName: 'SEO Specialist',       slot: 9,  isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 5.0 },
      { templateName: 'Software Engineer',    slot: 10, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 5.0 },
      { templateName: 'Site Reliability Engineer', slot: 11, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 5.0 },
      { templateName: 'Customer Success Manager', slot: 12, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 5.0 },
      { templateName: 'Support Specialist',   slot: 13, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 5.0 },
      { templateName: 'Accountant',           slot: 14, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 5.0 },
      { templateName: 'HR Generalist',        slot: 15, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 5.0 },
      { templateName: 'Legal Assistant',      slot: 16, isRequired: false, isDefaultSelected: true, defaultModel: MODEL_DEFAULT, defaultBudgetPerDay: 5.0 },
    ],
  },
];

// ─── Tier Templates (FA /tier-templates page) ────────────────────────────────
// These are DepartmentTemplate rows with slug prefix `tier-` and tag `tier`.
// The FA `/tier-templates` page (frontend-admin/src/app/tier-templates/page.tsx)
// filters DepartmentTemplate rows by slug/name/tag — it does NOT read the
// Tier model. `structure[]` items carry `agentTemplateNames[]` which the
// DeploymentService (deployment.service.ts:280-339) matches against public
// AgentTemplate rows to spawn concrete Agents at deploy time.

const TIER_DEPT_TEMPLATES = [
  {
    slug: 'tier-community',
    name: 'Tier: Community',
    description:
      'Free tier — Chief of Staff + Content Marketer for a lean start.',
    category: 'tier',
    tags: ['tier', 'community', 'starter'],
    structure: [
      {
        name: 'Executive',
        description: 'Coordination and follow-through.',
        headAgentType: 'CORE',
        agentTemplateNames: ['Chief of Staff Agent'],
      },
      {
        name: 'Marketing',
        description: 'Lean content engine.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: ['Content Marketer'],
      },
    ],
  },
  {
    slug: 'tier-starter',
    name: 'Tier: Starter',
    description:
      'Starter tier — adds Sales Development and Support to the Community base.',
    category: 'tier',
    tags: ['tier', 'starter'],
    structure: [
      {
        name: 'Executive',
        description: 'Coordination and follow-through.',
        headAgentType: 'CORE',
        agentTemplateNames: ['Chief of Staff Agent'],
      },
      {
        name: 'Sales',
        description: 'Outbound prospecting.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: ['Sales Development Rep'],
      },
      {
        name: 'Marketing',
        description: 'Content production.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: ['Content Marketer'],
      },
      {
        name: 'Customer Success',
        description: 'Tier-1 / Tier-2 support.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: ['Support Specialist'],
      },
    ],
  },
  {
    slug: 'tier-pro',
    name: 'Tier: Professional',
    description:
      'Professional tier — full revenue + customer outcomes team (Strategy, SEO, AE, CSM, Support).',
    category: 'tier',
    tags: ['tier', 'pro'],
    structure: [
      {
        name: 'Executive',
        description: 'Strategy + coordination.',
        headAgentType: 'CORE',
        agentTemplateNames: ['Chief of Staff Agent', 'Strategy Agent'],
      },
      {
        name: 'Sales',
        description: 'Outbound + closing motions.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: ['Sales Development Rep', 'Account Executive'],
      },
      {
        name: 'Marketing',
        description: 'Content + SEO.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: ['Content Marketer', 'SEO Specialist'],
      },
      {
        name: 'Customer Success',
        description: 'Onboarding + retention + support.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: [
          'Customer Success Manager',
          'Support Specialist',
        ],
      },
      {
        name: 'Engineering',
        description: 'Product engineering.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: ['Software Engineer'],
      },
    ],
  },
  {
    slug: 'tier-enterprise',
    name: 'Tier: Enterprise',
    description:
      'Enterprise tier — full C-suite + every functional + Meta supervisor.',
    category: 'tier',
    tags: ['tier', 'enterprise'],
    structure: [
      {
        name: 'Executive',
        description: 'CEO + COO + Chief of Staff + Strategy.',
        headAgentType: 'EXECUTIVE',
        agentTemplateNames: [
          'CEO Agent',
          'COO Agent',
          'Chief of Staff Agent',
          'Strategy Agent',
        ],
      },
      {
        name: 'Sales',
        description: 'Outbound + closing motions.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: ['Sales Development Rep', 'Account Executive'],
      },
      {
        name: 'Marketing',
        description: 'Content + SEO.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: ['Content Marketer', 'SEO Specialist'],
      },
      {
        name: 'Engineering',
        description: 'Product + SRE.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: ['Software Engineer', 'Site Reliability Engineer'],
      },
      {
        name: 'Customer Success',
        description: 'Onboarding + retention + support.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: [
          'Customer Success Manager',
          'Support Specialist',
        ],
      },
      {
        name: 'Finance',
        description: 'Accounting.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: ['Accountant'],
      },
      {
        name: 'People Ops',
        description: 'HR generalist.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: ['HR Generalist'],
      },
      {
        name: 'Legal',
        description: 'Legal assistant.',
        headAgentType: 'FUNCTIONAL',
        parentName: 'Executive',
        agentTemplateNames: ['Legal Assistant'],
      },
      {
        name: 'Meta',
        description: 'Agent supervision + routing.',
        headAgentType: 'META',
        parentName: 'Executive',
        agentTemplateNames: ['Agent Supervisor'],
      },
    ],
  },
];

// ─── Runners ────────────────────────────────────────────────────────────────

async function seedAgentTemplates() {
  console.log('\n🌱 Seeding platform agent templates…');
  let created = 0;
  let updated = 0;
  for (const tmpl of AGENT_TEMPLATES) {
    const existing = await prisma.agentTemplate.findFirst({
      where: {
        tenantId: null,
        isPublic: true,
        name: tmpl.name,
      },
    });
    if (existing) {
      await prisma.agentTemplate.update({
        where: { id: existing.id },
        data: {
          description: tmpl.description,
          type: tmpl.type,
          model: tmpl.model,
          systemPrompt: tmpl.systemPrompt,
          instructions: tmpl.instructions,
          permissions: tmpl.permissions,
          config: tmpl.config,
          version: tmpl.version,
          isPublic: true,
          tenantId: null,
        },
      });
      updated++;
    } else {
      await prisma.agentTemplate.create({
        data: {
          name: tmpl.name,
          description: tmpl.description,
          type: tmpl.type,
          model: tmpl.model,
          systemPrompt: tmpl.systemPrompt,
          instructions: tmpl.instructions,
          permissions: tmpl.permissions,
          config: tmpl.config,
          version: tmpl.version,
          isPublic: true,
          tenantId: null,
        },
      });
      created++;
    }
  }
  console.log(`  ✓ Agent templates — created: ${created}, updated: ${updated}`);
}

async function seedDepartmentTemplates() {
  console.log('\n🏢 Seeding department templates…');
  let created = 0;
  let updated = 0;
  for (const tmpl of DEPT_TEMPLATES) {
    const existing = await prisma.departmentTemplate.findUnique({
      where: { slug: tmpl.slug },
    });
    if (existing) {
      await prisma.departmentTemplate.update({
        where: { id: existing.id },
        data: {
          name: tmpl.name,
          description: tmpl.description,
          structure: tmpl.structure,
          category: tmpl.category,
          tags: tmpl.tags,
          isPublic: true,
        },
      });
      updated++;
    } else {
      await prisma.departmentTemplate.create({
        data: {
          slug: tmpl.slug,
          name: tmpl.name,
          description: tmpl.description,
          structure: tmpl.structure,
          category: tmpl.category,
          tags: tmpl.tags,
          isPublic: true,
        },
      });
      created++;
    }
  }
  console.log(`  ✓ Department templates — created: ${created}, updated: ${updated}`);
}

async function seedTiers() {
  console.log('\n💳 Seeding tier templates…');
  let created = 0;
  let updated = 0;
  for (const tier of TIER_TEMPLATES) {
    const existing = await prisma.tier.findUnique({
      where: { slug: tier.slug },
    });
    if (existing) {
      await prisma.tier.update({
        where: { id: existing.id },
        data: {
          name: tier.name,
          description: tier.description,
          isActive: tier.isActive,
          isDefault: tier.isDefault,
          sortOrder: tier.sortOrder,
          monthlyPrice: tier.monthlyPrice,
          yearlyPrice: tier.yearlyPrice,
          currency: tier.currency,
          maxUsers: tier.maxUsers,
          maxAgents: tier.maxAgents,
          maxDepartments: tier.maxDepartments,
          maxStorageGB: tier.maxStorageGB,
          maxApiCalls: tier.maxApiCalls,
          maxConversationMessages: tier.maxConversationMessages,
          maxFileSizeMB: tier.maxFileSizeMB,
          allowCustomBranding: tier.allowCustomBranding,
          allowApiAccess: tier.allowApiAccess,
          allowSso: tier.allowSso,
          allowAuditExport: tier.allowAuditExport,
        },
      });
      updated++;
    } else {
      await prisma.tier.create({ data: tier });
      created++;
    }
  }
  console.log(`  ✓ Tiers — created: ${created}, updated: ${updated}`);

  // Ensure exactly one default tier.
  const defaults = await prisma.tier.findMany({ where: { isDefault: true } });
  if (defaults.length > 1) {
    console.warn(
      `  ⚠ Multiple default tiers detected (${defaults.length}). Clearing all except ${tier.slug === 'community' ? 'community' : 'first'}.`,
    );
    const keepId =
      defaults.find((t) => t.slug === 'community')?.id ?? defaults[0].id;
    await prisma.tier.updateMany({
      where: { isDefault: true, NOT: { id: keepId } },
      data: { isDefault: false },
    });
  }
}

async function seedTierAgentPools() {
  console.log('\n🔗 Seeding tier agent pool allocations…');
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const alloc of TIER_POOL_ALLOCATIONS) {
    const tier = await prisma.tier.findUnique({
      where: { slug: alloc.tierSlug },
    });
    if (!tier) {
      console.warn(`  ⚠ Tier "${alloc.tierSlug}" not found, skipping`);
      continue;
    }

    for (const entry of alloc.entries) {
      const tmpl = await prisma.agentTemplate.findFirst({
        where: {
          tenantId: null,
          isPublic: true,
          name: entry.templateName,
        },
      });
      if (!tmpl) {
        console.warn(
          `  ⚠ Agent template "${entry.templateName}" not found, skipping pool entry`,
        );
        skipped++;
        continue;
      }

      const existing = await prisma.tierAgentPool.findUnique({
        where: { tierId_templateId: { tierId: tier.id, templateId: tmpl.id } },
      });

      const data = {
        slot: entry.slot,
        isRequired: entry.isRequired,
        isDefaultSelected: entry.isDefaultSelected,
        defaultModel: entry.defaultModel ?? null,
        defaultBudgetPerDay: entry.defaultBudgetPerDay ?? null,
      };

      if (existing) {
        await prisma.tierAgentPool.update({
          where: { id: existing.id },
          data,
        });
        updated++;
      } else {
        await prisma.tierAgentPool.create({
          data: { tierId: tier.id, templateId: tmpl.id, ...data },
        });
        created++;
      }
    }
  }
  console.log(
    `  ✓ Tier agent pool — created: ${created}, updated: ${updated}, skipped: ${skipped}`,
  );
}

async function seedTierDeptTemplates() {
  console.log('\n🏷️  Seeding tier templates (as DepartmentTemplate rows)…');
  let created = 0;
  let updated = 0;
  for (const tmpl of TIER_DEPT_TEMPLATES) {
    const existing = await prisma.departmentTemplate.findUnique({
      where: { slug: tmpl.slug },
    });
    if (existing) {
      await prisma.departmentTemplate.update({
        where: { id: existing.id },
        data: {
          name: tmpl.name,
          description: tmpl.description,
          structure: tmpl.structure,
          category: tmpl.category,
          tags: tmpl.tags,
          isPublic: true,
        },
      });
      updated++;
    } else {
      await prisma.departmentTemplate.create({
        data: {
          slug: tmpl.slug,
          name: tmpl.name,
          description: tmpl.description,
          structure: tmpl.structure,
          category: tmpl.category,
          tags: tmpl.tags,
          isPublic: true,
        },
      });
      created++;
    }
  }
  console.log(
    `  ✓ Tier templates (as DeptTemplate) — created: ${created}, updated: ${updated}`,
  );
}

async function main() {
  await seedAgentTemplates();
  await seedDepartmentTemplates();
  await seedTiers();
  await seedTierAgentPools();
  await seedTierDeptTemplates();

  // Final summary
  const [agents, depts, allDeptTpls, tiers, pools] = await Promise.all([
    prisma.agentTemplate.count({ where: { tenantId: null, isPublic: true } }),
    prisma.departmentTemplate.count(),
    prisma.departmentTemplate.findMany({
      where: { slug: { startsWith: 'tier-' } },
      select: { slug: true },
    }),
    prisma.tier.count(),
    prisma.tierAgentPool.count(),
  ]);
  const tierDepts = allDeptTpls.length;
  console.log('\n──────────────────────────────────────────────');
  console.log('✅ Seed complete.');
  console.log(`   Agent templates (public):   ${agents}`);
  console.log(`   Department templates:       ${depts}`);
  console.log(`   ↳ Tier templates (FA page):  ${tierDepts}`);
  console.log(`   Tiers:                      ${tiers}`);
  console.log(`   Tier agent pool entries:    ${pools}`);
  console.log('──────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());