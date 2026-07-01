#!/usr/bin/env node
/**
 * annotate-controllers.js — bulk-annotate all 34 EAOS controllers with
 * @ApiCommon() (which bundles @ApiTags, @ApiBearerAuth, @ApiSecurity).
 *
 * Phase 1, Task 1.11 (per EAOS-implementation-roadmap.md v1.3).
 *
 * Replaces the @ApiTags('@nestjs/swagger') that already exists on some
 * controllers with @ApiCommon() — the single source of truth.
 *
 * Idempotent: skips files that already use @ApiCommon.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(
  __dirname,
  '..',
  'src',
  'modules',
);

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.isFile() && p.endsWith('.controller.ts')) acc.push(p);
  }
  return acc;
}

const controllers = walk(ROOT);
console.log(`Found ${controllers.length} controllers.`);

let modified = 0;
let skipped = 0;
let errors = [];

for (const file of controllers) {
  const src = fs.readFileSync(file, 'utf8');

  if (src.includes('@ApiCommon')) {
    skipped += 1;
    continue;
  }

  // Derive the @ApiTags value from the resource folder name or class name
  // e.g. /agents/agents.controller.ts → 'agents'
  const resourceName = path.basename(path.dirname(file));
  const tag =
    resourceName === 'auth' || resourceName === 'streaming' || resourceName === 'deployment' || resourceName === 'agent-pool' || resourceName === 'analytics' || resourceName === 'reliability'
      ? resourceName
      : resourceName.replace(/-/g, '_');

  let newSrc;

  // Pattern A: controller has @ApiTags(...) — replace with @ApiCommon
  const apiTagsMatch = src.match(/^(@ApiTags\([^)]*\)\n)/m);
  if (apiTagsMatch) {
    newSrc = src.replace(apiTagsMatch[1], `@ApiCommon('${tag}')\n`);
  } else {
    // Pattern B: no @ApiTags — insert @ApiCommon right after the @Controller decorator
    const controllerMatch = src.match(
      /^(@Controller\([^)]*\)\n)/m,
    );
    if (!controllerMatch) {
      errors.push(`${file}: no @Controller decorator found`);
      continue;
    }
    newSrc = src.replace(
      controllerMatch[1],
      `${controllerMatch[1]}@ApiCommon('${tag}')\n`,
    );
  }

  // Make sure the import is present
  if (!newSrc.includes("from '../../common/decorators/api-common.decorator'") && !newSrc.includes("from '../common/decorators/api-common.decorator'")) {
    // Calculate the relative path
    // For /modules/agents/agents.controller.ts, file lives at depth 2 below /modules.
    // To get to /modules/common/..., we need ../../common (2 levels up = modules/).
    // For /modules/agents/streaming/agent-streaming.controller.ts, depth 3, we need 3 levels up.
    const relFromModules = file.split('/modules/')[1]; // e.g. "agents/agents.controller.ts"
    const depth = relFromModules.split('/').length - 1; // 1 for agents/, 2 for agents/streaming/
    // We need to go up `depth + 1` levels: depth levels out of the subfolder, then 1 more
    // to get out of /modules/ to /src/. Then `common/...` brings us back to /src/common/.
    const up = '../'.repeat(depth + 1);
    const importLine = `import { ApiCommon } from '${up}common/decorators/api-common.decorator';\n`;

    // Insert after the last @nestjs/swagger import
    const swaggerImportMatch = newSrc.match(
      /(import\s+\{[^}]*\}\s+from\s+['"]@nestjs\/swagger['"];?\n)/,
    );
    if (swaggerImportMatch) {
      newSrc = newSrc.replace(
        swaggerImportMatch[1],
        swaggerImportMatch[1] + importLine,
      );
    } else {
      // No swagger import yet — insert after the @nestjs/common import
      const commonImportMatch = newSrc.match(
        /(import\s+\{[^}]*\}\s+from\s+['"]@nestjs\/common['"];?\n)/,
      );
      if (commonImportMatch) {
        newSrc = newSrc.replace(
          commonImportMatch[1],
          commonImportMatch[1] + importLine,
        );
      } else {
        // No common import either — insert at the very top
        newSrc = importLine + newSrc;
      }
    }
  }

  fs.writeFileSync(file, newSrc);
  modified += 1;
  console.log(`  ✓ ${path.relative(ROOT, file)}`);
}

console.log(`\nDone: ${modified} modified, ${skipped} skipped (already had @ApiCommon).`);
if (errors.length) {
  console.log(`\nERRORS (${errors.length}):`);
  errors.forEach((e) => console.log(`  - ${e}`));
  process.exit(1);
}
