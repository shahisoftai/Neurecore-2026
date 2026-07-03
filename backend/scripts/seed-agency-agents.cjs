#!/usr/bin/env node
/**
 * Seed Departments + Agent pool from agency-agents-main.
 *
 * - Reads divisions.json + every *.md agent file under each division dir.
 * - Upserts 16 Departments (icon/color from divisions.json) for the target tenant.
 * - Upserts 1 Agent per *.md file, linked to its department.
 * - Stores the full MD body as `systemPrompt` and frontmatter metadata as `metadata`.
 * - Idempotent: re-running updates name/description/systemPrompt/metadata; no duplicates.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/seed-agency-agents.cjs                     # demo tenant
 *   DATABASE_URL=... node scripts/seed-agency-agents.cjs <tenantSlug>        # any tenant
 *   node scripts/seed-agency-agents.cjs --dry-run                            # preview only
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Auto-load DATABASE_URL from backend/.env.development if not provided.
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '..', '.env.development');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

const SOURCE_ROOT =
  process.env.AGENCY_AGENTS_DIR ||
  path.resolve(__dirname, '..', '..', 'Temp', 'agency-agents-main');

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TENANT_SLUG = args.find(a => !a.startsWith('--')) || 'demo';

function fail(msg) {
  console.error(`[seed] ${msg}`);
  process.exit(1);
}

function parseFrontmatter(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: md };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (v.startsWith('#') && /^[0-9A-Fa-f]{6}$/.test(v)) {
      meta[kv[1]] = v.toUpperCase();
    } else {
      meta[kv[1]] = v;
    }
  }
  return { meta, body: m[2].trim() };
}

function listAgentFiles(divKey, divPath) {
  if (!fs.existsSync(divPath)) return [];
  return fs
    .readdirSync(divPath)
    .filter(f => {
      if (!f.endsWith('.md')) return false;
      if (f.toLowerCase() === 'readme.md') return false;
      // Prefer files starting with the division key (e.g. engineering-…); fall back to any .md.
      return true;
    })
    .map(f => path.join(divPath, f));
}

async function loadDivisions() {
  const divisionsJson = JSON.parse(
    fs.readFileSync(path.join(SOURCE_ROOT, 'divisions.json'), 'utf8'),
  );
  const divisions = divisionsJson.divisions;
  const result = [];
  for (const [key, meta] of Object.entries(divisions)) {
    const dir = path.join(SOURCE_ROOT, key);
    const files = listAgentFiles(key, dir);
    if (!files.length) continue;
    result.push({ key, label: meta.label, icon: meta.icon, color: meta.color, files });
  }
  return result;
}

async function getTargetTenant() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) fail(`Tenant with slug '${TENANT_SLUG}' not found. Create it first (make-demo-tenant.cjs).`);
  return tenant;
}

async function getOwnerUser(tenantId) {
  const owner = await prisma.user.findFirst({
    where: { tenantId },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
  return owner;
}

function summarize(meta, max = 180) {
  const d = (meta.description || '').replace(/\s+/g, ' ').trim();
  return d.length > max ? d.slice(0, max - 1) + '…' : d;
}

// Department table has no deterministic unique key (uuid PK), so dedupe on (tenantId, name).
async function resolveDepartment(tenant, div) {
  const existing = await prisma.department.findFirst({
    where: { tenantId: tenant.id, name: div.label },
  });
  if (existing) {
    return prisma.department.update({
      where: { id: existing.id },
      data: {
        description: `${div.label} division — seeded from agency-agents-main (${div.files.length} agents).`,
        status: 'ACTIVE',
        metadata: {
          source: 'agency-agents-main',
          sourceKey: div.key,
          lucideIcon: div.icon,
          color: div.color,
          agentCount: div.files.length,
        },
      },
    });
  }
  return prisma.department.create({
    data: {
      name: div.label,
      description: `${div.label} division — seeded from agency-agents-main (${div.files.length} agents).`,
      status: 'ACTIVE',
      tenantId: tenant.id,
      metadata: {
        source: 'agency-agents-main',
        sourceKey: div.key,
        lucideIcon: div.icon,
        color: div.color,
        agentCount: div.files.length,
      },
    },
  });
}

async function upsertAgent({ tenant, owner, department, file }) {
  const raw = fs.readFileSync(file, 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const name = meta.name || path.basename(file, '.md');
  const description = summarize(meta);

  const existing = await prisma.agent.findFirst({
    where: {
      tenantId: tenant.id,
      name,
      departmentId: department.id,
    },
    select: { id: true },
  });

  const data = {
    name,
    description,
    type: 'FUNCTIONAL',
    status: 'IDLE',
    model: 'gpt-4o-mini',
    systemPrompt: body,
    instructions: meta.vibe || null,
    budgetPerDay: 5,
    permissions: [],
    config: {},
    metadata: {
      source: 'agency-agents-main',
      sourceDivision: department.metadata?.sourceKey || null,
      sourceFile: path.relative(SOURCE_ROOT, file).replace(/\\/g, '/'),
      color: meta.color || null,
      emoji: meta.emoji || null,
      vibe: meta.vibe || null,
      frontmatter: meta,
    },
    isActive: true,
    isSelected: true,
    tenantId: tenant.id,
    departmentId: department.id,
    createdById: owner?.id || null,
  };

  if (existing) {
    return prisma.agent.update({ where: { id: existing.id }, data });
  }
  return prisma.agent.create({ data });
}

async function main() {
  if (!fs.existsSync(SOURCE_ROOT)) {
    fail(`Source not found: ${SOURCE_ROOT}`);
  }
  console.log(`[seed] source: ${SOURCE_ROOT}`);
  console.log(`[seed] target tenant slug: ${TENANT_SLUG}`);

  const divisions = await loadDivisions();
  console.log(`[seed] divisions discovered: ${divisions.length}`);
  const totalAgents = divisions.reduce((n, d) => n + d.files.length, 0);
  console.log(`[seed] total agent files: ${totalAgents}`);

  const tenant = await getTargetTenant();
  console.log(`[seed] tenant: ${tenant.name} (${tenant.id})`);
  const owner = await getOwnerUser(tenant.id);
  console.log(`[seed] owner user: ${owner ? owner.email : '(none)'}`);

  if (DRY_RUN) {
    for (const d of divisions) {
      console.log(`  - ${d.label} [${d.color}] ${d.icon} → ${d.files.length} agents`);
    }
    console.log('[seed] --dry-run: not writing.');
    return;
  }

  let deptCount = 0;
  let agentCount = 0;
  const t0 = Date.now();

  for (const div of divisions) {
    const dept = await resolveDepartment(tenant, div);
    deptCount++;
    let inDiv = 0;
    for (const file of div.files) {
      await upsertAgent({ tenant, owner, department: dept, file });
      inDiv++;
    }
    agentCount += inDiv;
    console.log(`[seed] ${div.label.padEnd(22)} dept=${dept.id} agents=${inDiv}`);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[seed] DONE in ${elapsed}s — departments: ${deptCount}, agents: ${agentCount}`);
}

main()
  .catch(err => {
    console.error('[seed] FAILED', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
