// apply-migration.cjs - applies the forward migration and runs constraint tests
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();
const SCHEMA = 'sim5_honest_dev';

function splitSql(sql) {
  let s = sql.replace(/^\s*--.*$/gm, '');
  s = s.replace(/^\s*BEGIN\s*;?/i, '').replace(/^\s*COMMIT\s*;?/i, '');
  const stmts = [];
  let buf = '';
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "'") {
      buf += ch; i++;
      while (i < s.length && s[i] !== "'") {
        if (s[i] === '\\' && i + 1 < s.length) { buf += s[i] + s[i+1]; i += 2; }
        else { buf += s[i]; i++; }
      }
      if (i < s.length) { buf += s[i]; i++; }
      continue;
    }
    if (ch === '"') {
      buf += ch; i++;
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\' && i + 1 < s.length) { buf += s[i] + s[i+1]; i += 2; }
        else { buf += s[i]; i++; }
      }
      if (i < s.length) { buf += s[i]; i++; }
      continue;
    }
    if (ch === '$' && s[i+1] === '$') {
      const end = s.indexOf('$$', i + 2);
      if (end === -1) { buf += s.substring(i); i = s.length; }
      else { buf += s.substring(i, end + 2); i = end + 2; }
      continue;
    }
    if (ch === '-' && s[i+1] === '-') {
      while (i < s.length && s[i] !== '\n') i++;
      continue;
    }
    if (ch === ';') {
      const trimmed = buf.trim();
      if (trimmed) stmts.push(trimmed);
      buf = '';
      i++;
      continue;
    }
    buf += ch; i++;
  }
  const tail = buf.trim();
  if (tail) stmts.push(tail);
  return stmts;
}

async function apply() {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA ${SCHEMA}`);
  await prisma.$executeRawUnsafe(`SET search_path TO ${SCHEMA}, public`);
  console.log('Schema reset:', SCHEMA);

  const sql = fs.readFileSync('/tmp/20260717_simulation_5_honest_forward.sql', 'utf8');
  const stmts = splitSql(sql);
  console.log('Total statements:', stmts.length);

  let applied = 0, failed = 0;
  const errors = [];
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    try {
      await prisma.$executeRawUnsafe(s);
      applied++;
    } catch (e) {
      failed++;
      errors.push({ stmt: i + 1, msg: e.message.substring(0, 400), sqlStart: s.substring(0, 200).replace(/\s+/g, ' ') });
    }
  }
  console.log(`Applied: ${applied}/${stmts.length} (${failed} failed)`);
  if (failed > 0) {
    console.log('\n=== FAILURES ===');
    for (const e of errors) {
      console.log(`\nStmt ${e.stmt}:`);
      console.log(`  Error: ${e.msg}`);
      console.log(`  SQL:   ${e.sqlStart}`);
    }
    process.exit(1);
  }
}

async function verify() {
  console.log('\n=== Verification ===');
  await prisma.$executeRawUnsafe(`SET search_path TO ${SCHEMA}, public`);
  const tables = await prisma.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname = $1 AND tablename IN ('timeline_events', 'idempotency_records', 'decision_evaluations', 'service_identities', 'service_tokens') ORDER BY tablename`, SCHEMA);
  console.log('New tables:', tables.length, '/ 5 expected');
  for (const r of tables) console.log('  ✓', r.tablename);

  const enums = await prisma.$queryRawUnsafe(`SELECT typname FROM pg_type WHERE typname IN ('TimelineCategory', 'EventSeverity', 'TimelineSourceType', 'TimelineEventStatus', 'DecisionEvaluationKind', 'EvaluatorKind', 'IdempotencyResponseStorageKind') ORDER BY typname`);
  console.log('New enums:', enums.length, '/ 7 expected');
  for (const r of enums) console.log('  ✓', r.typname);

  const cols = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'project_decisions' AND column_name IN ('simulationId', 'expectedOutcome', 'actualOutcome', 'confidenceEstimate', 'counterfactualBest', 'lessonsLearned', 'evidenceRefs', 'latestEvaluationId', 'simulationRunId') ORDER BY column_name`, SCHEMA);
  console.log('New columns on project_decisions:', cols.length, '/ 9 expected');

  const trgs = await prisma.$queryRawUnsafe(`SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = $1 AND event_object_table = 'timeline_events'`, SCHEMA);
  console.log('Triggers on timeline_events:', trgs.length, '/ 1 expected');
  for (const r of trgs) console.log('  ✓', r.trigger_name);
  return tables.length === 5 && enums.length === 7 && cols.length === 9 && trgs.length === 1;
}

async function testConstraints() {
  console.log('\n=== Constraint tests ===');
  await prisma.$executeRawUnsafe(`SET search_path TO ${SCHEMA}, public`);

  console.log('\nTest 1: Status transition trigger (FAILED -> ACTIVE illegal)');
  const ins = await prisma.$queryRawUnsafe(`INSERT INTO timeline_events (tenantId, occurredAt, category, severity, sourceType, title, description, status, createdByUserId) VALUES ('test-tenant', NOW(), 'OPERATIONAL', 'LOW', 'HUMAN', 'trigger-test-1', 'test', 'FAILED', 'user-1') RETURNING id`);
  const id = ins[0].id;
  try {
    await prisma.$executeRawUnsafe(`UPDATE timeline_events SET status = 'ACTIVE' WHERE id = $1`, id);
    console.log('  ✗ FAILED: illegal transition was allowed');
    process.exit(1);
  } catch (e) {
    console.log('  ✓ illegal transition FAILED->ACTIVE rejected');
  }
  await prisma.$executeRawUnsafe(`UPDATE timeline_events SET status = 'REPORTED' WHERE id = $1`, id);
  console.log('  ✓ legal transition FAILED->REPORTED allowed');
  await prisma.$executeRawUnsafe(`DELETE FROM timeline_events WHERE id = $1`, id);

  console.log('\nTest 2: exactly-one-actor rule');
  try {
    await prisma.$executeRawUnsafe(`INSERT INTO timeline_events (tenantId, occurredAt, category, severity, sourceType, title, description, createdByUserId, createdByAgentId) VALUES ('test-tenant', NOW(), 'OPERATIONAL', 'LOW', 'HUMAN', 'two-actor', 'test', 'user-1', 'agent-1')`);
    console.log('  ✗ FAILED: two-actor insert was allowed');
    process.exit(1);
  } catch (e) {
    console.log('  ✓ two-actor insert rejected');
  }

  console.log('\nTest 3: idempotency exactly-one-body-form');
  try {
    await prisma.$executeRawUnsafe(`INSERT INTO idempotency_records (tenantId, key, requestPath, requestHash, responseBody, responseReference, responseStorageKind, expiresAt) VALUES ('test-tenant', 'test-both', '/test', 'sha256hash', '{}'::jsonb, 's3://bucket/key', 'BODY_INLINE', NOW() + interval '1 day')`);
    console.log('  ✗ FAILED: both body forms allowed');
    process.exit(1);
  } catch (e) {
    console.log('  ✓ both body forms rejected');
  }

  console.log('\nTest 4: service token hash format');
  const svc = await prisma.$queryRawUnsafe(`INSERT INTO service_identities (tenantId, name, scopes, createdByUserId) VALUES ('test-tenant', 'test-svc', ARRAY['test'], 'user-1') RETURNING id`);
  try {
    await prisma.$executeRawUnsafe(`INSERT INTO service_tokens (serviceIdentityId, tenantId, scopes, tokenHash, expiresAt) VALUES ($1, 'test-tenant', ARRAY['test'], 'invalid-hash', NOW() + interval '1 hour')`, svc[0].id);
    console.log('  ✗ FAILED: invalid hash format allowed');
    process.exit(1);
  } catch (e) {
    console.log('  ✓ invalid hash format rejected');
  }
  const validHash = 'a'.repeat(64);
  await prisma.$executeRawUnsafe(`INSERT INTO service_tokens (serviceIdentityId, tenantId, scopes, tokenHash, expiresAt) VALUES ($1, 'test-tenant', ARRAY['test'], $2, NOW() + interval '1 hour')`, svc[0].id, validHash);
  console.log('  ✓ valid sha256 hex hash accepted');

  console.log('\nTest 5: DecisionEvaluation immutability');
  await prisma.$executeRawUnsafe(`INSERT INTO project_decisions (projectId, title, status) VALUES ('test-project', 'immut-test', 'PROPOSED')`);
  const dec = await prisma.$queryRawUnsafe(`SELECT id FROM project_decisions WHERE title = 'immut-test' LIMIT 1`);
  await prisma.$executeRawUnsafe(`INSERT INTO decision_evaluations (tenantId, decisionId, evaluationKind, scoringVersion, scores, evaluatorKind) VALUES ('test-tenant', $1, 'INITIAL', 'v1', '{"x":1}'::jsonb, 'SYSTEM')`, dec[0].id);
  const ev = await prisma.$queryRawUnsafe(`SELECT id FROM decision_evaluations WHERE decisionId = $1`, dec[0].id);
  try {
    await prisma.$executeRawUnsafe(`UPDATE decision_evaluations SET scores = '{"x":2}'::jsonb WHERE id = $1`, ev[0].id);
    console.log('  ✗ FAILED: UPDATE allowed');
    process.exit(1);
  } catch (e) {
    console.log('  ✓ UPDATE rejected (immutability trigger)');
  }

  console.log('\n✓ All constraint tests passed');
}

async function main() {
  await apply();
  const ok = await verify();
  if (!ok) { console.log('VERIFICATION FAILED'); process.exit(1); }
  await testConstraints();
  await prisma.$disconnect();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });