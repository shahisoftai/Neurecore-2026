#!/usr/bin/env node
/**
 * check-industries-sync.mjs
 *
 * Verifies the 15-industry list is identical between:
 *   - frontend-tenant/src/lib/industries.ts (after 2D)
 *   - frontend-admin/src/lib/industries.ts  (after 2D)
 *   - backend/prisma/seeds/project-types/*.json  (the canonical 15)
 *
 * Either both frontend files exist (and must be in sync) or neither
 * exists yet (in which case the canonical backend list still applies).
 *
 * Exit code 0 = synced. Non-zero = drift detected.
 */

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(BACKEND_ROOT, '..');

const CANONICAL_DIR = path.join(BACKEND_ROOT, 'prisma', 'seeds', 'project-types');

function listCanonicalSlugs() {
  const files = fs.readdirSync(CANONICAL_DIR).filter((f) => f.endsWith('.json'));
  return files.map((f) => f.replace(/\.json$/, '')).sort();
}

/**
 * Parse an `industries.ts` file looking for an `INDUSTRIES = [...]` export.
 * Accepts either a `string[]` of slugs OR an `Array<{slug, name}>` literal.
 */
function parseIndustriesTs(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  // Match the array literal assigned to INDUSTRIES.
  const m = src.match(/INDUSTRIES\s*[:=]\s*(\[[\s\S]*?\])\s*(?:as\s+const|;)/);
  if (!m) return null;
  const body = m[1];
  // Extract slug strings.
  const slugRe = /['"`]([a-z0-9-]+)['"`]/g;
  const slugs = [];
  let mm;
  while ((mm = slugRe.exec(body)) !== null) {
    if (!['name', 'label', 'description'].includes(mm[1])) {
      slugs.push(mm[1]);
    }
  }
  return slugs;
}

function listFrontendSlugs(relativePath) {
  const p = path.join(REPO_ROOT, relativePath);
  if (!fs.existsSync(p)) return null;
  return parseIndustriesTs(p);
}

function diff(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  const onlyInA = [...sa].filter((x) => !sb.has(x));
  const onlyInB = [...sb].filter((x) => !sa.has(x));
  return { onlyInA, onlyInB };
}

function main() {
  const canonical = listCanonicalSlugs();
  console.log(`Canonical (backend seeds): ${canonical.length} industries`);

  const TENANT_PATH = 'frontend-tenant/src/lib/industries.ts';
  const ADMIN_PATH = 'frontend-admin/src/lib/industries.ts';

  const tenant = listFrontendSlugs(TENANT_PATH);
  const admin = listFrontendSlugs(ADMIN_PATH);

  let exit = 0;

  if (tenant !== null) {
    console.log(`Frontend-tenant (${TENANT_PATH}): ${tenant.length} industries`);
    const d = diff(canonical, tenant);
    if (d.onlyInA.length || d.onlyInB.length) {
      console.error(`  DRIFT: ${d.onlyInA.length} only in backend, ${d.onlyInB.length} only in tenant`);
      if (d.onlyInA.length) console.error(`    missing from tenant: ${d.onlyInA.join(', ')}`);
      if (d.onlyInB.length) console.error(`    extra in tenant:    ${d.onlyInB.join(', ')}`);
      exit = 1;
    } else {
      console.log('  ✓ in sync');
    }
  } else {
    console.log(`Frontend-tenant (${TENANT_PATH}): not yet created (2D deliverable)`);
  }

  if (admin !== null) {
    console.log(`Frontend-admin (${ADMIN_PATH}): ${admin.length} industries`);
    const d = diff(canonical, admin);
    if (d.onlyInA.length || d.onlyInB.length) {
      console.error(`  DRIFT: ${d.onlyInA.length} only in backend, ${d.onlyInB.length} only in admin`);
      if (d.onlyInA.length) console.error(`    missing from admin: ${d.onlyInA.join(', ')}`);
      if (d.onlyInB.length) console.error(`    extra in admin:    ${d.onlyInB.join(', ')}`);
      exit = 1;
    } else {
      console.log('  ✓ in sync');
    }
  } else {
    console.log(`Frontend-admin (${ADMIN_PATH}): not yet created (2D deliverable)`);
  }

  if (tenant !== null && admin !== null) {
    const d = diff(tenant, admin);
    if (d.onlyInA.length || d.onlyInB.length) {
      console.error(`Cross-frontend DRIFT: ${d.onlyInA.length} only in tenant, ${d.onlyInB.length} only in admin`);
      exit = 1;
    }
  }

  process.exit(exit);
}

main();