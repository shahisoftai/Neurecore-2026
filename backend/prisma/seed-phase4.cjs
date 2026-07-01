const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  try {
    // Find or create demo tenant
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: 'Demo Tenant',
          slug: 'demo-tenant',
          plan: 'STARTER',
        },
      });
      console.log('Created demo tenant:', tenant.id);
    } else {
      console.log('Using existing tenant:', tenant.id);
    }

    // Create demo analytics model
    const model = await prisma.analyticsModel.create({
      data: {
        name: 'demo-revenue-forecast',
        version: 'v0.1',
        description: 'Demo forecasting model for revenue trends',
        tenantId: tenant.id,
      },
    });
    console.log('Created analytics model:', model.id);

    // Insert sample feature snapshots
    const now = new Date();
    const features = [
      { revenue_last_7d: 1200, active_users: 150, churn_rate: 0.02 },
      { revenue_last_7d: 980, active_users: 132, churn_rate: 0.025 },
    ];

    for (const f of features) {
      const af = await prisma.analyticsFeature.create({
        data: {
          tenantId: tenant.id,
          modelId: model.id,
          features: f,
          recordedAt: now,
        },
      });
      console.log('Created analytics feature:', af.id);
    }

    // Create a demo CRM connector
    const connector = await prisma.crmConnector.create({
      data: {
        name: 'demo-salesforce',
        provider: 'salesforce',
        config: { description: 'Demo connector; replace with real OAuth config' },
        tenantId: tenant.id,
        isActive: true,
      },
    });
    console.log('Created CRM connector:', connector.id);

    // Create tenant_limits entry
    const limits = await prisma.tenantLimit.upsert({
      where: { tenantId: tenant.id },
      update: { limits: { analyticsRequestsPerDay: 1000 } },
      create: { tenantId: tenant.id, limits: { analyticsRequestsPerDay: 1000 } },
    });
    console.log('Upserted tenant limits:', limits.id);

    console.log('Phase 4 demo seed complete.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
