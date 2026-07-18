/**
 * Application Framework — contracts + engine (Phase 12).
 * Applications, domain packages, industry solutions, workspaces inherit the
 * entire 11-layer platform governance — they never own infrastructure.
 */

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { EVENT_TRANSPORT } from '../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../enterprise-events/contracts/enterprise-event-transport.interface';

export type AppStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'RETIRED';
export type Edition = 'COMMUNITY' | 'PROFESSIONAL' | 'ENTERPRISE' | 'GOVERNMENT' | 'PRIVATE_CLOUD';

export interface AppView { id: string; name: string; domain: string; version: string; status: AppStatus; edition: Edition }
export interface DomainPackageView { id: string; name: string; domain: string; modules: string[] }
export interface IndustrySolutionView { id: string; name: string; industry: string; packages: string[] }
export interface WorkspaceView { id: string; name: string; role: string; dashboards: string[] }

export const APP_FRAMEWORK = Symbol('APP_FRAMEWORK');
export interface IApplicationFramework {
  // Applications
  registerApp(tenantId: string, name: string, domain: string, version?: string, edition?: Edition): Promise<AppView>;
  listApps(tenantId: string, domain?: string): Promise<AppView[]>;
  activate(tenantId: string, appId: string): Promise<AppView>;
  deprecate(tenantId: string, appId: string): Promise<AppView>;
  retire(tenantId: string, appId: string): Promise<AppView>;
  // Domain packages
  registerDomain(tenantId: string, name: string, domain: string, modules?: string[]): Promise<DomainPackageView>;
  listDomains(tenantId: string): Promise<DomainPackageView[]>;
  // Industry solutions
  registerSolution(tenantId: string, name: string, industry: string, packages?: string[]): Promise<IndustrySolutionView>;
  listSolutions(tenantId: string): Promise<IndustrySolutionView[]>;
  // Workspaces
  createWorkspace(tenantId: string, name: string, role: string, dashboards?: string[]): Promise<WorkspaceView>;
  listWorkspaces(tenantId: string): Promise<WorkspaceView[]>;
  // Catalog (all installed)
  catalog(tenantId: string): Promise<{ apps: AppView[]; domains: DomainPackageView[]; solutions: IndustrySolutionView[]; workspaces: WorkspaceView[] }>;
}

@Injectable()
export class ApplicationFramework implements IApplicationFramework {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_TRANSPORT) private readonly events: IEnterpriseEventTransport,
  ) {}

  private async emit(tenantId: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.events.publish({
        eventType,
        tenantId,
        actorType: 'SYSTEM',
        sourceModule: 'ApplicationFramework',
        idempotencyKey: `${eventType}.${tenantId}.${(payload['appId'] as string) ?? Date.now()}`,
        payload,
      });
    } catch { /* non-fatal */ }
  }

  private async updateStatus(tenantId: string, appId: string, status: AppStatus): Promise<AppView> {
    const owned = await this.prisma.application.findFirst({ where: { id: appId, tenantId } });
    if (!owned) throw new Error('application not found for tenant');
    const u = await this.prisma.application.updateMany({
      where: { id: appId, tenantId },
      data: { status: status as any },
    });
    if (u.count === 0) throw new Error('application not found for tenant');
    const after = await this.prisma.application.findFirst({ where: { id: appId, tenantId } });
    return { id: after!.id, name: after!.name, domain: after!.domain, version: after!.version, status: after!.status as AppStatus, edition: after!.edition as Edition };
  }

  async registerApp(tenantId: string, name: string, domain: string, version = '1.0.0', edition: Edition = 'ENTERPRISE') {
    const a = await this.prisma.application.create({ data: { tenantId, name, domain, version, edition, status: 'DRAFT' as any, updatedAt: new Date() } as Prisma.ApplicationUncheckedCreateInput });
    await this.emit(tenantId, 'application.installed', { appId: a.id, name: a.name, domain: a.domain });
    await this.emit(tenantId, 'application.catalog.updated', { appId: a.id });
    return { id: a.id, name: a.name, domain: a.domain, version: a.version, status: a.status as AppStatus, edition: a.edition as Edition };
  }

  async listApps(tenantId: string, domain?: string) {
    return (await this.prisma.application.findMany({ where: { tenantId, ...(domain ? { domain } : {}) } })).map((a) => ({ id: a.id, name: a.name, domain: a.domain, version: a.version, status: a.status as AppStatus, edition: a.edition as Edition }));
  }

  async activate(tenantId: string, appId: string) {
    const view = await this.updateStatus(tenantId, appId, 'ACTIVE');
    await this.emit(tenantId, 'application.activated', { appId });
    return view;
  }

  async deprecate(tenantId: string, appId: string) {
    const view = await this.updateStatus(tenantId, appId, 'DEPRECATED');
    await this.emit(tenantId, 'application.catalog.updated', { appId });
    return view;
  }

  async retire(tenantId: string, appId: string) {
    const view = await this.updateStatus(tenantId, appId, 'RETIRED');
    await this.emit(tenantId, 'application.catalog.updated', { appId });
    return view;
  }

  async registerDomain(tenantId: string, name: string, domain: string, modules: string[] = []) {
    const d = await this.prisma.domainPackage.create({ data: { tenantId, name, domain, modules } });
    await this.emit(tenantId, 'application.catalog.updated', { domainPackageId: d.id });
    return { id: d.id, name: d.name, domain: d.domain, modules: d.modules };
  }

  async listDomains(tenantId: string) {
    return (await this.prisma.domainPackage.findMany({ where: { tenantId } })).map((d) => ({ id: d.id, name: d.name, domain: d.domain, modules: d.modules }));
  }

  async registerSolution(tenantId: string, name: string, industry: string, packages: string[] = []) {
    const s = await this.prisma.industrySolution.create({ data: { tenantId, name, industry, packages } });
    await this.emit(tenantId, 'application.catalog.updated', { solutionId: s.id });
    return { id: s.id, name: s.name, industry: s.industry, packages: s.packages };
  }

  async listSolutions(tenantId: string) {
    return (await this.prisma.industrySolution.findMany({ where: { tenantId } })).map((s) => ({ id: s.id, name: s.name, industry: s.industry, packages: s.packages }));
  }

  async createWorkspace(tenantId: string, name: string, role: string, dashboards: string[] = []) {
    const w = await this.prisma.workspace.create({ data: { tenantId, name, role, dashboards, updatedAt: new Date() } as Prisma.WorkspaceUncheckedCreateInput });
    await this.emit(tenantId, 'application.catalog.updated', { workspaceId: w.id });
    return { id: w.id, name: w.name, role: w.role, dashboards: w.dashboards };
  }

  async listWorkspaces(tenantId: string) {
    return (await this.prisma.workspace.findMany({ where: { tenantId } })).map((w) => ({ id: w.id, name: w.name, role: w.role, dashboards: w.dashboards }));
  }

  async catalog(tenantId: string) {
    const [apps, domains, solutions, workspaces] = await Promise.all([
      this.listApps(tenantId), this.listDomains(tenantId), this.listSolutions(tenantId), this.listWorkspaces(tenantId),
    ]);
    return { apps, domains, solutions, workspaces };
  }
}
