#!/usr/bin/env node
/**
 * seed-agency-agents.cjs
 *
 * Seeds the AI Employees Pool (AgentTemplate) and Departments Pool (DepartmentTemplate)
 * from the agency-agents-main catalog at:
 *   /home/najeeb/Linux-Dev/neurecore-2026/neurecore/Temp/agency-agents-main/
 *
 * Idempotent: uses upsert so re-running is safe.
 *
 * Run: node prisma/seed-agency-agents.cjs
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const AGENTS_DIR = '/home/najeeb/Linux-Dev/neurecore-2026/neurecore/Temp/agency-agents-main';

// ─── Frontmatter Parser ───────────────────────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const [, rawYaml, body] = match;
  const data = {};

  for (const line of rawYaml.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }

  return { data, body: body.trim() };
}

// ─── Slug Generator ─────────────────────────────────────────────────────────

function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── Agent Type Inference ───────────────────────────────────────────────────

function inferAgentType(name, description, body) {
  const text = `${name} ${description} ${body}`.toLowerCase();
  if (text.includes('chief') || text.includes('director') || text.includes('vp ') || text.includes('head of')) {
    return 'EXECUTIVE';
  }
  if (text.includes('meta') || text.includes('orchestrat')) {
    return 'META';
  }
  if (text.includes('core')) {
    return 'CORE';
  }
  return 'FUNCTIONAL';
}

// ─── Department folders to include ──────────────────────────────────────────

const VALID_DEPT_DIRS = new Set([
  'academic', 'accounting', 'administration', 'business-development',
  'business-intelligence', 'channel-management', 'cloud-operations',
  'communications', 'contract-management', 'corporate-development',
  'customer-success', 'database-administration', 'data-governance',
  'data-science', 'design', 'disaster-recovery', 'employment-law',
  'engineering', 'esg-sustainability', 'ethics', 'facilities',
  'field-operations', 'finance', 'fleet-management', 'game-development',
  'gis', 'government-relations', 'help-desk', 'human-resources',
  'investor-relations', 'it-infrastructure', 'legal', 'legal-operations',
  'marketing', 'network-operations', 'operations', 'order-management',
  'paid-media', 'pricing', 'procurement', 'product', 'product-management',
  'project-management', 'public-relations', 'quality-assurance', 'real-estate',
  'revenue-operations', 'risk-compliance', 'sales', 'security',
  'service-delivery', 'spatial-computing', 'specialized', 'strategy',
  'supply-chain', 'support', 'testing', 'vendor-management',
]);

// ─── Main ─────────────────────────────────────────────────────────────────

async function seedDepartments(agentsByDept) {
  console.log('\n── Seeding Department Templates');
  let count = 0;

  for (const [deptSlug, agents] of Object.entries(agentsByDept)) {
    const deptName = deptSlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    const structure = agents.map((a) => ({
      name: a.name,
      type: a.type,
      description: a.description,
    }));

    await prisma.departmentTemplate.upsert({
      where: { slug: deptSlug },
      create: {
        slug: deptSlug,
        name: deptName,
        description: `Department template for ${deptName} with ${agents.length} AI Employee${agents.length !== 1 ? 's' : ''}.`,
        structure,
        isPublic: true,
        category: 'enterprise',
        tags: ['agency-agents', deptSlug],
      },
      update: {
        name: deptName,
        description: `Department template for ${deptName} with ${agents.length} AI Employee${agents.length !== 1 ? 's' : ''}.`,
        structure,
        tags: ['agency-agents', deptSlug],
      },
    });
    count++;
  }

  console.log(`   ${count} department templates upserted`);
  return count;
}

async function seedAgents() {
  console.log('\n── Seeding AI Employee Templates');

  if (!fs.existsSync(AGENTS_DIR)) {
    console.warn(`   WARNING: Agents directory not found: ${AGENTS_DIR}`);
    return { deptCount: 0, agentCount: 0 };
  }

  const agentsByDept = {};
  const entries = fs.readdirSync(AGENTS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const deptDir = entry.name;
    if (!VALID_DEPT_DIRS.has(deptDir)) continue;

    const deptPath = path.join(AGENTS_DIR, deptDir);
    const files = fs.readdirSync(deptPath).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(deptPath, file);
      let content;
      try {
        content = fs.readFileSync(filePath, 'utf8');
      } catch {
        continue;
      }

      const parsed = parseFrontmatter(content);
      if (!parsed || !parsed.data.name) continue;

      const { data, body } = parsed;
      const name = data.name;
      const description = data.description || '';
      const type = inferAgentType(name, description, body);
      const systemPrompt = body;

      // Build a unique slug: dept-name (e.g. accounting-accounts-payable-specialist)
      const baseSlug = path.basename(file, '.md');
      const slug = `${deptDir}-${baseSlug}`;

      await prisma.agentTemplate.upsert({
        where: { id: slug }, // Using slug as id for idempotency
        create: {
          id: slug,
          name,
          description,
          type,
          model: 'gpt-4o-mini',
          systemPrompt,
          instructions: data.vibe ? `Your vibe: ${data.vibe}` : null,
          permissions: '[]',
          config: JSON.stringify({ color: data.color, emoji: data.emoji }),
          isPublic: true,
          version: '1.0.0',
          enabled: true,
        },
        update: {
          name,
          description,
          type,
          systemPrompt,
          instructions: data.vibe ? `Your vibe: ${data.vibe}` : null,
          config: JSON.stringify({ color: data.color, emoji: data.emoji }),
        },
      });

      if (!agentsByDept[deptDir]) agentsByDept[deptDir] = [];
      agentsByDept[deptDir].push({ name, type, description });
    }
  }

  const agentCount = Object.values(agentsByDept).flat().length;
  console.log(`   ${agentCount} AI employee templates upserted`);

  return { agentsByDept, agentCount };
}

async function main() {
  console.log('========================================');
  console.log('Seeding AI Employees & Departments from agency-agents-main');
  console.log('========================================');

  const { agentsByDept, agentCount } = await seedAgents();
  await seedDepartments(agentsByDept);

  console.log('\n========================================');
  console.log(`Done. Total agents seeded: ${agentCount}`);
  console.log('========================================\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
