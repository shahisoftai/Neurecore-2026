/**
 * AIActionsModule — Phase 5, EAOS-3 AI Actions.
 *
 * Per `EAOS-implementation-plan.md` §4.6, `EAOS-rbac-model.md` §6 and
 * `EAOS-implementation-roadmap.md` §9 (Phase 5 tasks 5.1-5.4).
 *
 * Public surface:
 *   - `POST /api/v1/ai-actions/execute`  (action-authorization-guarded)
 *   - `GET  /api/v1/ai-actions/available`  (Command Palette + panel picker)
 *   - `GET  /api/v1/ai-actions/:id`        (polling status + result)
 *   - `GET  /api/v1/ai-actions/:id/stream` (SSE — token-by-token)
 *
 * Internal providers:
 *   - `AIActionRegistry` (singleton, registered built-ins at boot)
 *   - `AIActionExecutor` (sync/streaming dispatch)
 *   - `ActionAuthorizationGuard` (Layer-3 RBAC + tier + credits + rate limit)
 *   - `AiActionKillSwitchGuard` (Phase 5 pre-req, global `DISABLE_AI_ACTIONS`)
 *   - `AiActionMetricsInterceptor` (Phase 5 pre-req, Prometheus)
 *
 * `DatabaseModule`, `CacheModule`, `TenantContextModule`, `FeatureFlagModule`
 * and `MetricsModule` are all `@Global` — they don't need to be imported here.
 */

import { Module } from '@nestjs/common';
import { AIActionsController } from './ai-actions.controller';
import { AIActionsService } from './services/ai-actions.service';
import { AIActionRegistry } from './ai-action.registry';
import { AIActionExecutor } from './services/ai-action.executor';
import { ActionAuthorizationGuard } from './guards/action-authorization.guard';
import { AiActionKillSwitchGuard } from './guards/ai-action-kill-switch.guard';
import { AiActionMetricsInterceptor } from './interceptors/ai-action-metrics.interceptor';
import { AIActionStreamingService } from './services/ai-action-streaming.service';
import { EventsModule } from '../events/events.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [EventsModule, MetricsModule],
  controllers: [AIActionsController],
  providers: [
    AIActionsService,
    AIActionRegistry,
    AIActionExecutor,
    AIActionStreamingService,
    ActionAuthorizationGuard,
    AiActionKillSwitchGuard,
    AiActionMetricsInterceptor,
  ],
  exports: [
    AIActionsService,
    AIActionRegistry,
    AIActionExecutor,
    AIActionStreamingService,
  ],
})
export class AIActionsModule {}
