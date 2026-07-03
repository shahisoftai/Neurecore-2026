#!/usr/bin/env node
/**
 * Provision a tenant user + deploy an IndustryPackage for them.
 *
 * Usage:
 *   node scripts/provision-user-and-deploy.cjs <email> <password> <industry> <tierSlug>
 * Example:
 *   node scripts/provision-user-and-deploy.cjs mali@live.com 'Shahikhail123@@' ACCOUNTING pro
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '..', '.env.development');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

const prisma = new PrismaClient();

const [, , emailArg, passwordArg, industryArg, tierArg] = process.argv;
if (!emailArg || !passwordArg || !industryArg || !tierArg) {
  console.error('Usage: node scripts/provision-user-and-deploy.cjs <email> <password> <industry> <tierSlug>');
  console.error('Example: node scripts/provision-user-and-deploy.cjs mali@live.com "Shahikhail123@@" ACCOUNTING pro');
  process.exit(1);
}

const email = emailArg.toLowerCase().trim();
const password = passwordArg;
const industry = industryArg.toUpperCase().trim();
const tierSlug = tierArg.toLowerCase().trim();

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
  const t0 = Date.now();

  const tier = await prisma.tier.findUnique({ where: { slug: tierSlug } });
  if (!tier) {
    console.error(`Tier not found: ${tierSlug}`);
    process.exit(1);
  }

  const pkg = await prisma.industryPackage.findUnique({
    where: { industry_tierId: { industry, tierId: tier.id } },
    include: {
      tier: true,
      entries: {
        include: { poolAgent: true },
        orderBy: [{ divisionSlug: 'asc' }, { slot: 'asc' }],
      },
    },
  });
  if (!pkg) {
    console.error(`IndustryPackage not found for ${industry} × ${tierSlug}`);
    process.exit(1);
  }
  console.log(`[deploy] target package: ${pkg.name} (${pkg.entries.length} entries)`);

  // 1. Tenant
  const tenantSlug = `${slugify(email)}-${slugify(industry)}`.slice(0, 60);
  const tenantName = `${email.split('@')[0]} — ${industry.replace(/_/g, ' ')}`;
  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { industry, tierId: tier.id, status: 'ACTIVE' },
    create: {
      slug: tenantSlug,
      name: tenantName,
      industry,
      tierId: tier.id,
      status: 'ACTIVE',
      onboardingCompletedAt: new Date(),
      onboardingStep: 'complete',
    },
  });
  console.log(`[deploy] tenant: ${tenant.slug} (id=${tenant.id})`);

  // 2. User
  const passwordHash = await bcrypt.hash(password, 12);
  const [firstName, ...rest] = (email.split('@')[0] || 'User').split(/[._-]/);
  const lastName = rest.join(' ') || 'Owner';
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      isActive: true,
      tenantId: tenant.id,
      role: 'OWNER',
    },
    create: {
      email,
      passwordHash,
      firstName: firstName[0].toUpperCase() + firstName.slice(1),
      lastName: lastName[0].toUpperCase() + lastName.slice(1),
      role: 'OWNER',
      isActive: true,
      isVerified: true,
      tenantId: tenant.id,
      lastLoginAt: new Date(),
    },
  });
  console.log(`[deploy] user: ${user.email} (id=${user.id}, role=${user.role})`);

  // 3. Resolve PoolDepartments → create per-tenant Departments
  const divisionSlugs = Array.from(new Set(pkg.entries.map(e => e.divisionSlug)));
  const poolDepts = await prisma.poolDepartment.findMany({
    where: { slug: { in: divisionSlugs } },
  });
  const poolDeptBySlug = new Map(poolDepts.map(d => [d.slug, d]));

  const deptBySlug = new Map();
  for (const slug of divisionSlugs) {
    const poolDept = poolDeptBySlug.get(slug);
    const deptName = poolDept?.name ?? slug;
    let dept = await prisma.department.findFirst({
      where: { tenantId: tenant.id, name: deptName },
    });
    if (!dept) {
      dept = await prisma.department.create({
        data: { tenantId: tenant.id, name: deptName, status: 'ACTIVE' },
      });
    }
    deptBySlug.set(slug, dept);
  }
  console.log(`[deploy] departments ensured: ${deptBySlug.size}`);

  // 4. Upsert Agents (idempotent on tenantId + poolSourceId)
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const entry of pkg.entries) {
    const dept = deptBySlug.get(entry.divisionSlug);
    if (!dept) { skipped++; continue; }

    const existing = await prisma.agent.findUnique({
      where: {
        tenantId_poolSourceId: {
          tenantId: tenant.id,
          poolSourceId: entry.poolAgentId,
        },
      },
    });

    if (existing) {
      await prisma.agent.update({
        where: { id: existing.id },
        data: { isSelected: entry.isDefaultSelected, departmentId: dept.id },
      });
      updated++;
    } else {
      await prisma.agent.create({
        data: {
          tenantId: tenant.id,
          name: entry.poolAgent.name,
          description: entry.poolAgent.description,
          type: 'FUNCTIONAL',
          status: 'IDLE',
          model: entry.defaultModel ?? 'gpt-4o-mini',
          systemPrompt: entry.poolAgent.systemPrompt,
          instructions: null,
          budgetPerDay: entry.defaultBudgetPerDay ?? 5,
          permissions: [],
          config: {},
          metadata: {
            source: 'industry-package',
            poolAgentId: entry.poolAgent.id,
            poolDepartmentSlug: entry.divisionSlug,
            industry: pkg.industry,
            packageId: pkg.id,
          },
          departmentId: dept.id,
          poolSourceId: entry.poolAgentId,
          createdById: user.id,
          isSelected: entry.isDefaultSelected,
        },
      });
      created++;
    }
  }
  console.log(`[deploy] agents: created=${created}, updated=${updated}, skipped=${skipped}`);

  console.log(`\n[deploy] DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log('---');
  console.log(`Email:    ${user.email}`);
  console.log(`Password: ${password}`);
  console.log(`Tenant:   ${tenant.slug}  (industry=${tenant.industry}, tier=${tierSlug})`);
  console.log(`Package:  ${pkg.name}  (${pkg.entries.length} entries, ${created} created, ${updated} updated)`);
}

main()
  .catch(e => { console.error('FAILED', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());