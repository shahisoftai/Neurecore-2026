#!/usr/bin/env node
/**
 * backfill-project-type-templates.cjs
 *
 * Backfills goalTemplate + roleTemplate on ProjectTypeVersion rows that have
 * empty templates. Without these templates, the post-creation automation
 * pipeline (Chief of Staff, AI employees, goal seeding, task decomposition)
 * has nothing to spawn — see pending-tasks.md D29.
 *
 * Each industry gets:
 *   - a canonical set of goals (e.g. for tax: "Gather source documents",
 *     "Prepare draft return", "Review with partner", "Client sign-off")
 *   - a canonical set of roles (e.g. Project Manager, Reviewer, Compliance
 *     Officer, Client Liaison) — these map to public AgentTemplates by
 *     agentType so role-template-spawn can find them.
 *
 * This is a one-shot backfill. It is idempotent — running it again on a row
 * whose goalTemplate/roleTemplate is non-empty is a no-op.
 *
 * Flags:
 *   --check      Dry run; prints rows that would change.
 *   --verbose    Log every row.
 *
 * Reads DATABASE_URL from `backend/.env.production` (falls back to .env).
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

// ── Canonical role + goal templates per industry ────────────────────────────
// agentType strings are looked up against AgentTemplate by:
//   1. Exact match in Prisma AgentType enum (CORE | FUNCTIONAL | EXECUTIVE | META)
//   2. Case-insensitive name match against AgentTemplate.name
// See role-template.service.ts → findTemplateByAgentType for full resolution logic.
// All template names below were verified to exist in the live DB
// (queried 2026-07-19 from the agency-agents catalogue of 722 public templates).

const TEMPLATES = {
  'financial-services': {
    roles: [
      { role: 'Project Manager', agentType: 'Senior Project Manager' },
      { role: 'Reviewer', agentType: 'Code Reviewer' },
      { role: 'Compliance Officer', agentType: 'Contract Compliance Specialist' },
      { role: 'Client Liaison', agentType: 'Account Manager' },
      { role: 'Documentation Lead', agentType: 'knowledge-base-specialist' },
    ],
    goals: [
      { title: 'Engagement scoping & partner sign-off', measurableCriteria: 'Signed engagement letter on file' },
      { title: 'Information gathering', measurableCriteria: 'All required source documents collected from client' },
      { title: 'Draft preparation', measurableCriteria: 'First draft completed and reviewed internally' },
      { title: 'Client review and approval', measurableCriteria: 'Client confirms draft is acceptable' },
      { title: 'Final delivery and closure', measurableCriteria: 'Deliverable signed off and archived' },
    ],
  },
  'legal': {
    roles: [
      { role: 'Project Manager', agentType: 'Senior Project Manager' },
      { role: 'Reviewer', agentType: 'Code Reviewer' },
      { role: 'Compliance Officer', agentType: 'Contract Compliance Specialist' },
      { role: 'Client Liaison', agentType: 'Account Manager' },
    ],
    goals: [
      { title: 'Matter intake and conflict check', measurableCriteria: 'Engagement letter and conflict check completed' },
      { title: 'Legal research and analysis', measurableCriteria: 'Research memo delivered' },
      { title: 'Drafting', measurableCriteria: 'Draft document produced' },
      { title: 'Review and partner sign-off', measurableCriteria: 'Partner has approved the work product' },
      { title: 'Filing or delivery', measurableCriteria: 'Document filed with the relevant authority or delivered to client' },
    ],
  },
  'marketing-advertising': {
    roles: [
      { role: 'Project Manager', agentType: 'Senior Project Manager' },
      { role: 'Creative Director', agentType: 'Chief Marketing Officer' },
      { role: 'Reviewer', agentType: 'Code Reviewer' },
      { role: 'Client Liaison', agentType: 'Account Manager' },
    ],
    goals: [
      { title: 'Campaign brief and objectives', measurableCriteria: 'Approved creative brief' },
      { title: 'Creative development', measurableCriteria: 'Concepts presented to client' },
      { title: 'Production and delivery', measurableCriteria: 'Final assets delivered' },
      { title: 'Launch and performance tracking', measurableCriteria: 'Campaign live with tracking in place' },
    ],
  },
  'construction-engineering-infrastructure': {
    roles: [
      { role: 'Project Manager', agentType: 'Facilities Project Manager' },
      { role: 'Quality Lead', agentType: 'Quality Assurance & Continuous Improvement Director' },
      { role: 'Compliance Officer', agentType: 'Contract Compliance Specialist' },
      { role: 'Documentation Lead', agentType: 'knowledge-base-specialist' },
    ],
    goals: [
      { title: 'Design and engineering', measurableCriteria: 'Approved design package' },
      { title: 'Permitting and approvals', measurableCriteria: 'All permits secured' },
      { title: 'Construction execution', measurableCriteria: 'Construction milestones achieved' },
      { title: 'Commissioning and handover', measurableCriteria: 'Facility commissioned and accepted' },
    ],
  },
  'healthcare-life-sciences': {
    roles: [
      { role: 'Project Manager', agentType: 'Senior Project Manager' },
      { role: 'Compliance Officer', agentType: 'Contract Compliance Specialist' },
      { role: 'Reviewer', agentType: 'Code Reviewer' },
      { role: 'Documentation Lead', agentType: 'knowledge-base-specialist' },
    ],
    goals: [
      { title: 'Protocol design and IRB/ethics approval', measurableCriteria: 'IRB approval secured' },
      { title: 'Data collection', measurableCriteria: 'Data collection period complete' },
      { title: 'Analysis and reporting', measurableCriteria: 'Analysis complete' },
      { title: 'Regulatory submission (if applicable)', measurableCriteria: 'Submission accepted' },
    ],
  },
  'technology-software': {
    roles: [
      { role: 'Project Manager', agentType: 'Senior Project Manager' },
      { role: 'Research Lead', agentType: 'Investment Researcher' },
      { role: 'Quality Lead', agentType: 'Quality Assurance & Continuous Improvement Director' },
      { role: 'Reviewer', agentType: 'Code Reviewer' },
    ],
    goals: [
      { title: 'Discovery and design', measurableCriteria: 'Approved design spec' },
      { title: 'Implementation', measurableCriteria: 'Code complete and merged' },
      { title: 'Testing and QA', measurableCriteria: 'All tests passing, QA sign-off' },
      { title: 'Release and monitoring', measurableCriteria: 'Released to production with monitoring' },
    ],
  },
  'education-research': {
    roles: [
      { role: 'Project Manager', agentType: 'Senior Project Manager' },
      { role: 'Research Lead', agentType: 'Investment Researcher' },
      { role: 'Documentation Lead', agentType: 'knowledge-base-specialist' },
    ],
    goals: [
      { title: 'Research question and literature review', measurableCriteria: 'Literature review complete' },
      { title: 'Methodology design', measurableCriteria: 'Approved methodology' },
      { title: 'Data collection and analysis', measurableCriteria: 'Data analyzed' },
      { title: 'Publication or final report', measurableCriteria: 'Final report published' },
    ],
  },
  'energy-utilities-natural-resources': {
    roles: [
      { role: 'Project Manager', agentType: 'Facilities Project Manager' },
      { role: 'Compliance Officer', agentType: 'Contract Compliance Specialist' },
      { role: 'Quality Lead', agentType: 'Quality Assurance & Continuous Improvement Director' },
    ],
    goals: [
      { title: 'Permitting and regulatory review', measurableCriteria: 'All permits secured' },
      { title: 'Engineering and design', measurableCriteria: 'Approved design' },
      { title: 'Construction and commissioning', measurableCriteria: 'Asset operational' },
    ],
  },
  'agriculture-food-systems': {
    roles: [
      { role: 'Project Manager', agentType: 'Facilities Project Manager' },
      { role: 'Compliance Officer', agentType: 'Contract Compliance Specialist' },
    ],
    goals: [
      { title: 'Production planning', measurableCriteria: 'Production plan approved' },
      { title: 'Execution and monitoring', measurableCriteria: 'Cycle executed within planned window' },
      { title: 'Harvest and delivery', measurableCriteria: 'Product delivered to buyer' },
    ],
  },
  'manufacturing-industrial': {
    roles: [
      { role: 'Project Manager', agentType: 'Facilities Project Manager' },
      { role: 'Quality Lead', agentType: 'Quality Assurance & Continuous Improvement Director' },
      { role: 'Documentation Lead', agentType: 'knowledge-base-specialist' },
    ],
    goals: [
      { title: 'Production setup', measurableCriteria: 'Production line configured' },
      { title: 'Production run', measurableCriteria: 'Units produced within tolerance' },
      { title: 'Quality assurance and shipping', measurableCriteria: 'QA passed, product shipped' },
    ],
  },
  'professional-services-consulting': {
    roles: [
      { role: 'Project Manager', agentType: 'Senior Project Manager' },
      { role: 'Reviewer', agentType: 'Code Reviewer' },
      { role: 'Client Liaison', agentType: 'Account Manager' },
    ],
    goals: [
      { title: 'Engagement scoping', measurableCriteria: 'Scope and SOW signed' },
      { title: 'Discovery and analysis', measurableCriteria: 'Analysis delivered' },
      { title: 'Recommendations and roadmap', measurableCriteria: 'Recommendations presented to client' },
      { title: 'Implementation support', measurableCriteria: 'Client accepts recommendations' },
    ],
  },
  'nonprofit-public-sector': {
    roles: [
      { role: 'Project Manager', agentType: 'Senior Project Manager' },
      { role: 'Compliance Officer', agentType: 'Contract Compliance Specialist' },
      { role: 'Documentation Lead', agentType: 'knowledge-base-specialist' },
    ],
    goals: [
      { title: 'Stakeholder alignment', measurableCriteria: 'Key stakeholders signed off on approach' },
      { title: 'Program design and approval', measurableCriteria: 'Program approved by oversight body' },
      { title: 'Execution and reporting', measurableCriteria: 'Milestones met and reports filed' },
    ],
  },
  'real-estate-property': {
    roles: [
      { role: 'Project Manager', agentType: 'Facilities Project Manager' },
      { role: 'Compliance Officer', agentType: 'Contract Compliance Specialist' },
      { role: 'Documentation Lead', agentType: 'knowledge-base-specialist' },
    ],
    goals: [
      { title: 'Acquisition and due diligence', measurableCriteria: 'Due diligence complete' },
      { title: 'Closing and documentation', measurableCriteria: 'Closing complete' },
      { title: 'Operations or disposition', measurableCriteria: 'Asset operational or sold' },
    ],
  },
  'retail-ecommerce': {
    roles: [
      { role: 'Project Manager', agentType: 'Senior Project Manager' },
      { role: 'Client Liaison', agentType: 'Account Manager' },
    ],
    goals: [
      { title: 'Campaign planning', measurableCriteria: 'Plan approved' },
      { title: 'Launch and execution', measurableCriteria: 'Campaign live' },
      { title: 'Performance review', measurableCriteria: 'KPIs reviewed with stakeholders' },
    ],
  },
  'media-entertainment': {
    roles: [
      { role: 'Project Manager', agentType: 'Senior Project Manager' },
      { role: 'Creative Director', agentType: 'Chief Marketing Officer' },
      { role: 'Reviewer', agentType: 'Code Reviewer' },
    ],
    goals: [
      { title: 'Pre-production', measurableCriteria: 'Production plan approved' },
      { title: 'Production', measurableCriteria: 'Production complete' },
      { title: 'Post-production and release', measurableCriteria: 'Released to audience' },
    ],
  },
  'logistics-transportation': {
    roles: [
      { role: 'Project Manager', agentType: 'Facilities Project Manager' },
      { role: 'Documentation Lead', agentType: 'knowledge-base-specialist' },
    ],
    goals: [
      { title: 'Route and carrier planning', measurableCriteria: 'Plan approved' },
      { title: 'Execution and tracking', measurableCriteria: 'Shipment delivered on time' },
      { title: 'Reconciliation and reporting', measurableCriteria: 'Reconciliation complete' },
    ],
  },
  'hospitality-tourism': {
    roles: [
      { role: 'Project Manager', agentType: 'Senior Project Manager' },
      { role: 'Client Liaison', agentType: 'Account Manager' },
    ],
    goals: [
      { title: 'Event or program planning', measurableCriteria: 'Plan approved' },
      { title: 'Execution', measurableCriteria: 'Event executed successfully' },
      { title: 'Wrap-up and reporting', measurableCriteria: 'Stakeholders debriefed' },
    ],
  },
  'government-public-administration': {
    roles: [
      { role: 'Project Manager', agentType: 'Senior Project Manager' },
      { role: 'Compliance Officer', agentType: 'Contract Compliance Specialist' },
      { role: 'Documentation Lead', agentType: 'knowledge-base-specialist' },
      { role: 'Reviewer', agentType: 'Code Reviewer' },
    ],
    goals: [
      { title: 'Policy or program definition', measurableCriteria: 'Approved by oversight body' },
      { title: 'Implementation', measurableCriteria: 'Milestones achieved' },
      { title: 'Audit and reporting', measurableCriteria: 'Audit complete' },
    ],
  },
};

// Catch-all for unknown industries
const FALLBACK = {
  roles: [
    { role: 'Project Manager', agentType: 'Senior Project Manager' },
    { role: 'Reviewer', agentType: 'Code Reviewer' },
    { role: 'Documentation Lead', agentType: 'knowledge-base-specialist' },
  ],
  goals: [
    { title: 'Scoping and kickoff', measurableCriteria: 'Scope and approach approved' },
    { title: 'Execution', measurableCriteria: 'Work product delivered' },
    { title: 'Review and closure', measurableCriteria: 'Stakeholders signed off' },
  ],
};

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const types = await prisma.projectType.findMany({
    where: { tenantId: null, isSystem: true },
    select: {
      id: true,
      name: true,
      industry: true,
      versions: {
        select: { id: true, version: true, goalTemplate: true, roleTemplate: true },
        orderBy: { version: 'asc' },
      },
    },
  });
  console.log(`Found ${types.length} system project types`);

  let updated = 0;
  let skipped = 0;
  for (const t of types) {
    const tpl = TEMPLATES[t.industry] ?? FALLBACK;
    for (const v of t.versions) {
      // Always overwrite — previous backfill used agentType strings that
      // didn't match any AgentTemplate (e.g. "project-manager" instead of
      // "Senior Project Manager"). The new values use real template names.
      const nextGoals = tpl.goals;
      const nextRoles = tpl.roles;
      const goalsMatch = jsonEqual(v.goalTemplate, nextGoals);
      const rolesMatch = jsonEqual(v.roleTemplate, nextRoles);
      if (goalsMatch && rolesMatch) {
        skipped += 1;
        if (VERBOSE) console.log(`   = skip ${t.name} v${v.version} (already current)`);
        continue;
      }
      if (DRY_RUN) {
        console.log(`   ~ would update ${t.name} v${v.version}: goals=${nextGoals.length} roles=${nextRoles.length}`);
        updated += 1;
      } else {
        await prisma.projectTypeVersion.update({
          where: { id: v.id },
          data: { goalTemplate: nextGoals, roleTemplate: nextRoles },
        });
        if (VERBOSE) console.log(`   + updated ${t.name} v${v.version}: goals=${nextGoals.length} roles=${nextRoles.length}`);
        updated += 1;
      }
    }
  }
  console.log(`\n   ✓ done. updated=${updated} skipped=${skipped} (dryRun=${DRY_RUN})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
