/**
 * Architecture tests (Phase 2 §16 architecture).
 *
 * Static-analysis guards that fail if Phase 2 boundaries are violated:
 *  - Hermes must not own/import the concrete Event Fabric transport.
 *  - Producers depend on the transport PORT (EVENT_TRANSPORT), not the class.
 *  - The transport must not import capability services (no business logic).
 *  - Socket.IO must not be used as durable transport by the fabric.
 *  - Only registered event types are published in source.
 */

import * as fs from 'fs';
import * as path from 'path';

const MOD = path.resolve(__dirname, '..'); // .../backend/src/modules

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

describe('Enterprise Event Fabric — architecture', () => {
  it('Hermes does not import the concrete EnterpriseEventTransport', () => {
    const hermesFiles = walk(path.join(MOD, 'hermes'));
    const offenders = hermesFiles.filter((f) =>
      /enterprise-events\/transport\/enterprise-event-transport\.service/.test(
        read(f),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('Hermes no longer exposes a class named EnterpriseEventBusService', () => {
    const hermesFiles = walk(path.join(MOD, 'hermes'));
    const offenders = hermesFiles.filter((f) =>
      /class\s+EnterpriseEventBusService/.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });

  it('producers depend on the EVENT_TRANSPORT port, not the concrete class', () => {
    // Files that inject the transport should reference the EVENT_TRANSPORT
    // symbol, not `new EnterpriseEventTransport(` or a direct provider import
    // of the concrete class (outside the enterprise-events module itself).
    const producerFiles = [
      path.join(MOD, 'projects/repositories/prisma-project.repository.ts'),
      path.join(MOD, 'information-engine/clients/project-completeness.service.ts'),
      path.join(MOD, 'information-engine/responses/response.controller.ts'),
      path.join(MOD, 'orchestration/services/tasks.service.ts'),
    ];
    for (const f of producerFiles) {
      const src = read(f);
      expect(src).toMatch(/EVENT_TRANSPORT/);
      expect(src).not.toMatch(/new EnterpriseEventTransport\(/);
    }
  });

  it('the transport does not import capability services (no business logic)', () => {
    const transport = read(
      path.join(MOD, 'enterprise-events/transport/enterprise-event-transport.service.ts'),
    );
    // Must not import Projects/EIE/Finance/Approvals capability services.
    expect(transport).not.toMatch(/projects\/.*\.service/);
    expect(transport).not.toMatch(/information-engine\/.*\.service/);
    expect(transport).not.toMatch(/finance\/.*\.service/);
  });

  it('the fabric does not use Socket.IO as durable transport', () => {
    const fabricFiles = walk(path.join(MOD, 'enterprise-events'));
    // Only the UI projection consumer may reference the gateway, and only to
    // emit a presentation projection — never the transport/outbox path.
    const transportFiles = fabricFiles.filter((f) =>
      /transport\/|idempotency\//.test(f),
    );
    for (const f of transportFiles) {
      expect(read(f)).not.toMatch(/EventsGateway|socket\.io|emitTo/i);
    }
  });

  it('all published event types in source are registered', () => {
    const registry = read(
      path.join(MOD, 'enterprise-events/contracts/enterprise-event-registry.ts'),
    );
    const registered = new Set(
      [...registry.matchAll(/'(enterprise\.[a-z.]+)':/g)].map((m) => m[1]),
    );
    // Find eventType: 'enterprise.*' literals across producers.
    const allFiles = walk(MOD);
    const published = new Set<string>();
    for (const f of allFiles) {
      if (f.includes('enterprise-event-registry')) continue;
      for (const m of read(f).matchAll(
        /eventType:\s*'(enterprise\.[a-z.]+)'/g,
      )) {
        published.add(m[1]);
      }
    }
    const unregistered = [...published].filter((t) => !registered.has(t));
    expect(unregistered).toEqual([]);
  });
});
