/**
 * In-memory fake Prisma modelling the Enterprise Event Fabric tables with the
 * semantics the transport relies on: conditional updateMany (atomic
 * compare-and-set), (tenantId,idempotencyKey) + (eventId,consumerId) +
 * (tenantId,idempotencyKey,consumerId) unique constraints, and $transaction
 * (interactive callback). Used by fabric tests so they run deterministically
 * without a live DB (matches the codebase's mocked-repository test style).
 *
 * Audit-remediation: the idempotency table unique was widened from
 * (idempotencyKey, consumerId) to (tenantId, idempotencyKey, consumerId) so
 * cross-tenant entries are distinct ledger records.
 *
 * This is a TEST DOUBLE — not production code.
 */

type Row = Record<string, any>;

function matchWhere(row: Row, where: Row): boolean {
  for (const [k, v] of Object.entries(where)) {
    if (v && typeof v === 'object' && 'lt' in v) {
      if (!(row[k] != null && row[k] < (v as any).lt)) return false;
    } else if (row[k] !== v) {
      return false;
    }
  }
  return true;
}

class Table {
  rows: Row[] = [];
  private seq = 0;
  constructor(
    private readonly name: string,
    private readonly uniques: string[][] = [],
    private readonly defaults: Row = {},
  ) {}

  private id(): string {
    this.seq += 1;
    return `${this.name}_${this.seq}`;
  }

  private checkUnique(data: Row, ignoreId?: string): void {
    for (const keys of this.uniques) {
      const dup = this.rows.find(
        (r) =>
          r.id !== ignoreId && keys.every((k) => r[k] === data[k]),
      );
      if (dup) {
        const err: any = new Error(`Unique constraint failed on ${keys.join(',')}`);
        err.code = 'P2002';
        throw err;
      }
    }
  }

  create({ data, select }: { data: Row; select?: Row }) {
    const row: Row = { id: data.id ?? this.id(), ...data };
    // defaults
    if (row.createdAt === undefined) row.createdAt = new Date();
    if (this.defaults) {
      for (const [k, v] of Object.entries(this.defaults)) {
        if (row[k] === undefined) row[k] = v;
      }
    }
    this.checkUnique(row);
    this.rows.push(row);
    return select ? this.project(row, select) : { ...row };
  }

  findUnique({ where, select }: { where: Row; select?: Row }) {
    // compound unique keys arrive as { a_b: { a, b } }
    const flat = this.flattenWhere(where);
    const row = this.rows.find((r) => matchWhere(r, flat));
    if (!row) return null;
    return select ? this.project(row, select) : { ...row };
  }

  findFirst({ where, orderBy, select }: { where?: Row; orderBy?: Row; select?: Row }) {
    let rows = this.rows.filter((r) => matchWhere(r, where ?? {}));
    rows = this.applyOrder(rows, orderBy);
    const row = rows[0];
    if (!row) return null;
    return select ? this.project(row, select) : { ...row };
  }

  findMany({ where, orderBy, take }: { where?: Row; orderBy?: Row; take?: number } = {}) {
    let rows = this.rows.filter((r) => matchWhere(r, where ?? {}));
    rows = this.applyOrder(rows, orderBy);
    if (take != null) rows = rows.slice(0, take);
    return rows.map((r) => ({ ...r }));
  }

  update({ where, data }: { where: Row; data: Row }) {
    const row = this.rows.find((r) => matchWhere(r, this.flattenWhere(where)));
    if (!row) {
      const err: any = new Error('Record to update not found');
      err.code = 'P2025';
      throw err;
    }
    Object.assign(row, data);
    return { ...row };
  }

  /** Atomic compare-and-set: only rows matching WHERE are updated. */
  updateMany({ where, data }: { where: Row; data: Row }) {
    const flat = this.flattenWhere(where);
    const matched = this.rows.filter((r) => matchWhere(r, flat));
    for (const row of matched) Object.assign(row, data);
    return { count: matched.length };
  }

  upsert({ where, create, update }: { where: Row; create: Row; update: Row }) {
    const flat = this.flattenWhere(where);
    const existing = this.rows.find((r) => matchWhere(r, flat));
    if (existing) {
      Object.assign(existing, update);
      return { ...existing };
    }
    return this.create({ data: create });
  }

  count({ where }: { where?: Row } = {}) {
    return this.rows.filter((r) => matchWhere(r, where ?? {})).length;
  }

  groupBy() {
    return [];
  }

  private applyOrder(rows: Row[], orderBy?: Row): Row[] {
    if (!orderBy) return rows;
    const [key, dir] = Object.entries(orderBy)[0] as [string, 'asc' | 'desc'];
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return dir === 'desc' ? -cmp : cmp;
    });
  }

  private flattenWhere(where: Row): Row {
    // Expand compound unique object like { tenantId_idempotencyKey: {..} } or
    // { eventId_consumerId: {..} } or { idempotencyKey_consumerId: {..} }.
    const out: Row = {};
    for (const [k, v] of Object.entries(where)) {
      if (v && typeof v === 'object' && !('lt' in v) && k.includes('_')) {
        Object.assign(out, v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  private project(row: Row, select: Row): Row {
    const out: Row = {};
    for (const k of Object.keys(select)) if (select[k]) out[k] = row[k];
    return out;
  }
}

export class FakePrisma {
  enterpriseEventOutbox = new Table(
    'outbox',
    [['tenantId', 'idempotencyKey']],
    { status: 'PENDING', retryCount: 0, version: 1 },
  );
  enterpriseEventInbox = new Table('inbox', [['eventId', 'consumerId']], {
    status: 'PENDING',
    retryCount: 0,
  });
  enterpriseEventDeadLetter = new Table('dl', [], { replayStatus: 'NONE' });
  enterpriseEventIdempotency = new Table('idem', [
    ['tenantId', 'idempotencyKey', 'consumerId'],
  ]);
  activityEvent = new Table('activity', [['sourceEventId']]);

  // inbox.include:{event:true} support
  private linkEvent(row: Row): Row {
    const event = this.enterpriseEventOutbox.rows.find(
      (e) => e.id === row.eventId,
    );
    return { ...row, event: event ? { ...event } : null };
  }

  constructor() {
    // Patch inbox.findUnique to support include:{event:true}
    const inbox = this.enterpriseEventInbox;
    const origFindUnique = inbox.findUnique.bind(inbox);
    (inbox as any).findUnique = ({ where, include, select }: any) => {
      const row = origFindUnique({ where, select });
      if (row && include?.event) return this.linkEvent(row);
      return row;
    };
  }

  async $transaction(arg: any): Promise<any> {
    // interactive callback form
    if (typeof arg === 'function') return arg(this);
    // array form
    return Promise.all(arg);
  }
}
