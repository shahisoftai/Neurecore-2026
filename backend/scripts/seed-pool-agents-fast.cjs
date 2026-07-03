#!/usr/bin/env node
/**
 * Fast bulk seed of PoolAgent + PoolDepartment platform catalog.
 * Same logic as seed-pool-agents.cjs but uses pre-fetched slug map and
 * batched upserts via createMany/updateMany where possible.
 *
 * Usage:
 *   node scripts/seed-pool-agents-fast.cjs
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

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

function fail(msg) { console.error(`[seed-pool-fast] ${msg}`); process.exit(1); }

function parseFrontmatter(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: md };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (v.startsWith('#') && /^[0-9A-Fa-f]{6}$/.test(v)) v = v.toUpperCase();
    meta[kv[1]] = v;
  }
  return { meta, body: m[2].trim() };
}

function slugify(s) {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function divisionSlug(divisionKey) {
  return divisionKey.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function listMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .map(f => path.join(dir, f));
}

async function loadDivisions() {
  const divisionsJson = JSON.parse(
    fs.readFileSync(path.join(SOURCE_ROOT, 'divisions.json'), 'utf8'),
  );
  const out = [];
  for (const [key, meta] of Object.entries(divisionsJson.divisions)) {
    const dir = path.join(SOURCE_ROOT, key);
    const files = listMdFiles(dir);
    if (!files.length) continue;
    out.push({ key, label: meta.label, icon: meta.icon, color: meta.color, files });
  }
  return out;
}

async function main() {
  if (!fs.existsSync(SOURCE_ROOT)) fail(`Source not found: ${SOURCE_ROOT}`);
  console.log(`[seed-pool-fast] source: ${SOURCE_ROOT}`);
  const divisions = await loadDivisions();
  const total = divisions.reduce((n, d) => n + d.files.length, 0);
  console.log(`[seed-pool-fast] divisions: ${divisions.length}, agents: ${total}`);

  const t0 = Date.now();

  // Pre-fetch existing slugs
  const existingAgents = await prisma.poolAgent.findMany({ select: { id: true, slug: true, name: true } });
  const existingBySlug = new Map(existingAgents.map(a => [a.slug, a]));
  const existingDepts = await prisma.poolDepartment.findMany({ select: { id: true, slug: true } });
  const existingDeptBySlug = new Map(existingDepts.map(d => [d.slug, d]));

  let sortOrder = 0;
  let deptUpserts = 0;
  let agentUpserts = 0;

  for (const div of divisions) {
    const divSlug = divisionSlug(div.key);

    // Department
    if (existingDeptBySlug.has(divSlug)) {
      await prisma.poolDepartment.update({
        where: { slug: divSlug },
        data: {
          name: div.label,
          icon: div.icon,
          color: div.color,
          isActive: true,
          sortOrder: sortOrder++,
        },
      });
    } else {
      await prisma.poolDepartment.create({
        data: {
          slug: divSlug,
          name: div.label,
          icon: div.icon,
          color: div.color,
          description: `${div.label} division (${div.files.length} agents)`,
          isActive: true,
          sortOrder: sortOrder++,
        },
      });
    }
    deptUpserts++;

    // Agents in this division
    for (const file of div.files) {
      const raw = fs.readFileSync(file, 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      const baseName = (meta.name || path.basename(file, '.md')).trim();
      const baseSlug = slugify(`${div.key}-${baseName}`);

      // Slug collision: ensure uniqueness across the catalog
      let slug = baseSlug;
      let suffix = 0;
      while (true) {
        const existing = existingBySlug.get(slug);
        if (!existing || existing.name === baseName) break;
        suffix++;
        slug = `${baseSlug}-${suffix}`;
      }

      const data = {
        name: baseName,
        division: div.label,
        divisionSlug: divSlug,
        description: (meta.description || '').slice(0, 500),
        color: meta.color || null,
        emoji: meta.emoji || null,
        systemPrompt: body,
        metadata: {
          source: 'agency-agents-main',
          sourceDivision: div.key,
          sourceFile: path.relative(SOURCE_ROOT, file).replace(/\\/g, '/'),
          category: null,
          vibe: meta.vibe || null,
          frontmatter: meta,
        },
        isActive: true,
      };

      if (existingBySlug.has(slug)) {
        const id = existingBySlug.get(slug).id;
        await prisma.poolAgent.update({ where: { id }, data });
      } else {
        const created = await prisma.poolAgent.create({ data: { slug, ...data } });
        existingBySlug.set(slug, created);
      }
      agentUpserts++;
    }
    process.stdout.write(`  ✓ ${div.label} (${div.files.length})\n`);
  }

  console.log(
    `[seed-pool-fast] DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s — depts=${deptUpserts}, agents=${agentUpserts}`,
  );
}

main()
  .catch(err => { console.error('[seed-pool-fast] FAILED', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());