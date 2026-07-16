#!/usr/bin/env node
/**
 * Seeds an existing tenant's Brevo integration row using the platform master
 * API key from environment variables. After running, the tenant's email sends
 * will be authenticated with this master key (no per-tenant key entry needed).
 *
 * Usage:
 *   node scripts/brevo-bootstrap-tenant.cjs <tenantId>
 *   node scripts/brevo-bootstrap-tenant.cjs --all      # every tenant missing Brevo creds
 *
 * Reads:
 *   BREVO_API               (base64 JSON { "api_key": "xkeysib-..." }) — preferred
 *   BREVO_MASTER_API_KEY    (bare xkeysib-... key)                    — fallback
 *
 * Requires: DATABASE_URL, ENCRYPTION_KEY (or APP_SECRET) set.
 */
const fs = require('fs');
const path = require('path');
const { randomBytes, createCipheriv, scryptSync } = require('crypto');

const prismaPath = path.join(__dirname, '..', 'node_modules', '@prisma', 'client');
let PrismaClient;
try {
  PrismaClient = require(prismaPath).PrismaClient;
} catch {
  PrismaClient = require('@prisma/client').PrismaClient;
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SALT = 'neurecore-integration-cred-v1';

function loadDotenv(file) {
  if (!fs.existsSync(file)) return;
  const txt = fs.readFileSync(file, 'utf8');
  for (const raw of txt.split(/\r?\n/)) {
    if (!raw || raw.startsWith('#')) continue;
    const m = raw.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

function loadAllEnvs() {
  const root = path.join(__dirname, '..');
  for (const f of ['.env', '.env.production', '.env.development']) {
    loadDotenv(path.join(root, f));
  }
}

function decodeMasterKey() {
  const raw =
    process.env.BREVO_MASTER_API_KEY ||
    process.env.BREVO_API ||
    '';
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('xkeysib-') || trimmed.startsWith('xsmtpsib-')) {
    return trimmed;
  }
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (decoded && decoded !== trimmed) {
      const parsed = JSON.parse(decoded);
      return parsed.api_key || parsed.apiKey || null;
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

function buildEncryptionKey() {
  const hexKey = process.env.ENCRYPTION_KEY || process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  const appSecret = process.env.APP_SECRET;
  if (hexKey) return Buffer.from(hexKey, 'hex');
  if (appSecret) return scryptSync(appSecret, SALT, 32);
  console.error(
    'ERROR: Set ENCRYPTION_KEY or APP_SECRET so the script can match the backend encryption.',
  );
  process.exit(2);
}

function encryptCredentials(plaintext, key) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

async function ensureBrevoForTenant(prisma, tenantId, encrypted, label) {
  const BREVO = 'BREVO';
  const ACTIVE = 'ACTIVE';
  const existing = await prisma.integrationCredential.findUnique({
    where: { tenantId_provider: { tenantId, provider: BREVO } },
  });
  if (existing) {
    await prisma.integrationCredential.update({
      where: { id: existing.id },
      data: {
        encryptedCredentials: encrypted,
        label: label ?? existing.label,
        status: ACTIVE,
        updatedAt: new Date(),
      },
    });
    return 'updated';
  }
  await prisma.integrationCredential.create({
    data: {
      tenantId,
      provider: BREVO,
      label: label ?? 'Brevo (master key)',
      status: ACTIVE,
      encryptedCredentials: encrypted,
    },
  });
  return 'created';
}

async function main() {
  loadAllEnvs();

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(2);
  }

  const apiKey = decodeMasterKey();
  if (!apiKey) {
    console.error('ERROR: BREVO_MASTER_API_KEY or BREVO_API is not set.');
    process.exit(2);
  }

  const key = buildEncryptionKey();
  const encrypted = encryptCredentials(JSON.stringify({ apiKey }), key);

  const arg = process.argv[2];
  const prisma = new PrismaClient();
  try {
    if (arg === '--all') {
      const tenants = await prisma.tenant.findMany({ select: { id: true } });
      if (!tenants.length) {
        console.log('No tenants found. Nothing to do.');
        return;
      }
      for (const t of tenants) {
        const action = await ensureBrevoForTenant(prisma, t.id, encrypted);
        console.log(`[${action}] tenant ${t.id}`);
      }
      console.log(`Bootstrapped ${tenants.length} tenants.`);
      return;
    }
    if (!arg) {
      console.error(
        'Usage: node scripts/brevo-bootstrap-tenant.cjs <tenantId> | --all',
      );
      process.exit(1);
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: arg } });
    if (!tenant) {
      console.error(`Tenant not found: ${arg}`);
      process.exit(1);
    }
    const action = await ensureBrevoForTenant(prisma, tenant.id, encrypted);
    console.log(`[${action}] tenant ${tenant.id}`);
    console.log(
      'Brevo is now connected for this tenant. Test with GET /api/v1/integrations/brevo/validate.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
