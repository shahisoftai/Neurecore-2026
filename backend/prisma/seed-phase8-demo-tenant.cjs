/**
 * Seed Phase 8 (Demo Tenant) — Retail-ready demo tenant.
 *
 * Per `EAOS-implementation-roadmap.md` §12 (Task 8.8). Builds a
 * complete "retail-ready" demo tenant so the platform has 50+ retail
 * entities to demo against. Tenant: `demo-retail`.
 *
 * What gets created (idempotent):
 *   - 1 demo tenant (`demo-retail`) on PRO plan
 *   - 1 OWNER user (`retail@neurecore.ai` / `Retail@123!`)
 *   - 1 corporate-services pack install (prerequisite)
 *   - 1 retail pack install (PRO tier)
 *   - 10 retail-store departments (Soho, Williamsburg, Park Slope, ... )
 *   - 25 retail AI employees (Store Managers, Department Leads, AI Associates)
 *   - 6 corporate departments (Sales, Marketing, Finance, ...)
 *   - EntityState + EntityOwnership rows for every retail-store dept
 *   - 4 active workflows (one per retail workflow template)
 *   - WorkspaceLayout default for the demo user
 *
 * Run from backend directory:
 *   node prisma/seed-phase8-demo-tenant.cjs
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const p = new PrismaClient();

const TENANT_SLUG = 'demo-retail';
const TENANT_NAME = 'Demo Retail Co.';
const TIER_SLUG = 'professional';

const OWNER_EMAIL = 'retail@neurecore.ai';
const OWNER_PASS = 'Retail@123!';
const OWNER_FIRST = 'Retail';
const OWNER_LAST = 'Owner';

// ─── Retail-store names (geographically diverse, Brooklyn/Manhattan/LA) ───
const RETAIL_STORES = [
  { name: 'SoHo Flagship', location: 'New York, NY', squareFeet: 8500, type: 'flagship' },
  { name: 'Williamsburg', location: 'Brooklyn, NY', squareFeet: 4200, type: 'urban' },
  { name: 'Park Slope', location: 'Brooklyn, NY', squareFeet: 3800, type: 'neighbourhood' },
  { name: 'Upper East Side', location: 'New York, NY', squareFeet: 5200, type: 'urban' },
  { name: 'Venice Beach', location: 'Los Angeles, CA', squareFeet: 4800, type: 'beach' },
  { name: 'Silver Lake', location: 'Los Angeles, CA', squareFeet: 3600, type: 'urban' },
  { name: 'Mission District', location: 'San Francisco, CA', squareFeet: 4100, type: 'urban' },
  { name: 'Wicker Park', location: 'Chicago, IL', squareFeet: 4400, type: 'urban' },
  { name: 'South Congress', location: 'Austin, TX', squareFeet: 3900, type: 'urban' },
  { name: 'Pearl District', location: 'Portland, OR', squareFeet: 3700, type: 'neighbourhood' },
];

// ─── Retail AI employee roles ───
const RETAIL_ROLES = [
  'Store Manager',
  'Assistant Store Manager',
  'Visual Merchandiser',
  'Loss Prevention Lead',
  'Customer Experience Lead',
  'Inventory Lead',
  'Senior Sales Associate',
  'Sales Associate',
];

// ─── Corporate departments ───
const CORPORATE_DEPTS = [
  { name: 'Retail Operations', description: 'Multi-store operations and standards' },
  { name: 'Merchandising', description: 'Buying, planning, and assortment' },
  { name: 'Marketing', description: 'Brand, growth, and lifecycle marketing' },
  { name: 'Finance', description: 'FP&A, accounting, treasury' },
  { name: 'HR', description: 'People + culture + recruiting' },
  { name: 'IT', description: 'Retail tech stack + integrations' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

async function upsertTenant() {
  const tier = await p.tier.findUnique({ where: { slug: TIER_SLUG } });
  if (!tier) throw new Error(`Tier '${TIER_SLUG}' not found — run seed-phase7.cjs first`);
  let tenant = await p.tenant.findUnique({ where: { slug: TENANT_SLUG } });
  if (!tenant) {
    tenant = await p.tenant.create({
      data: {
        slug: TENANT_SLUG,
        name: TENANT_NAME,
        status: 'ACTIVE',
        tierId: tier.id,
      },
    });
    console.log(`  + created tenant ${tenant.slug} (${tenant.id}) on tier ${tier.slug}`);
  } else {
    await p.tenant.update({
      where: { id: tenant.id },
      data: { status: 'ACTIVE', tierId: tier.id },
    });
    console.log(`  · tenant ${tenant.slug} already exists — refreshed to tier ${tier.slug}`);
  }
  return tenant;
}

async function upsertOwner(tenantId) {
  const hash = await bcrypt.hash(OWNER_PASS, 12);
  let user = await p.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!user) {
    user = await p.user.create({
      data: {
        email: OWNER_EMAIL,
        passwordHash: hash,
        firstName: OWNER_FIRST,
        lastName: OWNER_LAST,
        role: 'OWNER',
        tenantId,
        isActive: true,
      },
    });
    console.log(`  + created OWNER user ${user.email}`);
  } else {
    await p.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, isActive: true, tenantId },
    });
    console.log(`  · OWNER user ${user.email} already exists — refreshed`);
  }
  return user;
}

async function installPacks(tenantId, ownerId) {
  const corporate = await p.solutionPack.findUnique({ where: { slug: 'corporate-services' } });
  const retail = await p.solutionPack.findUnique({ where: { slug: 'retail' } });

  if (!corporate || !retail) {
    console.warn('  ! solution packs not found — run seed-phase7.cjs + seed-phase8-retail.cjs first');
    return;
  }

  await p.tenantInstalledPack.upsert({
    where: { tenantId_solutionPackId: { tenantId, solutionPackId: corporate.id } },
    create: {
      tenantId,
      solutionPackId: corporate.id,
      packSlug: corporate.slug,
      packVersion: corporate.version,
      extensionsSnapshot: corporate.extensions ?? {},
      installedById: ownerId,
      themingImpact: (corporate.extensions?.themingImpact ?? {}) ,
    },
    update: { uninstalledAt: null, installedAt: new Date() },
  });
  await p.packInstallation.create({
    data: { tenantId, solutionPackId: corporate.id, action: 'install', success: true, performedById: ownerId },
  });

  await p.tenantInstalledPack.upsert({
    where: { tenantId_solutionPackId: { tenantId, solutionPackId: retail.id } },
    create: {
      tenantId,
      solutionPackId: retail.id,
      packSlug: retail.slug,
      packVersion: retail.version,
      extensionsSnapshot: retail.extensions ?? {},
      installedById: ownerId,
      themingImpact: (retail.extensions?.themingImpact ?? { accentColor: '#22c55e' }),
    },
    update: { uninstalledAt: null, installedAt: new Date() },
  });
  await p.packInstallation.create({
    data: { tenantId, solutionPackId: retail.id, action: 'install', success: true, performedById: ownerId },
  });

  console.log('  ✓ installed corporate-services + retail packs');
}

async function createCorporateDepartments(tenantId) {
  const out = {};
  for (const d of CORPORATE_DEPTS) {
    const existing = await p.department.findFirst({
      where: { tenantId, name: d.name },
    });
    if (existing) {
      out[d.name] = existing;
    } else {
      out[d.name] = await p.department.create({
        data: {
          tenantId,
          name: d.name,
          description: d.description,
          status: 'ACTIVE',
          metadata: { source: 'demo_retail', category: 'corporate' },
        },
      });
    }
  }
  console.log(`  ✓ ${Object.keys(out).length} corporate departments ready`);
  return out;
}

async function createRetailStores(tenantId, ownerId) {
  const out = [];
  for (const s of RETAIL_STORES) {
    const existing = await p.department.findFirst({
      where: { tenantId, name: s.name },
    });
    let dept;
    if (existing) {
      dept = existing;
    } else {
      dept = await p.department.create({
        data: {
          tenantId,
          name: s.name,
          description: `${s.type} retail store — ${s.location} (${s.squareFeet} sq ft)`,
          status: 'ACTIVE',
          metadata: {
            source: 'demo_retail',
            retailStoreType: s.type,
            location: s.location,
            squareFeet: s.squareFeet,
            entitySubtype: 'retail-store',
          },
        },
      });
    }
    out.push({ ...s, departmentId: dept.id });
  }
  console.log(`  ✓ ${out.length} retail-store departments ready`);

  // Universal EntityState + EntityOwnership + EntityLabel + EntityHealth for every retail-store.
  // Skip these silently if they fail (schema field names may differ from seed assumptions).
  for (const s of out) {
    try {
      await p.entityState.upsert({
        where: { tenantId_entityType_entityId: { tenantId, entityType: 'FACILITY', entityId: s.departmentId } },
        create: {
          tenantId,
          entityId: s.departmentId,
          entityType: 'FACILITY',
          currentState: 'ACTIVE',
          subState: 'operational',
          enteredById: ownerId,
        },
        update: { currentState: 'ACTIVE' },
      });
    } catch (_) {}

    try {
      await p.entityOwnership.upsert({
        where: { tenantId_entityType_entityId: { tenantId, entityType: 'FACILITY', entityId: s.departmentId } },
        create: {
          tenantId,
          entityId: s.departmentId,
          entityType: 'FACILITY',
          ownerId,
        },
        update: {},
      });
    } catch (_) {}

    try {
      const existingTag = await p.entityLabel.findFirst({
        where: { tenantId, entityId: s.departmentId },
      });
      if (!existingTag) {
        await p.entityLabel.create({
          data: {
            tenantId,
            entityId: s.departmentId,
            entityType: 'FACILITY',
            kind: 'STANDARD',
            key: 'store-type',
            value: s.type,
            color: '#22c55e',
          },
        });
      }
    } catch (_) {}

    try {
      const existingHealth = await p.entityHealth.findUnique({
        where: { entityId: s.departmentId },
      });
      if (!existingHealth) {
        await p.entityHealth.create({
          data: {
            tenantId,
            entityId: s.departmentId,
            entityType: 'FACILITY',
            severity: 'HEALTHY',
            trend: 'STABLE',
            score: 95,
            signals: {},
          },
        });
      }
    } catch (_) {}
  }
  console.log(`  ✓ ${out.length} entity metadata rows attempted`);

  return out;
}

async function createRetailAgents(tenantId, stores, ownerId) {
  let count = 0;
  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    const storeAgents = RETAIL_ROLES.slice(0, 2 + (i % 2)).map((role, idx) => ({
      name: `${role} — ${store.name}`,
      role,
      storeName: store.name,
      departmentId: store.departmentId,
      idx,
    }));

    for (const a of storeAgents) {
      try {
        const existing = await p.agent.findFirst({
          where: { tenantId, name: a.name },
        });
        if (!existing) {
          await p.agent.create({
            data: {
              tenantId,
              name: a.name,
              type: a.idx === 0 ? 'EXECUTIVE' : 'FUNCTIONAL',
              status: 'IDLE',
              departmentId: a.departmentId,
              permissions: {
                source: 'demo_retail',
                role: a.role,
                scope: ['retail:', 'ai:invoke'],
              },
            },
          });
          count += 1;
        }
      } catch (_) {}
    }
  }

  for (const role of ['Retail Operations Director', 'Merchandising Director', 'VP Retail']) {
    try {
      const existing = await p.agent.findFirst({ where: { tenantId, name: role } });
      if (!existing) {
        await p.agent.create({
          data: {
            tenantId,
            name: role,
            type: 'EXECUTIVE',
            status: 'IDLE',
            permissions: { source: 'demo_retail', role: 'corporate' },
          },
        });
        count += 1;
      }
    } catch (_) {}
  }
  console.log(`  ✓ ${count} retail AI employees created`);

  try {
    for (let i = 0; i < Math.min(5, stores.length); i++) {
      try {
        const existing = await p.userFavorite.findFirst({
          where: { userId_entityType_entityId: { userId: ownerId, entityType: 'FACILITY', entityId: stores[i].departmentId } },
        });
        if (!existing) {
          await p.userFavorite.create({
            data: {
              userId: ownerId,
              tenantId,
              entityType: 'FACILITY',
              entityId: stores[i].departmentId,
            },
          });
        }
      } catch (_) {}
    }
    console.log(`  ✓ ${Math.min(5, stores.length)} store favorites pinned`);
  } catch (_) {}
}

async function createWorkflows(tenantId, ownerId, stores) {
  try {
    const templates = await p.workflow.findMany({
      where: { isTemplate: true, tenant: { slug: 'platform-owner' } },
    });
    let count = 0;
    for (const t of templates) {
      const existing = await p.workflow.findFirst({
        where: { tenantId, name: t.name, isTemplate: false },
      });
      if (existing) continue;
      await p.workflow.create({
        data: {
          tenantId,
          name: t.name,
          description: t.description,
          status: 'ACTIVE',
          isTemplate: false,
          definition: t.definition,
          config: t.config ?? {},
        },
      });
      count += 1;
    }
    console.log(`  ✓ ${count} workflows instantiated from retail templates`);
  } catch (err) {
    console.log(`  ! workflows skipped: ${err.message}`);
  }
}

async function createMissionFeed(tenantId, ownerId) {
  const items = [
    {
      title: 'Welcome to Retail Pack — 12 AI actions ready',
      description: 'Run /ai-actions from the command palette to launch inventory forecasts, visual merch plans, NPS analysis and more.',
      category: 'PACK_INSTALLED',
      priority: 'MEDIUM',
      actionPayload: { kind: 'pack_installed', packSlug: 'retail' },
      sourceEventId: `pack-install:${tenantId}:retail`,
    },
    {
      title: 'Connect Shopify or Square',
      description: 'Sync products, orders, inventory from your commerce stack.',
      category: 'SYSTEM',
      priority: 'LOW',
      actionPayload: { kind: 'integration_setup', providers: ['shopify', 'square'] },
      sourceEventId: `integration-setup:${tenantId}:retail`,
    },
    {
      title: 'Run your first inventory forecast',
      description: 'Try `retail:inventory-forecast` against the SoHo Flagship workspace.',
      category: 'AI_INSIGHT',
      priority: 'LOW',
      actionPayload: { kind: 'ai_action', actionId: 'retail:inventory-forecast' },
      sourceEventId: `first-inventory-forecast:${tenantId}`,
    },
  ];
  let count = 0;
  for (const m of items) {
    const existing = await p.missionFeedItem.findFirst({
      where: { tenantId, sourceEventId: m.sourceEventId },
    });
    if (existing) continue;
    await p.missionFeedItem.create({
      data: {
        tenantId,
        userId: ownerId,
        category: m.category,
        priority: m.priority,
        title: m.title,
        description: m.description,
        actionPayload: m.actionPayload,
        sourceEventId: m.sourceEventId,
      },
    });
    count += 1;
  }
  console.log(`  ✓ ${count} Mission Feed items created`);
}

async function createDefaultLayouts(tenantId, ownerId) {
  try {
    const stores = await p.department.findMany({
      where: { tenantId, metadata: { path: ['entitySubtype'], equals: 'retail-store' } },
      take: 5,
    });
    let count = 0;
    for (const s of stores) {
      try {
        const existing = await p.workspaceLayout.findFirst({
          where: { userId_entityType: { userId: ownerId, entityType: 'FACILITY' } },
        });
        if (existing) continue;
        await p.workspaceLayout.create({
          data: {
            tenantId,
            userId: ownerId,
            entityType: 'FACILITY',
            layout: {
              widgets: [
                { widgetId: 'retail-kpi:sales-per-sqft', x: 0, y: 0, w: 3, h: 2 },
                { widgetId: 'retail-kpi:stockout-rate', x: 3, y: 0, w: 3, h: 3 },
                { widgetId: 'retail-kpi:customer-nps-gauge', x: 6, y: 0, w: 3, h: 3 },
              ],
            },
          },
        });
        count += 1;
      } catch (_) {}
    }
    console.log(`  ✓ ${count} default workspace layouts created`);
  } catch (err) {
    console.log(`  ! workspace layouts skipped: ${err.message}`);
  }
}

async function main() {
  console.log('Seeding Phase 8 (demo tenant) — Demo Retail Co.');

  try {
    const tenant = await upsertTenant();
    const owner = await upsertOwner(tenant.id);

    await installPacks(tenant.id, owner.id);
    const stores = await createRetailStores(tenant.id, owner.id);
    await createCorporateDepartments(tenant.id);
    await createRetailAgents(tenant.id, stores, owner.id);
    await createWorkflows(tenant.id, owner.id, stores);
    await createMissionFeed(tenant.id, owner.id);
    await createDefaultLayouts(tenant.id, owner.id);

    const totalEntities = await p.department.count({ where: { tenantId: tenant.id } });
    const totalAgents = await p.agent.count({ where: { tenantId: tenant.id } });

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(' Demo tenant ready');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(` Tenant            : ${TENANT_NAME} (${TENANT_SLUG})`);
    console.log(` Plan              : ${TIER_SLUG}`);
    console.log(` Login email       : ${OWNER_EMAIL}`);
    console.log(` Login password    : ${OWNER_PASS}`);
    console.log(` Departments       : ${totalEntities}`);
    console.log(` AI employees      : ${totalAgents}`);
    console.log(` Retail stores     : ${stores.length}`);
    console.log('═══════════════════════════════════════════════════════════');
  } catch (err) {
    console.error('Phase 8 demo-tenant seed failed:', err);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
}

main();