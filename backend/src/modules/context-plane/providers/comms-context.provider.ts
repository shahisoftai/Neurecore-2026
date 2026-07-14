/**
 * CommsContextProvider (Phase 3, ADR-002 §8).
 * Uses the Threads read surface (ThreadService.findForEntity) — per-entity
 * (project) threads. Tenant-wide thread listing is a stub in source (baseline),
 * so without a projectId this reports UNAVAILABLE rather than fabricating.
 * Does NOT implement AI-to-AI work transport.
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
import { ThreadService } from '../../hermes/services/thread.service';

@Injectable()
export class CommsContextProvider
  implements IOrganizationalContextProvider, OnApplicationBootstrap
{
  readonly capability = 'comms';
  private readonly logger = new Logger(CommsContextProvider.name);

  constructor(
    @Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane,
    private readonly threads: ThreadService,
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
      redactBelow: 40,
    });
    if (authorization.access === 'DENIED') {
      return buildContext({
        capability: this.capability,
        provider: 'CommsContextProvider',
        auth,
        scope,
        authorization,
        data: {},
      });
    }

    // Only per-entity (project) thread reads are implemented in source.
    if (!scope.projectId) {
      return unavailable({
        capability: this.capability,
        provider: 'CommsContextProvider',
        auth,
        scope,
        reason:
          'tenant-wide thread listing not implemented; provide projectId scope',
      });
    }

    try {
      const threads = await this.threads.findForEntity(
        'PROJECT',
        scope.projectId,
        auth.tenantId,
      );
      const rows = (threads ?? []) as Array<Record<string, any>>;
      return buildContext({
        capability: this.capability,
        provider: 'CommsContextProvider',
        auth,
        scope,
        authorization,
        data: {
          threadCount: rows.length,
          threads: rows.slice(0, scope.recordLimit ?? 20).map((t) => ({
            id: t.id,
            title: t.title ?? t.subject ?? null,
            createdAt: t.createdAt,
            status: t.status ?? null,
          })),
        },
        sourceEntities: rows.map((t) => ({
          entityType: 'CommunicationThread',
          entityId: String(t.id),
        })),
      });
    } catch (err) {
      return unavailable({
        capability: this.capability,
        provider: 'CommsContextProvider',
        auth,
        scope,
        reason: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}
