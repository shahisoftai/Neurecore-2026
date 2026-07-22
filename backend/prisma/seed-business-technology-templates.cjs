#!/usr/bin/env node
/**
 * seed-business-technology-templates.cjs
 *
 * Stage 1 Phase 1B — Seeds system-level tenant templates (tenantId = null)
 * for the Business & Technology industry group.
 *
 * IDEMPOTENT: upsert keyed on (tenantId=null, slug, templateType).
 * Safe to run multiple times.
 *
 * Run: node prisma/seed-business-technology-templates.cjs
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
    slug: 'tech-client-lifecycle',
    name: 'Technology Services Client Lifecycle',
    description: 'Client lifecycle for tech firms: prospect → RFP → contracted → delivery → support → renewal/churn',
    industrySlug: 'technology-digital-services',
    config: {
      stages: [
        { key: 'prospect', label: 'Prospect', order: 1 },
        { key: 'rfp-vendor', label: 'RFP Vendor', order: 2 },
        { key: 'contracted', label: 'Contracted', order: 3 },
        { key: 'active-delivery', label: 'Active Delivery', order: 4 },
        { key: 'support', label: 'Support', order: 5 },
        { key: 'renewal-churn', label: 'Renewal / Churn', order: 6 },
      ],
      defaultStage: 'prospect',
      customerFieldDefinitions: [
        { key: 'clientType', label: 'Client Type', type: 'enum', options: ['Startup', 'SME', 'Enterprise', 'Government'] },
        { key: 'techStack', label: 'Technology Stack', type: 'text' },
        { key: 'contractValue', label: 'Contract Value', type: 'number' },
        { key: 'slaTier', label: 'SLA Tier', type: 'enum', options: ['Basic', 'Standard', 'Premium', 'Custom'] },
      ],
    },
  },
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'professional-client-lifecycle',
    name: 'Professional Services Client Lifecycle',
    description: 'Client lifecycle for professional services: prospect → proposal → engaged → delivery → complete → retained/referral',
    industrySlug: 'professional-business-services',
    config: {
      stages: [
        { key: 'prospect', label: 'Prospect', order: 1 },
        { key: 'proposal-accepted', label: 'Proposal Accepted', order: 2 },
        { key: 'engaged', label: 'Engaged', order: 3 },
        { key: 'delivery', label: 'Delivery', order: 4 },
        { key: 'completed', label: 'Completed', order: 5 },
        { key: 'retained-referral', label: 'Retained / Referral', order: 6 },
      ],
      defaultStage: 'prospect',
      customerFieldDefinitions: [
        { key: 'clientType', label: 'Client Type', type: 'enum', options: ['Startup', 'SME', 'Corporate', 'Non-Profit'] },
        { key: 'serviceLine', label: 'Service Line', type: 'enum', options: ['Consulting', 'Legal', 'Real Estate', 'Recruiting', 'Marketing'] },
        { key: 'engagementSize', label: 'Engagement Size', type: 'enum', options: ['Small', 'Medium', 'Large', 'Enterprise'] },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'tech-project-manager',
    name: 'Technical Project Manager',
    description: 'Project manager for technology services',
    industrySlug: 'technology-digital-services',
    config: {
      systemPrompt: 'You are a Technical Project Manager for a technology services company.\nYour role: project planning, timeline tracking, stakeholder updates, risk management.\nTrack sprint velocity, manage dependencies, ensure on-time delivery. Flag risks early.',
      kpis: [
        { name: 'On-time delivery', target: '95%' },
        { name: 'Sprint velocity', target: 'Stable or increasing' },
        { name: 'Stakeholder satisfaction', target: '4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'technical-lead',
    name: 'Technical Lead',
    description: 'Technical lead for technology services',
    industrySlug: 'technology-digital-services',
    config: {
      systemPrompt: 'You are a Technical Lead for a technology services company.\nYour role: technical direction, architecture decisions, code review, engineering standards.\nEnsure technical quality. Mentor engineers. Drive best practices. Own the tech roadmap.',
      kpis: [
        { name: 'Code review turnaround', target: '< 24 hours' },
        { name: 'Technical debt ratio', target: '< 15%' },
        { name: 'System uptime', target: '99.9%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'qa-engineer',
    name: 'QA Engineer',
    description: 'Quality assurance engineer for technology services',
    industrySlug: 'technology-digital-services',
    config: {
      systemPrompt: 'You are a QA Engineer for a technology services company.\nYour role: test planning, execution, defect tracking, release readiness.\nWrite comprehensive test cases. Automate regression tests. Ensure quality gates are met.',
      kpis: [
        { name: 'Defect escape rate', target: '< 2%' },
        { name: 'Test coverage', target: '> 80%' },
        { name: 'Release readiness', target: '100% on time' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'devops-specialist',
    name: 'DevOps Specialist',
    description: 'DevOps specialist for technology services',
    industrySlug: 'technology-digital-services',
    config: {
      systemPrompt: 'You are a DevOps Specialist for a technology services company.\nYour role: infrastructure management, CI/CD pipelines, monitoring, incident response.\nMaintain deployment reliability. Automate operations. Respond to incidents within SLA.',
      kpis: [
        { name: 'Deployment frequency', target: 'Daily' },
        { name: 'Mean time to recovery', target: '< 1 hour' },
        { name: 'Infrastructure cost efficiency', target: 'Optimize monthly' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'client-success-manager',
    name: 'Client Success Manager',
    description: 'Client success manager for technology services',
    industrySlug: 'technology-digital-services',
    config: {
      systemPrompt: 'You are a Client Success Manager for a technology services company.\nYour role: relationship management, satisfaction tracking, renewal efforts, expansion opportunities.\nMonitor client health scores. Proactively address concerns. Drive retention and upsell.',
      kpis: [
        { name: 'Client retention rate', target: '95%' },
        { name: 'NPS score', target: '> 50' },
        { name: 'Expansion revenue', target: '> 10% YoY' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'engagement-manager',
    name: 'Engagement Manager',
    description: 'Engagement manager for professional services',
    industrySlug: 'professional-business-services',
    config: {
      systemPrompt: 'You are an Engagement Manager for a professional services firm.\nYour role: scope management, timeline oversight, budget tracking, client satisfaction.\nManage client expectations. Track deliverables. Ensure profitability. Build long-term relationships.',
      kpis: [
        { name: 'Engagement margin', target: '> 30%' },
        { name: 'On-time delivery', target: '95%' },
        { name: 'Client satisfaction', target: '4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'subject-matter-expert',
    name: 'Subject Matter Expert',
    description: 'Subject matter expert for professional services',
    industrySlug: 'professional-business-services',
    config: {
      systemPrompt: 'You are a Subject Matter Expert for a professional services firm.\nYour role: technical delivery, analysis, recommendations, quality assurance.\nDeliver expert insights. Ensure work quality. Mentor junior consultants. Stay current on industry trends.',
      kpis: [
        { name: 'Deliverable quality', target: '> 95% acceptance' },
        { name: 'Utilization rate', target: '> 75%' },
        { name: 'Knowledge contributions', target: '2 per quarter' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'research-specialist',
    name: 'Research Specialist',
    description: 'Research specialist for professional services',
    industrySlug: 'professional-business-services',
    config: {
      systemPrompt: 'You are a Research Specialist for a professional services firm.\nYour role: market research, competitor analysis, data gathering, methodology documentation.\nProduce rigorous research. Cite sources. Present findings clearly. Support client deliverables.',
      kpis: [
        { name: 'Research turnaround', target: '< 3 days' },
        { name: 'Source quality', target: '100% verified' },
        { name: 'Client feedback', target: 'Positive' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'operations-coordinator',
    name: 'Operations Coordinator',
    description: 'Operations coordinator for professional services',
    industrySlug: 'professional-business-services',
    config: {
      systemPrompt: 'You are an Operations Coordinator for a professional services firm.\nYour role: timeline management, budget tracking, billing coordination, approvals.\nKeep projects on track. Track hours and expenses. Ensure timely billing. Coordinate resources.',
      kpis: [
        { name: 'Billing accuracy', target: '99%' },
        { name: 'Invoice turnaround', target: '< 5 days' },
        { name: 'Resource utilization', target: '> 70%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'business-development',
    name: 'Business Development Manager',
    description: 'Business development for professional services',
    industrySlug: 'professional-business-services',
    config: {
      systemPrompt: 'You are a Business Development Manager for a professional services firm.\nYour role: prospect qualification, proposal development, pricing strategy, closing.\nBuild pipeline. Qualify leads. Develop winning proposals. Track conversion metrics.',
      kpis: [
        { name: 'Proposal win rate', target: '> 40%' },
        { name: 'Pipeline value', target: '> 3x revenue target' },
        { name: 'Time-to-proposal', target: '< 5 days' },
      ],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-ticket-triage',
    name: 'Daily Support Ticket Triage',
    description: 'Auto-triage incoming support tickets by severity and assign',
    industrySlug: 'technology-digital-services',
    config: {
      trigger: 'time: 8:00 AM daily',
      action: 'Triage all unassigned support tickets by severity and SLA tier, assign to appropriate team members',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-release-status',
    name: 'Weekly Release Status Summary',
    description: 'Weekly summary of features in flight and deployment status',
    industrySlug: 'technology-digital-services',
    config: {
      trigger: 'time: Monday 9:00 AM',
      action: 'Generate release status report: features in development, testing, ready for deployment, and deployed',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'monthly-sla-review',
    name: 'Monthly SLA Compliance Review',
    description: 'Review SLA compliance metrics and flag breaches',
    industrySlug: 'technology-digital-services',
    config: {
      trigger: 'time: 1st of month 9:00 AM',
      action: 'Review all SLA metrics for the past month. Flag any breaches. Generate compliance report.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-timesheet-reminder',
    name: 'Daily Timesheet Submission Reminder',
    description: 'Remind consultants to submit their timesheets',
    industrySlug: 'professional-business-services',
    config: {
      trigger: 'time: 4:30 PM daily',
      action: 'Remind all consultants to submit timesheets for the day. Flag any missing entries.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-engagement-review',
    name: 'Weekly Engagement Health Check',
    description: 'Weekly review of active engagements for scope/budget/timeline health',
    industrySlug: 'professional-business-services',
    config: {
      trigger: 'time: Friday 3:00 PM',
      action: 'Review all active engagements: budget burn rate, timeline status, scope changes. Flag at-risk engagements.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'monthly-billing-check',
    name: 'Monthly Billing Accuracy Check',
    description: 'Verify billing accuracy across all active engagements',
    industrySlug: 'professional-business-services',
    config: {
      trigger: 'time: 25th of month 9:00 AM',
      action: 'Review all unbilled hours and expenses. Verify billing rates. Flag discrepancies for review.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'REPORT',
    slug: 'project-velocity-dashboard',
    name: 'Project Velocity & Sprint Dashboard',
    description: 'Sprint velocity, burndown, and delivery metrics for technology projects',
    industrySlug: 'technology-digital-services',
    config: {
      metrics: ['storyPointsCompleted', 'sprintVelocity', 'burndownRate', 'commitmentReliability', 'cycleTime'],
      period: 'weekly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'sla-compliance-report',
    name: 'SLA Compliance Report',
    description: 'SLA compliance metrics across all client contracts',
    industrySlug: 'technology-digital-services',
    config: {
      metrics: ['slaBreaches', 'meanTimeToResolve', 'firstResponseTime', 'customerSatisfaction', 'escalationRate'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'resource-utilization',
    name: 'Resource Utilization Report',
    description: 'Engineering resource utilization and capacity planning',
    industrySlug: 'technology-digital-services',
    config: {
      metrics: ['utilizationRate', 'billableHours', 'nonBillableHours', 'capacityGap', 'overtimeRate'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'engagement-profitability',
    name: 'Engagement Profitability Report',
    description: 'Profitability analysis per engagement for professional services',
    industrySlug: 'professional-business-services',
    config: {
      metrics: ['grossMargin', 'revenueRealized', 'costOfDelivery', 'utilizationRate', 'writeOffPercentage'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'pipeline-analytics',
    name: 'Pipeline & Win Rate Analytics',
    description: 'Sales pipeline health and proposal win rate analysis',
    industrySlug: 'professional-business-services',
    config: {
      metrics: ['pipelineValue', 'winRate', 'averageDealSize', 'salesCycleLength', 'proposalCount'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'sprint-planning',
    name: 'Sprint Planning & Setup',
    description: 'Standard sprint planning workflow for tech teams',
    industrySlug: 'technology-digital-services',
    config: {
      description: 'Plan and set up a new sprint: backlog grooming, estimation, capacity planning, sprint goal definition',
      estimatedDuration: '1 day',
      assignToRole: 'tech-project-manager',
      subtasks: [
        'Groom and prioritize backlog items',
        'Estimate story points for each item',
        'Calculate team capacity for the sprint',
        'Define sprint goal',
        'Assign stories to team members',
        'Create sprint board',
        'Schedule daily standups',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'code-review-checklist',
    name: 'Code Review Checklist',
    description: 'Standard code review process for pull requests',
    industrySlug: 'technology-digital-services',
    config: {
      description: 'Review a pull request: code quality, testing, security, performance, documentation',
      estimatedDuration: '2 hours',
      assignToRole: 'technical-lead',
      subtasks: [
        'Review code for correctness and clarity',
        'Check test coverage and quality',
        'Verify security best practices',
        'Review performance implications',
        'Check documentation and comments',
        'Approve or request changes',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'deployment-checklist',
    name: 'Production Deployment Checklist',
    description: 'Standard deployment checklist for production releases',
    industrySlug: 'technology-digital-services',
    config: {
      description: 'Execute a production deployment: pre-deploy checks, deployment, post-deploy verification',
      estimatedDuration: '4 hours',
      assignToRole: 'devops-specialist',
      subtasks: [
        'Verify all tests pass on staging',
        'Create deployment plan and rollback strategy',
        'Backup current production state',
        'Execute deployment',
        'Run smoke tests',
        'Monitor error rates and performance for 1 hour',
        'Update deployment log',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'incident-response',
    name: 'Incident Response Procedure',
    description: 'Standard incident response workflow',
    industrySlug: 'technology-digital-services',
    config: {
      description: 'Respond to a production incident: triage, mitigation, root cause analysis, post-mortem',
      estimatedDuration: '1 day',
      assignToRole: 'devops-specialist',
      subtasks: [
        'Acknowledge and classify incident severity',
        'Notify affected stakeholders',
        'Mitigate immediate impact',
        'Investigate root cause',
        'Implement fix',
        'Verify resolution',
        'Write post-mortem report',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'proposal-preparation',
    name: 'Proposal Preparation',
    description: 'Prepare a client proposal or RFP response',
    industrySlug: 'professional-business-services',
    config: {
      description: 'Prepare a comprehensive client proposal: research, scoping, pricing, presentation',
      estimatedDuration: '5 days',
      assignToRole: 'business-development',
      subtasks: [
        'Research client and competitive landscape',
        'Define scope and deliverables',
        'Develop pricing model',
        'Draft proposal document',
        'Internal quality review',
        'Prepare presentation deck',
        'Submit proposal and schedule follow-up',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'engagement-kickoff',
    name: 'Engagement Kickoff',
    description: 'Standard engagement kickoff process',
    industrySlug: 'professional-business-services',
    config: {
      description: 'Kick off a new client engagement: team setup, stakeholder alignment, project plan',
      estimatedDuration: '2 days',
      assignToRole: 'engagement-manager',
      subtasks: [
        'Assemble project team',
        'Set up project workspace and tools',
        'Schedule kickoff meeting with client',
        'Define communication cadence',
        'Create detailed project plan',
        'Set up time tracking and billing',
        'Send welcome package to client',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'deliverable-review',
    name: 'Deliverable Review & QA',
    description: 'Quality review process for client deliverables',
    industrySlug: 'professional-business-services',
    config: {
      description: 'Review a client deliverable: quality check, peer review, formatting, client readiness',
      estimatedDuration: '2 days',
      assignToRole: 'subject-matter-expert',
      subtasks: [
        'Review deliverable against scope and quality standards',
        'Peer review by another SME',
        'Check formatting, citations, and presentation',
        'Address review comments',
        'Prepare executive summary',
        'Final sign-off by engagement manager',
        'Package for client delivery',
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'tech-dept-structure',
    name: 'Technology Services Department Structure',
    description: 'Default department structure for technology services firms',
    industrySlug: 'technology-digital-services',
    config: {
      departments: [
        { name: 'Engineering', roles: ['Technical Lead', 'Software Engineer', 'Frontend Engineer', 'Backend Engineer'] },
        { name: 'Quality Assurance', roles: ['QA Engineer', 'Test Automation Engineer'] },
        { name: 'DevOps', roles: ['DevOps Specialist', 'Site Reliability Engineer'] },
        { name: 'Product', roles: ['Product Manager', 'UX Designer', 'Business Analyst'] },
        { name: 'Client Success', roles: ['Client Success Manager', 'Account Manager', 'Support Engineer'] },
        { name: 'Administration', roles: ['Office Manager', 'Executive Assistant'] },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'professional-dept-structure',
    name: 'Professional Services Department Structure',
    description: 'Default department structure for professional services firms',
    industrySlug: 'professional-business-services',
    config: {
      departments: [
        { name: 'Consulting', roles: ['Engagement Manager', 'Subject Matter Expert', 'Consultant', 'Analyst'] },
        { name: 'Research', roles: ['Research Specialist', 'Data Analyst'] },
        { name: 'Operations', roles: ['Operations Coordinator', 'Project Coordinator', 'Billing Specialist'] },
        { name: 'Business Development', roles: ['Business Development Manager', 'Proposal Writer'] },
        { name: 'Administration', roles: ['Office Manager', 'Executive Assistant'] },
      ],
    },
  },
];

async function seedTemplates() {
  console.log(`\nSeed Business & Technology templates — ${DRY_RUN ? 'DRY RUN (checking only)' : 'WRITING to database'}\n`);

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
