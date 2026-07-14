/**
 * di-boot-gate.js — Deployment Hardening Gate (DEPLOY-001)
 *
 * Creates the full NestJS application context WITHOUT starting the HTTP server.
 * This deterministically catches, BEFORE any release is promoted:
 *   - undefined modules,
 *   - unresolvable providers,
 *   - circular module dependencies,
 *   - application initialization failures.
 *
 * Exit codes:
 *   0  → DI graph instantiated successfully (safe to deploy)
 *   1  → DI/module/provider failure (MUST abort the deployment)
 *
 * Usage (run against the freshly BUILT dist, before promoting a release):
 *   node dist/src/../../scripts/di-boot-gate.js
 *   (or) node scripts/di-boot-gate.js   from the backend dir after `nest build`
 *
 * Notes:
 *   - Requires the compiled dist to exist (run after `nest build`).
 *   - Uses createApplicationContext (no listen) so no port is bound.
 *   - Closes the context and forces exit so open handles (DB pools, cron)
 *     do not hang the gate.
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');

const TIMEOUT_MS = 60_000;

async function main() {
  const distMain = path.resolve(__dirname, '..', 'dist', 'src', 'app.module.js');
  let AppModule;
  try {
    ({ AppModule } = require(distMain));
  } catch (e) {
    console.error(
      `DI_BOOT_FAIL: cannot load compiled AppModule at ${distMain} — did you run "nest build"? ${e.message}`,
    );
    process.exit(1);
    return;
  }

  const { NestFactory } = require('@nestjs/core');

  const timer = setTimeout(() => {
    console.error(
      `DI_BOOT_FAIL: application context did not initialize within ${TIMEOUT_MS}ms`,
    );
    process.exit(1);
  }, TIMEOUT_MS);
  timer.unref();

  try {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
      abortOnError: false,
    });
    clearTimeout(timer);
    console.log('DI_BOOT_OK: NestJS application context instantiated cleanly');
    await app.close();
    process.exit(0);
  } catch (e) {
    clearTimeout(timer);
    const firstLine = String(e && e.message ? e.message : e).split('\n')[0];
    console.error(`DI_BOOT_FAIL: ${firstLine}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`DI_BOOT_FAIL: ${String(e && e.message ? e.message : e).split('\n')[0]}`);
  process.exit(1);
});
