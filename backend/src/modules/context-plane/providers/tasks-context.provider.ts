/**
 * TasksContextProvider (Phase 3, ADR-002 §8).
 * Depends on the orchestration TasksService. Tasks have no project filter and
 * no deadline field in source (baseline finding); overdue is derived from
 * scheduledAt where present, otherwise reported as not-derivable.
 */

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Inject,
} from '@nestjs/common';
import {
  CONTEXT_PLANE,
  type CapabilityContext,
  type ContextAuth,
  type ContextScope,
  type IOrganizationalContextPlane,
  type IOrganizationalContextProvider,
} from '../contracts/context-plane.interface';
import { decide, buildContext, unavailable } from './provider-authorization';
import { TasksService } from '../../orchestration/services/tasks.service';

@Injectable()
export class TasksContextProvider
  implements IOrganizationalContextProvider, OnApplicationBootstrap
{
  readonly capability = 'tasks';
  private readonly logger = new Logger(TasksContextProvider.name);

  constructor(
    @Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane,
    private readonly tasks: TasksService,
  ) {}

  onApplicationBootstrap(): void {
    this.plane.registerProvider(this);
  }

  async getContext(
    auth: ContextAuth,
    scope: ContextScope,
  ): Promise<CapabilityContext> {
    const authorization = decide(auth, this.capability, scope, {
      denyBelow: 10,
      redactBelow: 30,
    });
    if (authorization.access === 'DENIED') {
      return buildContext({
        capability: this.capability,
        provider: 'TasksContextProvider',
        auth,
        scope,
        authorization,
        data: {},
      });
    }

    try {
      const result = await this.tasks.findAll(
        { limit: scope.recordLimit ?? 50 },
        auth.tenantId,
      );
      const rows = (result?.data ?? []) as Array<Record<string, unknown>>;
      const now = Date.now();
      const tasks = rows.map((t) => {
        const scheduledAt = t.scheduledAt as Date | null | undefined;
        const status = String(t.status ?? '');
        const overdue =
          scheduledAt != null &&
          status !== 'COMPLETED' &&
          new Date(scheduledAt).getTime() < now;
        return {
          id: t.id,
          title: t.title,
          status,
          agentId: t.agentId ?? null,
          projectId: t.projectId ?? null,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          overdue,
        };
      });
      return buildContext({
        capability: this.capability,
        provider: 'TasksContextProvider',
        auth,
        scope,
        authorization,
        data: {
          total: result?.total ?? tasks.length,
          tasks,
          overdueCount: tasks.filter((t) => t.overdue).length,
          note: 'Task model has no explicit deadline field; overdue derived from scheduledAt.',
        },
        sourceEntities: tasks.map((t) => ({
          entityType: 'Task',
          entityId: String(t.id),
        })),
      });
    } catch (err) {
      return unavailable({
        capability: this.capability,
        provider: 'TasksContextProvider',
        auth,
        scope,
        reason: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}
