import {
  AIActionStreamingService,
  ActionStreamEventType,
} from '../../src/modules/ai-actions/services/ai-action-streaming.service';

/**
 * Unit tests for AIActionStreamingService — Phase 5, Task 5.4.
 */

describe('AIActionStreamingService', () => {
  let svc: AIActionStreamingService;

  beforeEach(() => {
    svc = new AIActionStreamingService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates and emits events into a session subject', () => {
    const subj = svc.createSession({
      invocationId: 'inv-1',
      tenantId: 't',
      userId: 'u',
    });
    const seen: string[] = [];
    subj.subscribe((e) => seen.push(e.type));
    svc.emit('inv-1', {
      type: ActionStreamEventType.START,
      invocationId: 'inv-1',
      timestamp: 1,
    });
    expect(seen).toContain('start');
    svc.closeSession('inv-1');
  });

  it('reuses the same subject for the same invocationId', () => {
    const a = svc.createSession({ invocationId: 'inv-2', tenantId: 't', userId: 'u' });
    const b = svc.createSession({ invocationId: 'inv-2', tenantId: 't', userId: 'u' });
    expect(a).toBe(b);
    svc.closeSession('inv-2');
  });

  it('emits delta + citation + done for an AIActionStreamChunk', () => {
    const subj = svc.createSession({
      invocationId: 'inv-3',
      tenantId: 't',
      userId: 'u',
    });
    const seen: Array<{ type: string; data?: unknown }> = [];
    subj.subscribe((e) => seen.push({ type: e.type, data: e.data }));
    svc.emitChunk('inv-3', { type: 'delta', delta: 'Hello ' });
    svc.emitChunk('inv-3', {
      type: 'citation',
      citation: { knowledgeEntryId: 'k1', label: 'Doc', confidence: 0.9 },
    });
    svc.emitChunk('inv-3', {
      type: 'done',
      result: { output: 'Hello world', tokensUsed: { total: 5 } },
    });
    expect(seen.map((s) => s.type)).toEqual(['delta', 'citation', 'complete']);
    expect((seen[0].data as { delta?: string }).delta).toBe('Hello ');
    expect((seen[1].data as { citation?: { knowledgeEntryId?: string } }).citation?.knowledgeEntryId).toBe('k1');
    expect((seen[2].data as { result?: { output?: string } }).result?.output).toBe(
      'Hello world',
    );
    svc.closeSession('inv-3');
  });

  it('returns session ownership info via getSession', () => {
    svc.createSession({ invocationId: 'inv-4', tenantId: 'tenant-A', userId: 'u-9' });
    expect(svc.getSession('inv-4')).toEqual({ tenantId: 'tenant-A', userId: 'u-9' });
    svc.closeSession('inv-4');
  });

  it('closeSession removes the subject', () => {
    svc.createSession({ invocationId: 'inv-5', tenantId: 't', userId: 'u' });
    svc.closeSession('inv-5');
    expect(svc.getSession('inv-5')).toBeUndefined();
    expect(svc.getSubject('inv-5')).toBeUndefined();
  });
});
