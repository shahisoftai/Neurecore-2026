/**
 * CustomersContextProvider (Phase 3, ADR-002 §8).
 * Capability-owned adapter depending only on CustomersService (+ProjectsService
 * for related projects). Tenant-scoped; FULL/REDACTED/DENIED.
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
import { CustomersService } from '../../customers/customers.service';
import { ProjectsService } from '../../projects/projects.service';

@Injectable()
export class CustomersContextProvider
  implements IOrganizationalContextProvider, OnApplicationBootstrap
{
  readonly capability = 'customers';
  private readonly logger = new Logger(CustomersContextProvider.name);

  constructor(
    @Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane,
    private readonly customers: CustomersService,
    private readonly projects: ProjectsService,
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
      redactBelow: 50, // contacts redacted below authority 50
    });
    if (authorization.access === 'DENIED') {
      return buildContext({
        capability: this.capability,
        provider: 'CustomersContextProvider',
        auth,
        scope,
        authorization,
        data: {},
      });
    }
    const redacted = authorization.access === 'REDACTED';

    try {
      if (scope.customerId) {
        const customer = await this.customers.findById(
          scope.customerId,
          auth.tenantId,
        );
        const contacts = redacted
          ? []
          : await this.customers
              .listContacts(scope.customerId, auth.tenantId)
              .catch(() => []);
        const related = await this.projects
          .findAll(auth.tenantId, { customerId: scope.customerId, limit: 10 })
          .catch(() => ({ data: [], total: 0 }));

        return buildContext({
          capability: this.capability,
          provider: 'CustomersContextProvider',
          auth,
          scope,
          authorization,
          data: {
            customer: {
              id: customer.id,
              name: customer.name,
              industry: customer.industry,
              status: customer.status,
            },
            contacts: redacted
              ? null
              : contacts.map((c) => ({
                  name: c.name,
                  email: c.email,
                  role: c.role,
                  isPrimary: c.isPrimary,
                })),
            relatedProjects: related.data.map((p) => ({
              id: p.id,
              name: p.name,
              status: p.status,
            })),
          },
          sourceEntities: [
            { entityType: 'Customer', entityId: customer.id },
          ],
        });
      }

      const { data, total } = await this.customers.findAll(auth.tenantId, {
        limit: scope.recordLimit ?? 25,
      });
      return buildContext({
        capability: this.capability,
        provider: 'CustomersContextProvider',
        auth,
        scope,
        authorization,
        data: {
          total,
          customers: data.map((c) => ({
            id: c.id,
            name: c.name,
            industry: c.industry,
            status: c.status,
          })),
        },
        sourceEntities: data.map((c) => ({
          entityType: 'Customer',
          entityId: c.id,
        })),
      });
    } catch (err) {
      return unavailable({
        capability: this.capability,
        provider: 'CustomersContextProvider',
        auth,
        scope,
        reason:
          err instanceof Error && /not found/i.test(err.message)
            ? 'customer not found for tenant'
            : `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}
