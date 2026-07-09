#!/usr/bin/env node
/**
 * seed-question-packs.cjs
 *
 * Sub-phase 2C (project-creation-imp-plan.md §7.1, §9.3).
 *
 * Seeds the 20 capability-based QuestionPack catalogue from
 * `prisma/seeds/question-packs/*.json` into the `question_packs` table.
 *
 * IDEMPOTENT:
 *   - upsert keyed on `key` (the unique slug of the pack).
 *   - On re-run: question JSON is overwritten with the canonical content;
 *     `version` is bumped only when the JSON changed.
 *   - Re-runnable in any order. Safe to run multiple times.
 *
 * Flags:
 *   --check      Dry run; prints diff without writing.
 *   --verbose    Log every pack (vs. only the changed ones).
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

const PACKS_DIR = path.join(__dirname, 'seeds', 'question-packs');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(PACKS_DIR, file), 'utf8'));
}

function loadPacks() {
  const files = fs.readdirSync(PACKS_DIR).filter((f) => f.endsWith('.json')).sort();
  return files.map(readJson);
}

function questionsEqual(a, b) {
  // Simple JSON deep-equality — sufficient for canonical seed JSON.
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  const packs = loadPacks();
  console.log(`Found ${packs.length} pack files in ${PACKS_DIR}`);

  if (DRY_RUN) {
    const existing = await prisma.questionPack.findMany({
      select: { key: true, name: true, questions: true, version: true },
    });
    const byKey = new Map(existing.map((p) => [p.key, p]));
    const drift = [];
    for (const p of packs) {
      const e = byKey.get(p.key);
      if (!e) {
        drift.push(`MISSING: ${p.key}`);
        continue;
      }
      if (e.name !== p.name) drift.push(`NAME_DIFF: ${p.key} (${e.name} → ${p.name})`);
      if (!questionsEqual(e.questions, p.questions)) {
        drift.push(`QUESTIONS_DIFF: ${p.key} (${e.questions.length} → ${p.questions.length})`);
      }
    }
    if (drift.length === 0) {
      console.log('   no drift detected');
    } else {
      drift.forEach((d) => console.log(`   ${d}`));
    }
    return;
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const p of packs) {
    const existing = await prisma.questionPack.findUnique({ where: { key: p.key } });
    if (!existing) {
      await prisma.questionPack.create({
        data: {
          key: p.key,
          name: p.name,
          description: p.description ?? null,
          isSystem: true,
          questions: p.questions,
        },
      });
      created += 1;
      if (VERBOSE) console.log(`   + created ${p.key}`);
    } else if (
      existing.name !== p.name ||
      !questionsEqual(existing.questions, p.questions)
    ) {
      await prisma.questionPack.update({
        where: { key: p.key },
        data: {
          name: p.name,
          description: p.description ?? null,
          questions: p.questions,
          version: existing.version + 1,
        },
      });
      updated += 1;
      if (VERBOSE) console.log(`   ~ updated ${p.key} (v${existing.version} → v${existing.version + 1})`);
    } else {
      unchanged += 1;
      if (VERBOSE) console.log(`   = unchanged ${p.key}`);
    }
  }

  const total = await prisma.questionPack.count();
  console.log(`   ✓ done. created=${created} updated=${updated} unchanged=${unchanged}; total rows=${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });