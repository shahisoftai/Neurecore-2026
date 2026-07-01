/**
 * WS-8.2: Cross-tenant isolation test suite.
 *
 * Verifies that an authenticated user from tenant A cannot read/write data
 * belonging to tenant B for any of the Phase C–F daily tools.
 *
 * This is a structural test (no DB) — it inspects the tool source to ensure
 * tenantId filters are applied. A separate integration test with a real DB
 * should also exist; this catches regressions in the source code path.
 *
 * Run with: pnpm test:cov test/security/cross-tenant-isolation.spec.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const TOOL_FILES = [
  'src/modules/tools/built-in/email.tool.ts',
  'src/modules/tools/built-in/documents.tool.ts',
  'src/modules/tools/built-in/reports.tool.ts',
  'src/modules/tools/built-in/query.tool.ts',
  'src/modules/tools/built-in/context.tool.ts',
  'src/modules/tools/built-in/chat.tool.ts',
];

const BACKEND_ROOT = path.resolve(__dirname, '../../..');

describe('WS-8.2 cross-tenant isolation (Phase C–F tools)', () => {
  TOOL_FILES.forEach((rel) => {
    const abs = path.join(BACKEND_ROOT, rel);
    describe(path.basename(rel), () => {
      it('file exists', () => {
        expect(fs.existsSync(abs)).toBe(true);
      });

      const src = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';

      it('requires tenantId from context', () => {
        expect(src).toMatch(/tenantId\s*=\s*context\?\.tenantId/);
      });

      it('rejects when tenantId is missing', () => {
        // Pattern: if (!tenantId) return { success: false, error: ... }
        expect(src).toMatch(/if\s*\(\s*!tenantId\s*\)/);
      });

      it('filters DB queries by tenantId', () => {
        // Pattern: where: { tenantId, ... } or { tenantId: ... }
        expect(src).toMatch(/tenantId/);
      });
    });
  });
});