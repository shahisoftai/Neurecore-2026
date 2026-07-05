#!/usr/bin/env node
/**
 * seed-business-composition.cjs
 *
 * Phase 10 — Admin Business Composition (six pools).
 *
 * Idempotent. Seeds:
 *   • 8 Industries (slug-keyed upsert)
 *   • 4 Tier Templates (Starter / Professional / Enterprise / Government)
 *     and back-fills them from existing department_templates rows whose slug
 *     starts with "tier-". Linking tries to match the matching billing Tier
 *     by case-insensitive name.
 *   • 14 Features grouped by category (14 keys, idempotent).
 *
 * Run: node prisma/seed-business-composition.cjs
 */

'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Industries ─────────────────────────────────────────────────────────────

const INDUSTRIES = [
  { slug: 'healthcare',    name: 'Healthcare',    icon: 'HeartPulse' },
  { slug: 'ngo',           name: 'NGO',           icon: 'HeartHandshake' },
  { slug: 'manufacturing', name: 'Manufacturing', icon: 'Factory' },
  { slug: 'construction',  name: 'Construction',  icon: 'HardHat' },
  { slug: 'education',     name: 'Education',     icon: 'GraduationCap' },
  { slug: 'retail',        name: 'Retail',        icon: 'ShoppingBag' },
  { slug: 'logistics',     name: 'Logistics',     icon: 'Truck' },
  { slug: 'government',    name: 'Government',    icon: 'Landmark' },
];

// ─── Tier Templates ────────────────────────────────────────────────────────

const TIER_TEMPLATES = [
  { slug: 'starter',     name: 'Starter',     tagline: 'Get started fast with the essentials.', sortOrder: 10 },
  { slug: 'professional', name: 'Professional', tagline: 'Scale up with advanced capabilities.', sortOrder: 20 },
  { slug: 'enterprise',  name: 'Enterprise',  tagline: 'Mission-critical performance and support.', sortOrder: 30 },
  { slug: 'government',  name: 'Government',  tagline: 'Compliance-first for public-sector deployments.', sortOrder: 40 },
];

// ─── Features ──────────────────────────────────────────────────────────────

const FEATURES = [
  // INTEGRATION
  { key: 'ms365_integration',   name: 'Microsoft 365 Integration',   category: 'INTEGRATION',  integrationKey: 'ms365' },
  { key: 'google_workspace',    name: 'Google Workspace',            category: 'INTEGRATION',  integrationKey: 'google_workspace' },
  { key: 'whatsapp',            name: 'WhatsApp',                    category: 'INTEGRATION',  integrationKey: 'whatsapp' },
  { key: 'erp_integration',     name: 'ERP Integration',             category: 'INTEGRATION',  integrationKey: 'erp' },
  { key: 'crm_integration',     name: 'CRM Integration',             category: 'INTEGRATION',  integrationKey: 'crm' },

  // API
  { key: 'api_access',          name: 'API Access',                  category: 'API' },
  { key: 'webhooks',            name: 'Webhooks',                    category: 'API' },

  // COMMUNICATION
  { key: 'voice_calling',       name: 'Voice Calling',               category: 'COMMUNICATION' },
  { key: 'sms',                 name: 'SMS',                         category: 'COMMUNICATION' },

  // BRANDING
  { key: 'white_label',         name: 'White Label',                 category: 'BRANDING' },
  { key: 'custom_branding',     name: 'Custom Branding',             category: 'BRANDING' },

  // ANALYTICS
  { key: 'advanced_analytics',  name: 'Advanced Analytics',          category: 'ANALYTICS' },
  { key: 'custom_reports',      name: 'Custom Reports',              category: 'ANALYTICS' },

  // AUTOMATION
  { key: 'workflow_automation', name: 'Workflow Automation',         category: 'AUTOMATION' },
  { key: 'routines',            name: 'Scheduled Routines',          category: 'AUTOMATION' },

  // SECURITY
  { key: 'sso',                 name: 'Single Sign-On (SSO)',        category: 'SECURITY' },
  { key: 'audit_logs',          name: 'Audit Logs',                  category: 'SECURITY' },
  { key: 'two_factor',          name: 'Two-Factor Authentication',   category: 'SECURITY' },

  // PLATFORM
  { key: 'multi_tenant',        name: 'Multi-Tenant Support',        category: 'PLATFORM' },
];

// ─── Tier migration ────────────────────────────────────────────────────────

async function migrateLegacyTierRows() {
  const legacyDeptTemplates = await prisma.departmentTemplate.findMany({
    where: {
      OR: [
        { slug: { startsWith: 'tier-' } },
        { name: { startsWith: 'Tier:' } },
      ],
    },
  });

  let created = 0;
  let linked = 0;
  const unmatched = [];

  for (const tpl of TIER_TEMPLATES) {
    const legacy = legacyDeptTemplates.find((row) => {
      const rowSlug = (row.slug || '').toLowerCase();
      const rowName = (row.name || '').toLowerCase();
      return (
        rowSlug === `tier-${tpl.slug}` ||
        rowName === `tier: ${tpl.name.toLowerCase()}` ||
        rowName === `tier:${tpl.name.toLowerCase()}`
      );
    });

    const tier = await prisma.tierTemplate.upsert({
      where: { slug: tpl.slug },
      create: {
        slug: tpl.slug,
        name: tpl.name,
        tagline: tpl.tagline,
        status: 'PUBLISHED',
        sortOrder: tpl.sortOrder,
      },
      update: {
        name: tpl.name,
        tagline: tpl.tagline,
        sortOrder: tpl.sortOrder,
      },
    });

    // Try to find a matching billing Tier (case-insensitive name match).
    const billingTier = await prisma.tier.findFirst({
      where: {
        name: { equals: tpl.name, mode: 'insensitive' },
      },
    });

    if (billingTier && tier.defaultBillingTierId !== billingTier.id) {
      await prisma.tierTemplate.update({
        where: { id: tier.id },
        data: { defaultBillingTierId: billingTier.id },
      });
      linked += 1;
    } else if (!billingTier) {
      unmatched.push(tpl.name);
    }
    created += 1;

    if (legacy) {
      // Mark the legacy row so it stops showing under tier-templates filters.
      // Idempotent: only updates if category differs.
      if (legacy.category !== 'legacy-tier') {
        await prisma.departmentTemplate.update({
          where: { id: legacy.id },
          data: { category: 'legacy-tier' },
        });
      }
    }
  }

  return { created, linked, unmatched };
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('── Seeding Industries');
  for (const ind of INDUSTRIES) {
    await prisma.industry.upsert({
      where: { slug: ind.slug },
      create: { ...ind, status: 'ACTIVE', sortOrder: 0 },
      update: { name: ind.name, icon: ind.icon },
    });
  }
  console.log(`   ${INDUSTRIES.length} industries upserted`);

  console.log('── Seeding Tier Templates (and migrating legacy rows)');
  const tierResult = await migrateLegacyTierRows();
  console.log(`   ${tierResult.created} tier templates (${tierResult.linked} linked to billing Tier)`);
  if (tierResult.unmatched.length) {
    console.log(`   No billing Tier match for: ${tierResult.unmatched.join(', ')}`);
  }

  console.log('── Seeding Features');
  for (let i = 0; i < FEATURES.length; i += 1) {
    const f = FEATURES[i];
    await prisma.feature.upsert({
      where: { key: f.key },
      create: {
        key: f.key,
        name: f.name,
        category: f.category,
        integrationKey: f.integrationKey,
        sortOrder: i * 10,
      },
      update: {
        name: f.name,
        category: f.category,
        integrationKey: f.integrationKey,
      },
    });
  }
  console.log(`   ${FEATURES.length} features upserted`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Done.');
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
