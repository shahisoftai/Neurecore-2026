#!/usr/bin/env node
/**
 * test-seed-idempotency.mjs
 *
 * Runs a seed script twice in a row, then asserts zero row-count delta.
 * Usage:
 *   node scripts/test-seed-idempotency.mjs question-packs
 *   node scripts/test-seed-idempotency.mjs project-types
 *
 * Reads DATABASE_URL from `backend/.env.production` (falls back to .env).
 */

'use strict';

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const envFile = path.join(__dirname, '..', '.env.production');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const which = process.argv[2];
if (!which || !['question-packs', 'project-types'].includes(which)) {
  console.error('Usage: node scripts/test-seed-idempotency.mjs <question-packs|project-types>');
  process.exit(2);
}

const seedScript = path.join(__dirname, '..', 'prisma', `seed-${which}.cjs`);

const prisma = new PrismaClient();

function snapshot() {
  if (which === 'question-packs') {
    return prisma.questionPack.count();
  }
  return Promise.all([
    prisma.projectType.count({ where: { tenantId: null, isSystem: true } }),
    prisma.projectTypeVersion.count(),
    prisma.projectTypePack.count(),
  ]).then(([t, v, l]) => ({ types: t, versions: v, links: l }));
}

async function runSeed() {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('node', [seedScript], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: path.join(__dirname, '..'),
  });
  if (r.status !== 0) {
    console.error('seed failed:', r.stderr.toString());
    process.exit(r.status ?? 1);
  }
}

async function main() {
  console.log(`Testing idempotency of seed:${which}`);

  const before = await snapshot();
  console.log('  initial:', JSON.stringify(before));

  await runSeed();
  const after1 = await snapshot();
  console.log('  run 1:  ', JSON.stringify(after1));

  await runSeed();
  const after2 = await snapshot();
  console.log('  run 2:  ', JSON.stringify(after2));

  const eq = JSON.stringify(after1) === JSON.stringify(after2);
  if (!eq) {
    console.error(`\nFAIL: row counts changed between runs.`);
    console.error(`  ${JSON.stringify(after1)} !== ${JSON.stringify(after2)}`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nPASS: ${which} seed is idempotent.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });