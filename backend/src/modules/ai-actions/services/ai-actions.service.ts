/**
 * AIActionsService — Phase 5, EAOS-3 AI Actions execution.
 *
 * Per `EAOS-implementation-plan.md` §4.6, `EAOS-api-contract.md` §13.2
 * + `EAOS-implementation-roadmap.md` §9 Phase 5 tasks 5.3 + 5.4 + 5.5.
 *
 * Responsibilities:
 *   1. `execute(...)` — persist the invocation row, drive the executor,
 *      emit `intelligence:refreshed` on completion, return the
 *      `invocationId` immediately for the polling/SSE path.
 *   2. `getInvocation(...)` — read for `GET /ai-actions/:id`.
 *   3. `listAvailable(...)` — return actions the current user can invoke
 *      (used by Command Palette + Automation panel quick-fire).
 *   4. `getStream(...)` — bridge to the streaming service for SSE.
 *
 * The Authorization guard runs *before* the service in the request
 * pipeline, so by the time we reach here:
 *   - `req.aiAction` is the resolved `AIActionDefinition`.
 *   - the user has credits, permissions, tier, and rate-budget.
 *   - the kill-switch flag is open.
 *
 * SOLID:
 *   - SRP — this service orchestrates the AI-Action pipeline only.
 *   - DIP — depends on the registry / executor / streaming abstractions.
 *   - OCP — adding a new action never changes this file.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import type { ExecuteAIActionDto } from '../dto/ai-action.dto';
import type { AIActionDefinition } from '../action-definition';
import { AIActionRegistry } from '../ai-action.registry';
import { AIActionExecutor } from './ai-action.executor';
import {
  AIActionStreamingService,
  ActionStreamEventType,
} from './ai-action-streaming.service';

@Injectable()
export class AIActionsService {
  private readonly logger = new Logger(AIActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AIActionRegistry,
    private readonly executor: AIActionExecutor,
    private readonly streaming: AIActionStreamingService,
    private readonly events: EventsGateway,
  ) {}

  /**
   * Execute an AI Action. Returns the queued invocation row immediately;
   * the executor runs in the background and updates the row + emits SSE.
   *
   * If an idempotency key is supplied and a matching COMPLETED invocation
   * exists, we return the cached result without re-running (api-contract §7.4).
   */
  async execute(tenantId: string, actorId: string, dto: ExecuteAIActionDto) {
    const action = this.registry.getById(dto.action);
    if (!action) {
      throw new NotFoundException({
        code: 'AI_ACTION_NOT_FOUND',
        message: dto.action,
      });
    }

    // 1. Idempotency replay (only on COMPLETED).
    if (dto.idempotencyKey) {
      const existing = await this.prisma.aIActionInvocation.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey: dto.idempotencyKey,
          },
        },
      });
      if (existing?.status === 'COMPLETED' || existing?.status === 'FAILED') {
        return existing;
      }
    }

    // 2. Persist PENDING row.
    const invocation = await this.prisma.aIActionInvocation.create({
      data: {
        tenantId,
        actionId: dto.action,
        entityType: dto.entityType,
        entityId: dto.entityId,
        invokedById: actorId,
        input: (dto.parameters ?? {}) as never,
        status: action.requiresStreaming ? 'RUNNING' : 'PENDING',
        idempotencyKey: dto.idempotencyKey,
        streamUrl: action.requiresStreaming
          ? `/api/v1/ai-actions/${undefined}/stream`
          : null,
      },
    });

    // 3. Create SSE session if streaming.
    if (action.requiresStreaming) {
      this.streaming.createSession({
        invocationId: invocation.id,
        tenantId,
        userId: actorId,
      });
      this.streaming.emit(invocation.id, {
        type: ActionStreamEventType.START,
        invocationId: invocation.id,
        timestamp: Date.now(),
        data: {
          actionId: action.id,
          entityType: dto.entityType,
          entityId: dto.entityId,
        },
      });
    }

    // 4. Execute (background — return immediately for the polling/SSE path).
    void this.runExecution(invocation.id, action, actorId, tenantId, dto);

    return invocation;
  }

  private async runExecution(
    invocationId: string,
    action: AIActionDefinition,
    actorId: string,
    tenantId: string,
    dto: ExecuteAIActionDto,
  ): Promise<void> {
    const startedAt = Date.now();
    try {
      const outcome = await this.executor.execute({
        actionId: action.id,
        context: {
          userId: actorId,
          userRole: 'USER',
          tenantId,
          entityType: dto.entityType,
          entityId: dto.entityId,
          parameters: { ...(dto.parameters ?? {}), __actionId: action.id },
        },
        invocationId,
      });

      const completedAt = new Date();
      await this.prisma.aIActionInvocation.update({
        where: { id: invocationId },
        data: {
          status: mapStatus(outcome.status),
          output: (outcome.result?.output ?? null) as never,
          tokensUsed: outcome.totalTokens,
          estimatedCostUsd: outcome.estimatedCostUsd,
          durationMs: outcome.durationMs,
          errorMessage: outcome.error ?? null,
          completedAt,
        },
      });

      // Emit `intelligence:refreshed` for downstream subscribers.
      if (outcome.status === 'completed' && dto.entityType && dto.entityId) {
        this.events.emitToTenant(tenantId, 'intelligence:refreshed', {
          entityType: dto.entityType,
          entityId: dto.entityId,
          invocationId,
          actionId: action.id,
        });
      }

      this.logger.log(
        `[${invocationId}] ${action.id} → ${outcome.status} (${outcome.durationMs}ms, ${outcome.totalTokens} tokens)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${invocationId}] executor crashed: ${msg}`,
        err instanceof Error ? err.stack : undefined,
      );
      await this.prisma.aIActionInvocation.update({
        where: { id: invocationId },
        data: {
          status: 'FAILED',
          errorMessage: msg,
          durationMs: Date.now() - startedAt,
          completedAt: new Date(),
        },
      });
    }
  }

  async getInvocation(tenantId: string, invocationId: string, actorId: string) {
    const invocation = await this.prisma.aIActionInvocation.findFirst({
      where: { id: invocationId, tenantId },
    });
    if (!invocation) return null;

    // Only the invoker or OWNER/ADMIN can read the invocation.
    const user = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { role: true },
    });
    const role = user?.role as string | undefined;
    if (
      invocation.invokedById !== actorId &&
      role !== 'OWNER' &&
      role !== 'ADMIN' &&
      role !== 'SUPER_ADMIN' &&
      role !== 'PLATFORM_ADMIN'
    ) {
      return null;
    }
    return invocation;
  }

  /**
   * List the actions the calling user can invoke against the given
   * entity type. Drives the Command Palette + Automation panel picker.
   *
   * Note: tier resolution is duplicated with the guard here because the
   * picker runs at HTTP 200; we don't want to gate list-endpoints with
   * the full action-authorization guard.
   */
  async listAvailable(
    tenantId: string,
    actorId: string,
    entityType: string | undefined,
  ): Promise<AIActionDefinition[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { role: true },
    });
    const role = (user?.role as string) ?? 'USER';

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tier: true },
    });
    const tierSlug = (tenant?.tier?.slug ?? 'community').toUpperCase();
    const knownTiers = ['COMMUNITY', 'STARTER', 'PRO', 'ENTERPRISE'];
    const tier = (knownTiers.includes(tierSlug) ? tierSlug : 'COMMUNITY') as
      'COMMUNITY' | 'STARTER' | 'PRO' | 'ENTERPRISE';

    const userPermissions = derivePermissions(role);
    return this.registry
      .getAvailable(entityType, userPermissions, tier)
      .map((a) => stripHandler(a));
  }

  /**
   * Used by the controller to bridge to the streaming service.
   */
  streamFor(invocationId: string) {
    return this.streaming.asObservable(invocationId);
  }

  streamSessionFor(invocationId: string) {
    return this.streaming.getSession(invocationId);
  }

  ensureStreamAccess(
    invocationId: string,
    actorId: string,
    role: string,
  ): void {
    const session = this.streaming.getSession(invocationId);
    if (!session) {
      throw new NotFoundException({
        code: 'AI_ACTION_STREAM_NOT_FOUND',
        message: invocationId,
      });
    }
    if (session.userId !== actorId && !isPrivileged(role)) {
      throw new ForbiddenException({
        code: 'AI_ACTION_STREAM_FORBIDDEN',
        message: 'You do not own this invocation stream',
      });
    }
  }
}

function mapStatus(
  s: 'completed' | 'failed' | 'cancelled',
): 'COMPLETED' | 'FAILED' | 'CANCELLED' {
  if (s === 'completed') return 'COMPLETED';
  if (s === 'cancelled') return 'CANCELLED';
  return 'FAILED';
}

function derivePermissions(
  role: string,
): AIActionDefinition['requiredPermissions'][number][] {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'PLATFORM_ADMIN':
    case 'OWNER':
      return [
        'ai.invoke',
        'ai.invoke.analysis',
        'ai.invoke.optimization',
        'ai.invoke.execution',
        'ai.invoke.reporting',
        'ai.invoke.delegate',
        'ai.invoke.workflow',
      ];
    case 'ADMIN':
      return [
        'ai.invoke',
        'ai.invoke.analysis',
        'ai.invoke.optimization',
        'ai.invoke.reporting',
      ];
    case 'USER':
      return ['ai.invoke', 'ai.invoke.analysis'];
    default:
      return ['ai.invoke'];
  }
}

function isPrivileged(role: string): boolean {
  return ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'PLATFORM_ADMIN'].includes(role);
}

/**
 * Strip the runtime `handler` from the definition before sending it to
 * the client. The handler is a server-side executable — it must not
 * cross the wire.
 */
function stripHandler(def: AIActionDefinition): AIActionDefinition {
  const { handler: _handler, ...rest } = def;
  return { ...(rest as AIActionDefinition), handler: undefined as never };
}
