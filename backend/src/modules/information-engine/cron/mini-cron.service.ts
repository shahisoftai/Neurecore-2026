/**
 * Cron-like Scheduler — Phase 2F
 *
 * Minimal homegrown scheduler. Avoids the `@nestjs/schedule` dependency so
 * we don't add a transitive nestjs dep just for one weekly job.
 *
 * Semantics:
 *   - `registerCron(cronExpression, fn)` parses the 5-field cron and runs
 *     `fn()` when the current minute matches.
 *   - `stop()` clears the interval; called from `OnModuleDestroy`.
 *   - The interval ticks every 30s (resolution of 1 minute is fine for a
 *     weekly job).
 *
 * This is intentionally small. For per-second or multi-zone cron, replace
 * with `@nestjs/schedule` later — the call sites (CompletenessService) are
 * unchanged.
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

type CronField = number | '*';

export interface CronExpression {
  minute: CronField;
  hour: CronField;
  dayOfMonth: CronField;
  month: CronField;
  dayOfWeek: CronField;
}

export interface ScheduledJob {
  expression: CronExpression;
  name: string;
  fn: () => Promise<void> | void;
}

function parseField(s: string): CronField {
  if (s === '*') return '*';
  const n = Number(s);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid cron field: ${s}`);
  }
  return n;
}

function parseCron(expression: string): CronExpression {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Cron expression must have 5 fields, got: ${expression}`);
  }
  return {
    minute: parseField(parts[0]),
    hour: parseField(parts[1]),
    dayOfMonth: parseField(parts[2]),
    month: parseField(parts[3]),
    dayOfWeek: parseField(parts[4]),
  };
}

function match(field: CronField, current: number): boolean {
  if (field === '*') return true;
  return field === current;
}

@Injectable()
export class MiniCronService implements OnModuleDestroy {
  private readonly logger = new Logger(MiniCronService.name);
  private readonly jobs: ScheduledJob[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTickMinute = '-1';

  registerCron(cronExpression: string, name: string, fn: () => Promise<void> | void): void {
    const expression = parseCron(cronExpression);
    this.jobs.push({ expression, name, fn });
    this.logger.log(
      `Registered cron job "${name}" (${cronExpression}); ${this.jobs.length} total`,
    );
    this.ensureRunning();
  }

  /** Manually tick — exposed for tests. Calls fns synchronously so the
   * test can assert immediately. */
  tickForTest(now: Date): void {
    for (const job of this.jobs) {
      const expr = job.expression;
      const ok =
        match(expr.minute, now.getMinutes()) &&
        match(expr.hour, now.getHours()) &&
        match(expr.dayOfMonth, now.getDate()) &&
        match(expr.month, now.getMonth() + 1) &&
        match(expr.dayOfWeek, now.getDay());
      if (!ok) continue;
      this.logger.log(`Cron tick (test): ${job.name}`);
      try {
        void job.fn();
      } catch (e) {
        this.logger.error(`Cron job "${job.name}" failed: ${e}`);
      }
    }
  }

  /** List of currently-registered jobs — exposed for tests. */
  listJobs(): Array<{ name: string; expression: CronExpression }> {
    return this.jobs.map((j) => ({ name: j.name, expression: j.expression }));
  }

  private ensureRunning(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.evaluate(new Date()), 30_000);
    // Don't keep the event loop alive on shutdown.
    if (typeof this.timer === 'object' && this.timer && 'unref' in this.timer) {
      (this.timer as { unref: () => void }).unref();
    }
  }

  private evaluate(now: Date): void {
    // Only fire once per (hour, minute) to avoid duplicate ticks when
    // the interval fires more than once within the same minute.
    const tickKey = `${now.getHours()}:${now.getMinutes()}`;
    if (tickKey === this.lastTickMinute) return;
    this.lastTickMinute = tickKey;

    for (const job of this.jobs) {
      const expr = job.expression;
      const ok =
        match(expr.minute, now.getMinutes()) &&
        match(expr.hour, now.getHours()) &&
        match(expr.dayOfMonth, now.getDate()) &&
        match(expr.month, now.getMonth() + 1) &&
        match(expr.dayOfWeek, now.getDay());
      if (!ok) continue;
      this.logger.log(`Cron tick: ${job.name}`);
      void Promise.resolve()
        .then(() => job.fn())
        .catch((e) => this.logger.error(`Cron job "${job.name}" failed: ${e}`));
    }
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}