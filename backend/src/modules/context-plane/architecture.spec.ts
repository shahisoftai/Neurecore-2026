/**
 * Context Plane — architecture tests (Phase 3 §16 architecture).
 * Fail on ADR-002 boundary violations.
 */

import * as fs from 'fs';
import * as path from 'path';

const MOD = path.resolve(__dirname, '..'); // .../backend/src/modules
const CP = path.join(MOD, 'context-plane');

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

describe('Context Plane — architecture', () => {
  const cpFiles = walk(CP);

  it('the plane + resolver + cache do not import capability Prisma repositories', () => {
    // Aggregation/resolution/cache must not centrally query capability tables.
    const core = cpFiles.filter((f) =>
      /\/(plane|cache|contracts)\//.test(f),
    );
    for (const f of core) {
      const src = read(f);
      expect(src).not.toMatch(/repositories\/prisma-/);
      expect(src).not.toMatch(/PrismaService/); // plane/cache never touch Prisma
    }
  });

  it('providers depend on capability SERVICES, not foreign Prisma repositories', () => {
    const providers = cpFiles.filter((f) => /\/providers\//.test(f));
    for (const f of providers) {
      const src = read(f);
      // A provider may import its capability's service; it must NOT import a
      // *.repository or another capability's prisma repository directly.
      expect(src).not.toMatch(/repositories\/prisma-/);
    }
  });

  it('Hermes does not directly access Projects/Customers/Finance/Tasks/Approvals repositories', () => {
    const hermes = walk(path.join(MOD, 'hermes'));
    for (const f of hermes) {
      const src = read(f);
      expect(src).not.toMatch(
        /modules\/(projects|customers|finance|orchestration)\/repositories\//,
      );
    }
  });

  it('Hermes context service obtains organizational state via the Context Plane', () => {
    const svc = read(path.join(MOD, 'hermes/services/hermes-context.service.ts'));
    expect(svc).toMatch(/CONTEXT_PLANE/);
    expect(svc).toMatch(/contextPlane/);
  });

  it('no unsafe hardcoded authority default (>=40) grants access to a resolved identity', () => {
    for (const f of cpFiles) {
      const src = read(f)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      // Safe conservative values (0 = deny/unknown, low values below provider
      // redact thresholds) are allowed. A mid/high literal default like 50 would
      // silently grant access and is forbidden.
      const matches = [...src.matchAll(/authorityLevel:\s*(\d+)/g)];
      for (const m of matches) {
        expect(Number(m[1])).toBeLessThan(40);
      }
    }
  });

  it('cache keys include tenant and authorization identity', () => {
    const cache = read(path.join(CP, 'cache/context-cache.service.ts'));
    // The key() builder must incorporate tenantId, actorId, access, authority.
    expect(cache).toMatch(/params\.tenantId/);
    expect(cache).toMatch(/params\.actorId/);
    expect(cache).toMatch(/params\.access/);
    expect(cache).toMatch(/params\.effectiveAuthority/);
  });

  it('providers use the shared authorization decision (FULL/REDACTED/DENIED)', () => {
    const providers = cpFiles.filter((f) => /\/providers\/.*-context\.provider\.ts$/.test(f));
    expect(providers.length).toBeGreaterThanOrEqual(7);
    for (const f of providers) {
      expect(read(f)).toMatch(/decide\(/);
    }
  });

  it('does not implement Phase 4+ modules (work-runtime, cognitive layer, approval-port)', () => {
    for (const f of cpFiles) {
      const src = read(f);
      // Match module IMPORTS of future-phase modules, not incidental words like
      // the RECOMMENDATION authority enum.
      expect(src).not.toMatch(
        /from '.*modules\/(work-runtime|enterprise-understanding|approval-port|enterprise-recommendation|enterprise-decision)/,
      );
    }
  });
});
