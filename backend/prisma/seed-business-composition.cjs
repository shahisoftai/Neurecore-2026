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

// ─── Tiers (canonical 4-tier taxonomy per TIER-SYSTEM-CONCEPT.md §4) ────────

const TIERS = [
  { slug: 'basic',        name: 'Basic',        tagline: 'Try NeureCore with no commitment',          sortOrder: 10, isDefault: true,  monthlyPrice: 0,    yearlyPrice: 0,     maxUsers: 2,    maxAgents: 3,    maxDepartments: 1,    maxStorageGB: 1,   maxApiCalls: 1000,   maxConversationMessages: 500,    maxFileSizeMB: 10,  maxApprovalStages: 1, allowCustomBranding: false, allowApiAccess: false, allowSso: false, allowAuditExport: false, allowWhiteLabel: false, allowPredictiveAnalytics: false, allowCustomDashboards: false, allowMultiOffice: false, icon: 'Sparkles' },
  { slug: 'business',     name: 'Business',     tagline: 'For small teams getting started',           sortOrder: 20, isDefault: false, monthlyPrice: 29,   yearlyPrice: 290,   maxUsers: 10,   maxAgents: 10,   maxDepartments: 3,    maxStorageGB: 10,  maxApiCalls: 10000,  maxConversationMessages: 5000,   maxFileSizeMB: 50,  maxApprovalStages: 2, allowCustomBranding: false, allowApiAccess: true,  allowSso: false, allowAuditExport: true,  allowWhiteLabel: false, allowPredictiveAnalytics: false, allowCustomDashboards: false, allowMultiOffice: false, icon: 'Briefcase' },
  { slug: 'professional', name: 'Professional', tagline: 'Scale up with advanced capabilities',      sortOrder: 30, isDefault: false, monthlyPrice: 99,   yearlyPrice: 990,   maxUsers: 50,   maxAgents: 50,   maxDepartments: 10,   maxStorageGB: 100, maxApiCalls: 100000, maxConversationMessages: 50000,  maxFileSizeMB: 200, maxApprovalStages: 3, allowCustomBranding: true,  allowApiAccess: true,  allowSso: true,  allowAuditExport: true,  allowWhiteLabel: false, allowPredictiveAnalytics: true,  allowCustomDashboards: true,  allowMultiOffice: false, icon: 'Rocket' },
  { slug: 'enterprise',   name: 'Enterprise',   tagline: 'Mission-critical scale and support',       sortOrder: 40, isDefault: false, monthlyPrice: 499,  yearlyPrice: 4990,  maxUsers: 9999, maxAgents: 9999, maxDepartments: 9999, maxStorageGB: 1000,maxApiCalls: 1000000,maxConversationMessages: 999999,maxFileSizeMB: 1000,maxApprovalStages: 4, allowCustomBranding: true,  allowApiAccess: true,  allowSso: true,  allowAuditExport: true,  allowWhiteLabel: true,  allowPredictiveAnalytics: true,  allowCustomDashboards: true,  allowMultiOffice: true,  icon: 'Building' },
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

// ─── Tier seed (canonical 4-tier taxonomy) ────────────────────────────────
// TIER-SYSTEM-CONCEPT.md Phase 3 — TierTemplate table removed.
// Tier is now the single source of truth.

async function seedTiers() {
  let created = 0;
  let updated = 0;

  for (const t of TIERS) {
    const existing = await prisma.tier.findUnique({ where: { slug: t.slug } });
    if (existing) {
      // Update name/icon/limits if drifted
      await prisma.tier.update({
        where: { slug: t.slug },
        data: {
          name: t.name,
          tagline: t.tagline,
          icon: t.icon,
          monthlyPrice: t.monthlyPrice,
          yearlyPrice: t.yearlyPrice,
          maxUsers: t.maxUsers,
          maxAgents: t.maxAgents,
          maxDepartments: t.maxDepartments,
          maxStorageGB: t.maxStorageGB,
          maxApiCalls: t.maxApiCalls,
          maxConversationMessages: t.maxConversationMessages,
          maxFileSizeMB: t.maxFileSizeMB,
          maxApprovalStages: t.maxApprovalStages,
          allowCustomBranding: t.allowCustomBranding,
          allowApiAccess: t.allowApiAccess,
          allowSso: t.allowSso,
          allowAuditExport: t.allowAuditExport,
          allowWhiteLabel: t.allowWhiteLabel,
          allowPredictiveAnalytics: t.allowPredictiveAnalytics,
          allowCustomDashboards: t.allowCustomDashboards,
          allowMultiOffice: t.allowMultiOffice,
        },
      });
      updated += 1;
    } else {
      await prisma.tier.create({
        data: {
          slug: t.slug,
          name: t.name,
          tagline: t.tagline,
          icon: t.icon,
          sortOrder: t.sortOrder,
          isDefault: t.isDefault,
          monthlyPrice: t.monthlyPrice,
          yearlyPrice: t.yearlyPrice,
          maxUsers: t.maxUsers,
          maxAgents: t.maxAgents,
          maxDepartments: t.maxDepartments,
          maxStorageGB: t.maxStorageGB,
          maxApiCalls: t.maxApiCalls,
          maxConversationMessages: t.maxConversationMessages,
          maxFileSizeMB: t.maxFileSizeMB,
          maxApprovalStages: t.maxApprovalStages,
          allowCustomBranding: t.allowCustomBranding,
          allowApiAccess: t.allowApiAccess,
          allowSso: t.allowSso,
          allowAuditExport: t.allowAuditExport,
          allowWhiteLabel: t.allowWhiteLabel,
          allowPredictiveAnalytics: t.allowPredictiveAnalytics,
          allowCustomDashboards: t.allowCustomDashboards,
          allowMultiOffice: t.allowMultiOffice,
        },
      });
      created += 1;
    }
  }

  return { created, updated };
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

  console.log('── Seeding Tiers (canonical 4-tier taxonomy per TIER-SYSTEM-CONCEPT.md)');
  const tierResult = await seedTiers();
  console.log(`   ${tierResult.created} created, ${tierResult.updated} updated`);

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
