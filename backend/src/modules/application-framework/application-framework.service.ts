/**
 * Application Framework — contracts + engine (Phase 12).
 * Applications, domain packages, industry solutions, workspaces inherit the
 * entire 11-layer platform governance — they never own infrastructure.
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export type AppStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'RETIRED';
export type Edition = 'COMMUNITY' | 'PROFESSIONAL' | 'ENTERPRISE' | 'GOVERNMENT' | 'PRIVATE_CLOUD';

export interface AppView { id: string; name: string; domain: string; version: string; status: AppStatus; edition: Edition }
export interface DomainPackageView { id: string; name: string; domain: string; modules: string[] }
export interface IndustrySolutionView { id: string; name: string; industry: string; packages: string[] }
export interface WorkspaceView { id: string; name: string; role: string; dashboards: string[] }

export const APP_FRAMEWORK = Symbol('APP_FRAMEWORK');
export interface IApplicationFramework {
  // Applications
  registerApp(tenantId: string, name: string, domain: string, version?: string): Promise<AppView>;
  listApps(tenantId: string, domain?: string): Promise<AppView[]>;
  activate(tenantId: string, appId: string): Promise<AppView>;
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
  constructor(private readonly prisma: PrismaService) {}
  async registerApp(tenantId: string, name: string, domain: string, version = '1.0.0') {
    const a = await this.prisma.application.create({ data: { tenantId, name, domain, version } as Prisma.ApplicationUncheckedCreateInput });
    return { id: a.id, name: a.name, domain: a.domain, version: a.version, status: a.status as AppStatus, edition: a.edition as Edition };
  }
  async listApps(tenantId: string, domain?: string) {
    return (await this.prisma.application.findMany({ where: { tenantId, ...(domain ? { domain } : {}) } })).map((a) => ({ id: a.id, name: a.name, domain: a.domain, version: a.version, status: a.status as AppStatus, edition: a.edition as Edition }));
  }
  async activate(tenantId: string, appId: string) {
    const a = await this.prisma.application.update({ where: { id: appId }, data: { status: 'ACTIVE' as any } });
    return { id: a.id, name: a.name, domain: a.domain, version: a.version, status: a.status as AppStatus, edition: a.edition as Edition };
  }
  async registerDomain(tenantId: string, name: string, domain: string, modules: string[] = []) {
    const d = await this.prisma.domainPackage.create({ data: { tenantId, name, domain, modules } });
    return { id: d.id, name: d.name, domain: d.domain, modules: d.modules };
  }
  async listDomains(tenantId: string) {
    return (await this.prisma.domainPackage.findMany({ where: { tenantId } })).map((d) => ({ id: d.id, name: d.name, domain: d.domain, modules: d.modules }));
  }
  async registerSolution(tenantId: string, name: string, industry: string, packages: string[] = []) {
    const s = await this.prisma.industrySolution.create({ data: { tenantId, name, industry, packages } });
    return { id: s.id, name: s.name, industry: s.industry, packages: s.packages };
  }
  async listSolutions(tenantId: string) {
    return (await this.prisma.industrySolution.findMany({ where: { tenantId } })).map((s) => ({ id: s.id, name: s.name, industry: s.industry, packages: s.packages }));
  }
  async createWorkspace(tenantId: string, name: string, role: string, dashboards: string[] = []) {
    const w = await this.prisma.workspace.create({ data: { tenantId, name, role, dashboards } as Prisma.WorkspaceUncheckedCreateInput });
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
