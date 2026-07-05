/**
 * MissionFeedAiPrioritizer — Phase 5, Task 5.11.
 *
 * Background job that runs every 5 minutes (configurable) per
 * `EAOS-implementation-plan.md` §14.2 Q1 and §EAOS-api-contract.md §13.4.
 *
 * Responsibilities:
 *   1. Scan each active tenant for MissionFeedItems that have not been
 *      AI-scored yet (no `actionPayload.aiScore`) OR are stale (>1 hour).
 *   2. Re-prioritize them using a deterministic heuristic that mirrors
 *      the placeholder AI Action output (Phase 5 ships with heuristics;
 *      Phase 6 will swap in real Knowledge-backed RAG).
 *   3. Bump `actionPayload.aiScore` and `priority` based on signals:
 *        - category weight (COST_ALERT > LIFECYCLE_BLOCKED > others)
 *        - entity state (SUSPENDED/DELETED → reduce priority)
 *        - time since detection (older → lower priority, but never < LOW)
 *   4. Emit `mission_feed:updated` for downstream subscribers.
 *
 * SOLID:
 *   - SRP — only handles prioritization. Persistence + REST live in
 *     `MissionFeedService`.
 *   - OCP — the scoring heuristic is a single function (`scoreItem`)
 *     that can be swapped out without touching the scheduler.
 *   - DIP — depends on PrismaService + EventsGateway abstractions.
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MissionFeedCategory,
  MissionFeedItem,
  MissionFeedPriority,
  PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';

interface PrioritizedItem {
  id: string;
  tenantId: string;
  category: MissionFeedCategory;
  priority: MissionFeedPriority;
  detectedAt: Date;
  entityType: string | null;
  entityId: string | null;
  actionPayload: Record<string, unknown>;
}

interface ScoreBreakdown {
  total: number;
  reasons: string[];
}

const CATEGORY_WEIGHTS: Record<MissionFeedCategory, number> = {
  COST_ALERT: 0.95,
  LIFECYCLE_BLOCKED: 0.85,
  APPROVAL_REQUIRED: 0.78,
  HEALTH_DEGRADED: 0.82,
  ANOMALY_DETECTED: 0.88,
  AI_INSIGHT: 0.7,
  COLLABORATION_REQUEST: 0.55,
  SYSTEM: 0.4,
  PACK_INSTALLED: 0.6,
  ONBOARDING_TASK: 0.5,
};

const PRIORITY_THRESHOLDS: Array<{
  priority: MissionFeedPriority;
  minScore: number;
}> = [
  { priority: 'CRITICAL', minScore: 0.85 },
  { priority: 'HIGH', minScore: 0.7 },
  { priority: 'MEDIUM', minScore: 0.45 },
  { priority: 'LOW', minScore: 0 },
];

@Injectable()
export class MissionFeedAiPrioritizer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MissionFeedAiPrioritizer.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  private readonly intervalMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly config: ConfigService,
  ) {
    this.intervalMs =
      Number(this.config.get<string | number>('MISSION_FEED_AI_INTERVAL_MS')) ||
      5 * 60_000;
  }

  onModuleInit(): void {
    if (this.config.get<string>('DISABLE_MISSION_FEED_AI') === 'true') {
      this.logger.warn(
        'MissionFeedAiPrioritizer DISABLED via env (DISABLE_MISSION_FEED_AI=true)',
      );
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    // Kick off an initial run after 5s so the dashboard has data on first paint.
    setTimeout(() => void this.tick(), 5_000);
    this.logger.log(
      `MissionFeedAiPrioritizer scheduled every ${this.intervalMs / 1000}s`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Single pass: score + update all items that need re-scoring.
   * Idempotent — safe to run as often as you like.
   */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });

      let totalUpdated = 0;
      for (const t of tenants) {
        totalUpdated += await this.scoreTenant(t.id);
      }
      if (totalUpdated > 0) {
        this.logger.log(`AI prioritization pass updated ${totalUpdated} items`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI prioritization pass failed: ${msg}`);
    } finally {
      this.running = false;
    }
  }

  private async scoreTenant(tenantId: string): Promise<number> {
    const cutoff = new Date(Date.now() - 60 * 60_000);
    // FIX-007 (defensive): filter to only categories the *deployed* Prisma
    // client knows about. If the prod Prisma client was regenerated before
    // the WS-2.1 onboarding migration shipped to prod, the client enum will
    // be missing ONBOARDING_TASK/PACK_INSTALLED and findMany() throws
    // "Value 'ONBOARDING_TASK' not found in enum 'MissionFeedCategory'".
    // We compute the intersection at runtime so this is forward-compatible.
    const knownCategories = (
      Object.keys(CATEGORY_WEIGHTS) as Array<MissionFeedCategory>
    ).filter((c) => CATEGORY_WEIGHTS[c] !== undefined);

    let items: MissionFeedItem[];
    try {
      items = await this.prisma.missionFeedItem.findMany({
        where: {
          tenantId,
          dismissedAt: null,
          category: { in: knownCategories },
          OR: [
            // Not yet scored OR detected recently.
            { detectedAt: { gte: cutoff } },
          ],
        },
        take: 200,
        orderBy: [{ detectedAt: 'desc' }],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `scoreTenant(${tenantId}): findMany failed (likely enum drift): ${msg}. Skipping this pass.`,
      );
      return 0;
    }

    let updated = 0;
    for (const item of items) {
      const breakdown = this.scoreItem(item);
      const nextPayload = {
        ...((item.actionPayload as Record<string, unknown>) ?? {}),
        aiScore: breakdown.total,
        aiScoredAt: new Date().toISOString(),
        aiReasons: breakdown.reasons,
      };
      const nextPriority = priorityFromScore(breakdown.total);

      const currentPayload =
        (item.actionPayload as Record<string, unknown>) ?? {};
      const currentScore =
        typeof currentPayload['aiScore'] === 'number'
          ? currentPayload['aiScore']
          : null;
      if (currentScore === breakdown.total && item.priority === nextPriority) {
        continue;
      }

      try {
        await this.prisma.missionFeedItem.update({
          where: { id: item.id },
          data: {
            priority: nextPriority,
            actionPayload: nextPayload as never,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `scoreTenant(${tenantId}): update(${item.id}) failed: ${msg}`,
        );
        continue;
      }
      updated++;
    }

    if (updated > 0) {
      this.events.emitToTenant(tenantId, 'mission_feed:updated', {
        tenantId,
        updated,
      });
    }
    return updated;
  }

  /**
   * Pure function — easy to unit-test, easy to swap for an LLM call
   * in Phase 6.
   */
  scoreItem(item: MissionFeedItem | PrioritizedItem): ScoreBreakdown {
    const reasons: string[] = [];
    let score = 0;

    // 1. Category weight (0-1).
    const categoryWeight = CATEGORY_WEIGHTS[item.category] ?? 0.5;
    score += categoryWeight * 0.6;
    reasons.push(`category:${item.category}=${categoryWeight.toFixed(2)}`);

    // 2. Recency boost (newer items score higher).
    const ageMs = Date.now() - new Date(item.detectedAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    const recency = Math.max(0, 1 - ageHours / 24); // full credit if < 1h, zero after 24h
    score += recency * 0.25;
    if (recency > 0.7) reasons.push('recent');

    // 3. Entity-type boost — operational entities get a small bump
    //    over configuration entities.
    if (
      item.entityType &&
      ['TASK', 'AGENT', 'WORKFLOW', 'ROUTINE'].includes(item.entityType)
    ) {
      score += 0.1;
      reasons.push(`entity:${item.entityType}`);
    }

    // 4. Confidence from existing payload (if previously scored).
    const prev = (item.actionPayload as Record<string, unknown> | null) ?? null;
    if (prev && typeof prev['confidence'] === 'number') {
      const conf = Math.max(0, Math.min(1, prev['confidence']));
      score += conf * 0.05;
    }

    // Clamp.
    const total = Math.max(0, Math.min(1, score));
    return { total, reasons };
  }
}

function priorityFromScore(score: number): MissionFeedPriority {
  for (const { priority, minScore } of PRIORITY_THRESHOLDS) {
    if (score >= minScore) return priority;
  }
  return 'LOW';
}

// Re-export the PrismaClient type for tests.
export type { PrismaClient };
