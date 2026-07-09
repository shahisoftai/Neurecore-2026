/**
 * mini-cron.service.spec.ts — Phase 2F unit tests
 *
 * Covers the cron expression parser + manual tick semantics.
 */

import { MiniCronService } from './mini-cron.service';

describe('MiniCronService', () => {
  let svc: MiniCronService;

  beforeEach(() => {
    svc = new MiniCronService();
  });

  it('parses 5-field cron expressions on register', () => {
    svc.registerCron('0 0 * * 1', 'weekly', jest.fn());
    const jobs = svc.listJobs();
    expect(jobs.length).toBe(1);
    expect(jobs[0].name).toBe('weekly');
    expect(jobs[0].expression.minute).toBe(0);
    expect(jobs[0].expression.hour).toBe(0);
    expect(jobs[0].expression.dayOfMonth).toBe('*');
  });

  it('runs the registered fn when the tick matches', () => {
    const fn = jest.fn();
    svc.registerCron('0 12 * * 1', 'noon-monday', fn);
    const localNoonMon = new Date(2026, 6, 13, 12, 0, 0);
    svc.tickForTest(localNoonMon);
    expect(fn).toHaveBeenCalledTimes(1);
    // Calling again in the same test tick fires again (no dedupe in tickForTest).
    svc.tickForTest(localNoonMon);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT run the fn when the tick does not match', () => {
    const fn = jest.fn();
    svc.registerCron('0 12 * * 1', 'noon-monday', fn);
    // Monday 11:00 — should NOT fire.
    const localMon11 = new Date(2026, 6, 13, 11, 0, 0);
    svc.tickForTest(localMon11);
    expect(fn).not.toHaveBeenCalled();
  });

  it('throws on malformed expressions', () => {
    expect(() => svc.registerCron('* * *', 'bad', jest.fn())).toThrow(
      /must have 5 fields/,
    );
    expect(() => svc.registerCron('abc 0 * * 1', 'bad', jest.fn())).toThrow(
      /Invalid cron field/,
    );
  });

  it('supports multiple registered jobs in parallel', () => {
    const a = jest.fn();
    const b = jest.fn();
    svc.registerCron('0 9 * * *', 'morning', a);
    svc.registerCron('0 17 * * *', 'evening', b);
    const morning = new Date(2026, 6, 13, 9, 0, 0);
    svc.tickForTest(morning);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    const evening = new Date(2026, 6, 13, 17, 0, 0);
    svc.tickForTest(evening);
    expect(b).toHaveBeenCalledTimes(1);
  });
});