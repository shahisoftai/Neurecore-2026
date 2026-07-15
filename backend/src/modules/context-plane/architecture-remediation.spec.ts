/**
 * Architecture spec — Phase 3 audit-remediation.
 *
 * Pins the resolver against regression of:
 *  (A) silent numeric authorityLevel defaults (no `?? 40` or `?? 20` in
 *      the resolver identity branches);
 *  (B) controller exposing cache.stats() global aggregate to the caller
 *      (must filter to the caller's tenant).
 *
 * Textual guard because identity resolution requires a real Prisma; the
 * gating in-memory "plane.spec.ts" already proves the fail-safe path when
 * the resolver returns null.
 */

import * as fs from 'fs';
import * as path from 'path';

const MOD = path.resolve(__dirname, '..'); // .../backend/src/modules
const CP = path.join(MOD, 'context-plane');
const ADMIN = path.join(CP, 'context-plane-admin.controller.ts');
const RES = path.join(CP, 'resolvers/context-identity.resolver.ts');

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

describe('Context Plane — audit-remediation architecture', () => {
  it('identity resolver does NOT silently default authority on unknown enum', () => {
    const src = read(RES);
    // No `?? 20` after AUTHORITY_ENUM_TO_LEVEL[…] (the agent fallback) and
    // no `?? 40` after HUMAN_ROLE_TO_AUTHORITY[…] (the human fallback).
    expect(src).not.toMatch(/AUTHORITY_ENUM_TO_LEVEL\[[^\]]+\]\s*\?\?\s*\d+/);
    expect(src).not.toMatch(/HUMAN_ROLE_TO_AUTHORITY\[[^\]]+\]\s*\?\?\s*\d+/);
    // And the resolver must log + return null on unresolved on both paths.
    expect(src).toMatch(/unrecognized authorityLevel/);
    expect(src).toMatch(/unrecognized role/);
  });

  it('admin controller filters cacheStats to the caller tenant (never the aggregate)', () => {
    const src = read(ADMIN);
    // Must NOT call stats() directly without a byTenant filter; must
    // pick out `all.byTenant[tenantId]` or equivalent.
    expect(src).toMatch(/byTenant/);
    // And the returned shape includes `tenantId` so callers can verify.
    expect(src).toMatch(/tenantId/);
  });

  it('cache service exposes per-tenant counters', () => {
    const cacheSrc = read(path.join(CP, 'cache/context-cache.service.ts'));
    expect(cacheSrc).toMatch(/byTenant/);
    expect(cacheSrc).toMatch(/bumpTenant/);
  });
});
