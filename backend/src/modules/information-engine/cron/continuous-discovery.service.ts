/**
 * ContinuousDiscovery — Service (Phase 2F)
 *
 * Single Responsibility: ensure EntityCompleteness stays fresh.
 * Three call paths:
 *   1. Stage transition to COMPLETED (called from ProjectStagesService.update)
 *   2. Deliverable submission (called from DeliverablesService.submit)
 *   3. Weekly cron (Monday 00:00) — iterates active projects, recomputes
 *      each, and writes a notification row for any project whose score
 *      is < 60 AND lastAssessedAt > 7 days ago.
 *
 * Plus a synchronous `validate(projectId)` method that the frontend can
 * call before destructive actions (sign contract, archive, etc).
 *
 * SOLID: only the CompletenessService + Prisma + a tiny NotifierInterface
 * are needed. We don't depend on any of the source/response services here.
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CompletenessService } from '../completeness/completeness.service';
import { MiniCronService } from './mini-cron.service';
import type { EntityCompletenessSnapshot } from '../completeness/interfaces/completeness.interface';
import { EngineErrors } from '../common/apperrors';

export const STALE_NOTIFIER = 'STALE_NOTIFIER';

export interface StaleNotifier {
  notify(input: {
    tenantId: string;
    projectId: string;
    projectName: string;
    score: number;
    lastAssessedAt: Date;
  }): Promise<void>;
}

@Injectable()
export class ContinuousDiscoveryService {
  private readonly logger = new Logger(ContinuousDiscoveryService.name);
  private cronStarted = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly completenessService: CompletenessService,
    private readonly cron: MiniCronService,
    @Optional() @Inject(STALE_NOTIFIER) private readonly notifier?: StaleNotifier,
    @Optional() private readonly eventBus?: any,
  ) {}

  /**
   * Start the weekly cron. Idempotent — multiple calls are no-ops.
   * Mounted from `OnApplicationBootstrap` in the engine-read module.
   */
  startCron(): void {
    if (this.cronStarted) return;
    this.cronStarted = true;
    this.cron.registerCron('0 0 * * 1', 'weekly-completeness-recompute', () => {
      void this.weeklyRecomputeAll();
    });
  }

  /**
   * Called from ProjectStagesService.update when a stage moves to COMPLETED.
   * Additive — returns void so the caller can fire-and-forget.
   */
  async onStageCompleted(projectId: string): Promise<void> {
    try {
      await this.completenessService.recompute('PROJECT', projectId);
    } catch (e) {
      this.logger.error(
        `onStageCompleted recompute failed for project ${projectId}: ${e}`,
      );
    }
  }

  /**
   * Called from DeliverablesService.submit. Same shape as onStageCompleted.
   */
  async onDeliverableSubmitted(projectId: string): Promise<void> {
    try {
      await this.completenessService.recompute('PROJECT', projectId);
    } catch (e) {
      this.logger.error(
        `onDeliverableSubmitted recompute failed for project ${projectId}: ${e}`,
      );
    }
  }

  /**
   * Sync validate for the frontend — returns the snapshot + missing[].
   * Throws on a project with a non-100 score and at least one required
   * missing question.
   */
  async validate(projectId: string): Promise<EntityCompletenessSnapshot> {
    const snapshot = await this.completenessService.get('PROJECT', projectId);
    if (!snapshot) {
      throw EngineErrors.badRequest(
        'NO_SNAPSHOT',
        `No completeness snapshot for project ${projectId}`,
      );
    }
    if (snapshot.totalRequired === 0) return snapshot;
    if (snapshot.score < 100) {
      throw EngineErrors.badRequest(
        'INCOMPLETE',
        `Project completeness is ${snapshot.score}% — ${snapshot.missing.length} required question(s) missing`,
        snapshot,
      );
    }
    return snapshot;
  }

  /**
   * Weekly cron: iterate all active projects, recompute each, and write a
   * notification for any project that's stale (score<60 + lastAssessed>7d).
   * Logging only — failure of one project does not stop the rest.
   */
  async weeklyRecomputeAll(): Promise<{ recomputed: number; stale: number }> {
    this.logger.log('weeklyRecomputeAll: starting');
    const projects = await this.prisma.project.findMany({
      where: { status: { in: ['ACTIVE', 'ON_HOLD', 'REVIEW'] } },
      select: { id: true, tenantId: true, name: true },
    });
    let recomputed = 0;
    let stale = 0;
    for (const p of projects) {
      try {
        const snap = await this.completenessService.recompute('PROJECT', p.id);
        recomputed += 1;
        if (this.isStale(snap)) {
          stale += 1;
          await this.notifyStale(p.tenantId, p.id, p.name, snap);
        }
      } catch (e) {
        this.logger.error(
          `weeklyRecomputeAll failed for project ${p.id}: ${e}`,
        );
      }
    }
    this.logger.log(
      `weeklyRecomputeAll: done — recomputed=${recomputed} stale=${stale}`,
    );
    return { recomputed, stale };
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private isStale(snap: EntityCompletenessSnapshot | null): boolean {
    if (!snap) return false;
    if (snap.score >= 60) return false;
    const ageMs = Date.now() - snap.lastAssessedAt.getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return ageMs > sevenDays;
  }

  private async notifyStale(
    tenantId: string,
    projectId: string,
    projectName: string,
    snap: EntityCompletenessSnapshot,
  ): Promise<void> {
    if (this.notifier) {
      try {
        await this.notifier.notify({
          tenantId,
          projectId,
          projectName,
          score: snap.score,
          lastAssessedAt: snap.lastAssessedAt,
        });
        return;
      } catch (e) {
        this.logger.error(`StaleNotifier failed: ${e}`);
      }
    }
    // No notifier wired — write to a structured log line so the operator
    // can wire one later. The plan says "notification_preferences (existing)"
    // — Phase 2F keeps the wiring out (no schema change); 2G wires it.
    this.logger.warn(
      `[stale] project=${projectId} tenant=${tenantId} name="${projectName}" score=${snap.score} lastAssessedAt=${snap.lastAssessedAt.toISOString()}`,
    );

    if (this.eventBus) {
      try {
        this.eventBus.publish({
          type: 'InformationGapsFound',
          projectId,
          tenantId,
          timestamp: new Date(),
          payload: {
            completenessScore: snap.score,
            missingCount: snap.missing.length,
          },
        });
      } catch { /* fire-and-forget */ }
    }
  }

  // Used by tests for the validate endpoint input shape.
  // Exposed here so the controller can construct the right throw.
  // (Intentionally not exported beyond this module.)
  static _validateInputShape(input: unknown): asserts input is { ok: true } | { ok: false; missing: unknown[] } {
    if (typeof input !== 'object' || input === null) {
      throw EngineErrors.badRequest('INVALID_SHAPE', 'expected an object');
    }
  }
}

// Type-only re-export so the controller can use the prisma client type.
export type ContinuousDiscoveryPrisma = PrismaClient;