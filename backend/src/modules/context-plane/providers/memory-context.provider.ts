/**
 * MemoryContextProvider (Phase 3, ADR-002 §8).
 * Exposes ONLY organizational (project) memory via ProjectMemoryService. The
 * three memory stores stay separate — this provider never reads agent memory
 * (MemoryService) or Hermes runtime memory (HermesMemoryService).
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
import { ProjectMemoryService } from '../../project-memory/project-memory.service';

@Injectable()
export class MemoryContextProvider
  implements IOrganizationalContextProvider, OnApplicationBootstrap
{
  readonly capability = 'memory';
  private readonly logger = new Logger(MemoryContextProvider.name);

  constructor(
    @Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane,
    private readonly projectMemory: ProjectMemoryService,
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
        provider: 'MemoryContextProvider',
        auth,
        scope,
        authorization,
        data: {},
      });
    }

    if (!scope.projectId) {
      return unavailable({
        capability: this.capability,
        provider: 'MemoryContextProvider',
        auth,
        scope,
        reason: 'organizational memory is project-scoped; provide projectId',
      });
    }

    try {
      const { data, total } = await this.projectMemory.findAll(auth.tenantId, {
        projectId: scope.projectId,
        limit: scope.recordLimit ?? 20,
      } as never);
      return buildContext({
        capability: this.capability,
        provider: 'MemoryContextProvider',
        auth,
        scope,
        authorization,
        data: {
          scope: 'ORGANIZATIONAL',
          note: 'organizational/project memory only; agent + Hermes runtime memory are separate stores',
          total,
          entries: data.map((m) => ({
            category: m.category,
            content: m.content,
            authorType: m.authorType,
            isPinned: m.isPinned,
            createdAt: m.createdAt,
          })),
        },
        sourceEntities: data.map((m) => ({
          entityType: 'ProjectMemory',
          entityId: m.id,
        })),
      });
    } catch (err) {
      return unavailable({
        capability: this.capability,
        provider: 'MemoryContextProvider',
        auth,
        scope,
        reason: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}
