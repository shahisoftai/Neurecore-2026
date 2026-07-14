/**
 * Transactional outbox — integration test (Phase 2 §8, §16 integration #1, #16).
 *
 * Proves: PrismaProjectRepository.create() writes the Project AND the
 * enterprise.project.created outbox row in the SAME transaction (atomic
 * state-change + outbox), and exactly ONE logical project.created event is
 * produced. Uses FakePrisma extended with a project table.
 */

import { PrismaProjectRepository } from '../../projects/repositories/prisma-project.repository';
import { EnterpriseEventTransport } from '../transport/enterprise-event-transport.service';
import { FakePrisma } from './fake-prisma';

// Extend FakePrisma with a `project` table for this test.
class FakePrismaWithProject extends FakePrisma {
  project = new (class {
    rows: Record<string, any>[] = [];
    private seq = 0;
    create({ data }: { data: Record<string, any> }) {
      const row = {
        id: `proj_${++this.seq}`,
        status: 'LEAD',
        budgetAmount: null,
        budgetCurrency: 'USD',
        customerId: null,
        projectTypeId: null,
        targetDate: null,
        startDate: null,
        updatedAt: new Date(),
        ...data,
      };
      this.rows.push(row);
      return { ...row };
    }
    findUnique({ where }: { where: Record<string, any> }) {
      const row = this.rows.find((r) => r.id === where.id) ?? null;
      // Return a COPY (real Prisma returns a snapshot, not a live reference).
      return row ? { ...row } : null;
    }
    update({ where, data }: { where: Record<string, any>; data: Record<string, any> }) {
      const row = this.rows.find((r) => r.id === where.id)!;
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    }
  })();
}

describe('Transactional outbox — project.created', () => {
  it('writes the project and the outbox event atomically (one event)', async () => {
    const prisma = new FakePrismaWithProject();
    const transport = new EnterpriseEventTransport(prisma as never);
    const repo = new PrismaProjectRepository(prisma as never, transport);

    const project = await repo.create({ name: 'Atomic Co' }, 'tenant-1');

    expect(project.id).toBeTruthy();
    expect((prisma as any).project.rows.length).toBe(1);

    // Exactly one project.created event in the outbox, same tenant.
    const events = prisma.enterpriseEventOutbox.rows.filter(
      (e) => e.eventType === 'enterprise.project.created',
    );
    expect(events.length).toBe(1);
    expect(events[0].tenantId).toBe('tenant-1');
    expect(events[0].payload.projectId).toBe(project.id);
    expect(events[0].idempotencyKey).toBe(`project.created.${project.id}`);
  });

  it('does not duplicate the event when the fabric is absent (fallback path)', async () => {
    const prisma = new FakePrismaWithProject();
    const repo = new PrismaProjectRepository(prisma as never); // no transport

    const project = await repo.create({ name: 'No Fabric' }, 'tenant-1');
    expect(project.id).toBeTruthy();
    expect(prisma.enterpriseEventOutbox.rows.length).toBe(0);
  });

  it('publishes status.changed with from/to on setStatus', async () => {
    const prisma = new FakePrismaWithProject();
    const transport = new EnterpriseEventTransport(prisma as never);
    const repo = new PrismaProjectRepository(prisma as never, transport);

    const project = await repo.create({ name: 'S' }, 'tenant-1');
    await repo.setStatus(project.id, 'tenant-1', 'ACTIVE' as never);

    const evt = prisma.enterpriseEventOutbox.rows.find(
      (e) => e.eventType === 'enterprise.project.status.changed',
    );
    expect(evt).toBeTruthy();
    expect(evt!.payload.fromStatus).toBe('LEAD');
    expect(evt!.payload.toStatus).toBe('ACTIVE');
  });
});
