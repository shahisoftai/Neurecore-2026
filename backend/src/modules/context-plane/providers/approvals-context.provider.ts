/**
 * ApprovalsContextProvider (Phase 3, ADR-002 §8).
 * Uses the governance ApprovalsService (the real, queryable approval-request
 * surface). Does NOT implement the future Approval Port.
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
import { ApprovalsService } from '../../governance/services/approvals.service';

@Injectable()
export class ApprovalsContextProvider
  implements IOrganizationalContextProvider, OnApplicationBootstrap
{
  readonly capability = 'approvals';
  private readonly logger = new Logger(ApprovalsContextProvider.name);

  constructor(
    @Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane,
    private readonly approvals: ApprovalsService,
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
      redactBelow: 50, // requester identity redacted below 50
    });
    if (authorization.access === 'DENIED') {
      return buildContext({
        capability: this.capability,
        provider: 'ApprovalsContextProvider',
        auth,
        scope,
        authorization,
        data: {},
      });
    }
    const redacted = authorization.access === 'REDACTED';

    try {
      const pending = await this.approvals.findAll(auth.tenantId, {
        status: 'PENDING' as never,
        limit: scope.recordLimit ?? 25,
      });
      const rows = (pending?.data ?? []) as Array<Record<string, any>>;
      return buildContext({
        capability: this.capability,
        provider: 'ApprovalsContextProvider',
        auth,
        scope,
        authorization,
        data: {
          pendingCount: pending?.total ?? rows.length,
          pending: rows.map((a) => ({
            id: a.id,
            title: a.title,
            resourceType: a.resourceType,
            resourceId: a.resourceId,
            status: a.status,
            requestedBy: redacted
              ? null
              : a.requestedBy
                ? {
                    id: a.requestedBy.id,
                    name: [a.requestedBy.firstName, a.requestedBy.lastName]
                      .filter(Boolean)
                      .join(' '),
                  }
                : (a.requestedById ?? null),
          })),
        },
        sourceEntities: rows.map((a) => ({
          entityType: 'ApprovalRequest',
          entityId: String(a.id),
        })),
      });
    } catch (err) {
      return unavailable({
        capability: this.capability,
        provider: 'ApprovalsContextProvider',
        auth,
        scope,
        reason: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}
