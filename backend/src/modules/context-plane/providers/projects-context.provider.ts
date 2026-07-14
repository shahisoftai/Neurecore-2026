/**
 * ProjectsContextProvider (Phase 3, ADR-002 §8).
 *
 * Capability-owned adapter for Projects context. Depends ONLY on public
 * capability services (ProjectsService, ProjectStagesService,
 * ProjectMembersService, CompletenessService) — never on foreign Prisma tables.
 * Enforces tenant isolation and returns a FULL/REDACTED/DENIED decision.
 *
 * Registers itself with the Context Plane on bootstrap.
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
import { ProjectsService } from '../../projects/projects.service';
import { ProjectStagesService } from '../../project-stages/project-stages.service';
import { ProjectMembersService } from '../../project-members/project-members.service';
import { CompletenessService } from '../../information-engine/completeness/completeness.service';

@Injectable()
export class ProjectsContextProvider
  implements IOrganizationalContextProvider, OnApplicationBootstrap
{
  readonly capability = 'projects';
  private readonly logger = new Logger(ProjectsContextProvider.name);

  constructor(
    @Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane,
    private readonly projects: ProjectsService,
    private readonly stages: ProjectStagesService,
    private readonly members: ProjectMembersService,
    private readonly completeness: CompletenessService,
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
      redactBelow: 50, // budget/members redacted below authority 50
    });
    if (authorization.access === 'DENIED') {
      return buildContext({
        capability: this.capability,
        provider: 'ProjectsContextProvider',
        auth,
        scope,
        authorization,
        data: {},
      });
    }

    const redacted = authorization.access === 'REDACTED';

    try {
      // Single project (with stages/members/completeness) OR project list.
      if (scope.projectId) {
        const project = await this.projects.findById(
          scope.projectId,
          auth.tenantId,
        ); // throws NotFound if not this tenant → caught below

        const [stageList, memberList, snapshot] = await Promise.all([
          this.stages.list(scope.projectId, auth.tenantId).catch(() => []),
          this.members.list(scope.projectId, auth.tenantId).catch(() => []),
          this.completeness.get('PROJECT', scope.projectId).catch(() => null),
        ]);

        const data: Record<string, unknown> = {
          project: {
            id: project.id,
            name: project.name,
            status: project.status,
            projectTypeId: project.projectTypeId,
            customerId: redacted ? null : project.customerId,
            priority: project.priority,
            targetDate: project.targetDate ?? null,
            startDate: project.startDate ?? null,
            budget: redacted
              ? null
              : {
                  type: project.budgetType,
                  amount: project.budgetAmount,
                  currency: project.budgetCurrency,
                },
          },
          stages: stageList.map((s) => ({
            name: s.name,
            status: s.status,
            order: s.order,
          })),
          members: redacted
            ? null
            : memberList.map((m) => ({
                actorId: m.actorId,
                actorType: m.actorType,
                role: m.role,
              })),
          completeness: snapshot
            ? {
                score: snapshot.score,
                totalRequired: snapshot.totalRequired,
                totalResolved: snapshot.totalResolved,
                missingCount: snapshot.missing?.length ?? 0,
              }
            : { available: false },
        };

        return buildContext({
          capability: this.capability,
          provider: 'ProjectsContextProvider',
          auth,
          scope,
          authorization,
          data,
          sourceEntities: [{ entityType: 'Project', entityId: project.id }],
          lastModifiedAt: project.updatedAt
            ? new Date(project.updatedAt).toISOString()
            : null,
        });
      }

      // Project list for the tenant.
      const { data: projectList, total } = await this.projects.findAll(
        auth.tenantId,
        { limit: scope.recordLimit ?? 25 },
      );
      const data: Record<string, unknown> = {
        total,
        projects: projectList.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          customerId: redacted ? null : p.customerId,
          budgetAmount: redacted ? null : p.budgetAmount,
        })),
      };
      return buildContext({
        capability: this.capability,
        provider: 'ProjectsContextProvider',
        auth,
        scope,
        authorization,
        data,
        sourceEntities: projectList.map((p) => ({
          entityType: 'Project',
          entityId: p.id,
        })),
      });
    } catch (err) {
      // NotFound (wrong tenant / missing) → treat as unavailable, never leak.
      return unavailable({
        capability: this.capability,
        provider: 'ProjectsContextProvider',
        auth,
        scope,
        reason:
          err instanceof Error && /not found/i.test(err.message)
            ? 'project not found for tenant'
            : `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}
