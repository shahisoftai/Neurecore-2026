// Temporary Phase 4 augmentation for PrismaClient delegate typings.
//
// Why: On Windows, `prisma generate` can fail with EPERM when the query engine
// DLL is locked. Until `npx prisma generate` succeeds, TypeScript will not see
// the new model delegates (invoice, oAuthToken, quotaUsage, etc.) and will flag
// valid code as errors.
//
// This file unblocks compilation/type-checking. Remove once Prisma Client is
// successfully regenerated and delegates appear in @prisma/client types.

import '@prisma/client';

declare module '@prisma/client' {
  // Merge extra delegates into the generated PrismaClient type.
  // This does NOT replace PrismaClient's existing methods.
  interface PrismaClient {
    analyticsModel: any;
    analyticsFeature: any;
    crmConnector: any;
    tenantLimit: any;

    oAuthToken: any;

    invoice: any;
    expense: any;
    billingEvent: any;

    quotaUsage: any;
  }
}
