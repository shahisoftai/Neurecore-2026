#!/usr/bin/env node
/**
 * Seed PoolAgent + PoolDepartment platform catalog from agency-agents-main.
 *
 * - Reads divisions.json + every *.md agent file under each division dir.
 * - Upserts 16 PoolDepartment rows (icon/color from divisions.json).
 * - Upserts 1 PoolAgent row per *.md file.
 * - Idempotent on PoolAgent.slug. Re-run safe.
 *
 * Usage:
 *   node scripts/seed-pool-agents.cjs                # default Neon (env)
 *   node scripts/seed-pool-agents.cjs --dry-run      # preview only
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

function fail(msg) {
  console.error(`[seed-pool] ${msg}`);
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
    if (v.startsWith('#') && /^[0-9A-Fa-f]{6}$/.test(v)) v = v.toUpperCase();
    meta[kv[1]] = v;
  }
  return { meta, body: m[2].trim() };
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function divisionSlug(divisionKey) {
  return divisionKey.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function listMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
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
  console.log(`[seed-pool] source: ${SOURCE_ROOT}`);
  const divisions = await loadDivisions();
  const total = divisions.reduce((n, d) => n + d.files.length, 0);
  console.log(`[seed-pool] divisions: ${divisions.length}, agents: ${total}`);

  if (DRY_RUN) {
    for (const d of divisions) {
      console.log(`  - ${d.label} [${d.color}] ${d.icon} → ${d.files.length}`);
    }
    console.log('[seed-pool] --dry-run: not writing.');
    return;
  }

  let deptUpserts = 0;
  let agentUpserts = 0;
  const t0 = Date.now();

  let sortOrder = 0;
  for (const div of divisions) {
    const divSlug = divisionSlug(div.key);
    const dept = await prisma.poolDepartment.upsert({
      where: { slug: divSlug },
      update: {
        name: div.label,
        icon: div.icon,
        color: div.color,
        isActive: true,
        sortOrder: sortOrder++,
      },
      create: {
        slug: divSlug,
        name: div.label,
        icon: div.icon,
        color: div.color,
        description: `${div.label} division (${div.files.length} agents)`,
        isActive: true,
        sortOrder: sortOrder++,
      },
    });
    deptUpserts++;

    for (const file of div.files) {
      const raw = fs.readFileSync(file, 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      const baseName = (meta.name || path.basename(file, '.md')).trim();
      const baseSlug = slugify(`${div.key}-${baseName}`);

      // Slug collision check across OTHER rows (excluding the one we're
      // about to upsert on this run). Because slug uniqueness is global,
      // two .md files in different divisions with identical frontmatter
      // names would collide; suffix until free.
      let slug = baseSlug;
      let suffix = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const existing = await prisma.poolAgent.findUnique({ where: { slug } });
        if (!existing || existing.name === baseName) break;
        suffix++;
        slug = `${baseSlug}-${suffix}`;
      }

      await prisma.poolAgent.upsert({
        where: { slug },
        update: {
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
        },
        create: {
          slug,
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
        },
      });
      agentUpserts++;
    }
  }

  console.log(
    `[seed-pool] DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s — depts=${deptUpserts}, agents=${agentUpserts}`,
  );
}

main()
  .catch(err => {
    console.error('[seed-pool] FAILED', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
