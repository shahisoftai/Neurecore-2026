import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import type { IHermesContext } from '../interfaces/hermes-context.interface';
import type { HermesSessionContext } from '../common/hermes.types';
import { HermesMemoryService } from './hermes-memory.service';
import { HermesRegistryService } from './hermes-registry.service';
import { CONTEXT_PLANE } from '../../context-plane/contracts/context-plane.interface';
import type { IOrganizationalContextPlane } from '../../context-plane/contracts/context-plane.interface';

/**
 * HermesContextService (Phase 3, ADR-002).
 *
 * Hermes retains ONLY actor-local context (its execution profile, runtime
 * memory, allowed tools). ORGANIZATIONAL state is obtained through the
 * Organizational Context Plane — Hermes no longer assembles org context from
 * isolated local tables and has NO direct Prisma access to
 * Projects/Customers/Finance/Tasks/Approvals/Comms.
 *
 * The Context Plane is injected @Optional so isolated Hermes unit tests still
 * construct; when present, organizational context is populated per request.
 */
@Injectable()
export class HermesContextService implements IHermesContext {
  private readonly logger = new Logger(HermesContextService.name);

  constructor(
    private readonly registry: HermesRegistryService,
    private readonly memory: HermesMemoryService,
    @Optional()
    @Inject(CONTEXT_PLANE)
    private readonly contextPlane?: IOrganizationalContextPlane,
  ) {}

  async build(params: {
    hermesAgentId: string;
    agentId: string;
    tenantId: string;
    userId?: string;
    workspaceId?: string;
    threadId: string;
    projectId?: string;
    customerId?: string;
  }): Promise<HermesSessionContext> {
    const profile = await this.registry.findById(params.hermesAgentId);

    // Actor-local: Hermes runtime memory (kept separate from org memory).
    const memoryContext = await this.memory.getContext(
      params.hermesAgentId,
      params.tenantId,
    );

    // Actor-local: allowed tools from the execution profile type.
    const allowedTools = profile
      ? this.registry.getAllowedTools(profile.type)
      : [];

    // Organizational state via the Context Plane (authorized + provenance-aware).
    let organization: Record<string, unknown> | undefined;
    if (this.contextPlane) {
      try {
        const assembled = await this.contextPlane.assemble({
          tenantId: params.tenantId,
          actorId: params.agentId ?? params.hermesAgentId,
          actorType: 'AI_AGENT',
          scope: {
            projectId: params.projectId,
            customerId: params.customerId,
          },
        });
        organization = {
          identity: {
            role: assembled.identity.role,
            authorityLevel: assembled.identity.authorityLevel,
            departmentId: assembled.identity.departmentId,
          },
          capabilities: assembled.capabilities,
        };
      } catch (e) {
        // Context Plane failure must not break Hermes session creation.
        this.logger.warn(
          `Context Plane assemble failed: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    return {
      threadId: params.threadId,
      hermesAgentId: params.hermesAgentId,
      userId: params.userId,
      tenantId: params.tenantId,
      workspaceId: params.workspaceId,
      memoryContext: memoryContext || undefined,
      allowedTools,
      organization,
    };
  }
}
