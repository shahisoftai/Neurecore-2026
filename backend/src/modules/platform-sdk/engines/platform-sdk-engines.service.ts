/**
 * Platform SDK — engines (Phase 10). PluginManager (lifecycle: Draft→Installed→
 * Validated→Enabled→Disabled→Deprecated→Removed), PermissionManager (grant/check/
 * list), PlatformSDK (orchestrator + version check).
 * Extensions never access Prisma or capability internals — this is the GOVERNED
 * extension registry only. Execution through P4 (Work Runtime) exclusively.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  ExtensionKind, ExtensionPermission, IPluginManager, IPermissionManager,
  IPlatformSDK, PluginView, ValidationResult, VersionCheck,
} from '../contracts/platform-sdk.interface';

const CURRENT_SDK_VERSION = '10.0.0';
const ALLOWED_CAPABILITIES = new Set([
  'context-plane:read', 'work-runtime:create_run', 'events:subscribe',
  'cognition:cognize', 'autonomy:create_mission', 'eos:twin:read',
  'intelligence:search', 'platform:health:read',
]);

@Injectable()
export class PluginManager implements IPluginManager {
  private readonly logger = new Logger(PluginManager.name);
  constructor(private readonly prisma: PrismaService) {}

  async install(tenantId: string, name: string, kind: ExtensionKind, version = '1.0.0', permissions?: string[]): Promise<PluginView> {
    const row = await this.prisma.plugin.create({
      data: { tenantId, name, kind, version, sdkVersion: CURRENT_SDK_VERSION, status: 'INSTALLED', permissionsJson: (permissions ?? []) as Prisma.InputJsonValue } as Prisma.PluginUncheckedCreateInput,
    });
    return this.view(row);
  }
  async validate(pluginId: string, tenantId: string): Promise<ValidationResult> {
    const row = await this.prisma.plugin.findFirst({ where: { id: pluginId, tenantId } });
    if (!row) return { ok: false, issues: ['plugin not found'] };
    const issues: string[] = [];
    const perms = (row.permissionsJson ?? []) as string[];
    for (const p of perms) { if (!ALLOWED_CAPABILITIES.has(p)) issues.push(`disallowed capability: ${p}`); }
    if (issues.length === 0) {
      await this.prisma.plugin.update({ where: { id: pluginId }, data: { status: 'VALIDATED', validated: true } });
    }
    return { ok: issues.length === 0, issues };
  }
  async enable(pluginId: string, tenantId: string): Promise<PluginView> {
    const row = await this.prisma.plugin.findFirst({ where: { id: pluginId, tenantId } });
    if (!row || row.status !== 'VALIDATED') throw new Error('plugin must be VALIDATED before enabling');
    const updated = await this.prisma.plugin.update({ where: { id: pluginId }, data: { status: 'ENABLED', enabledAt: new Date() } });
    return this.view(updated);
  }
  async disable(pluginId: string, tenantId: string): Promise<PluginView> {
    const updated = await this.prisma.plugin.update({ where: { id: pluginId }, data: { status: 'DISABLED' } });
    return this.view(updated);
  }
  async deprecate(pluginId: string, tenantId: string): Promise<PluginView> {
    const updated = await this.prisma.plugin.update({ where: { id: pluginId }, data: { status: 'DEPRECATED' } });
    return this.view(updated);
  }
  async remove(pluginId: string, tenantId: string): Promise<PluginView> {
    const updated = await this.prisma.plugin.update({ where: { id: pluginId }, data: { status: 'REMOVED' } });
    return this.view(updated);
  }
  async get(pluginId: string, tenantId: string): Promise<PluginView | null> {
    const row = await this.prisma.plugin.findFirst({ where: { id: pluginId, tenantId } });
    return row ? this.view(row) : null;
  }
  async list(tenantId: string): Promise<PluginView[]> {
    return (await this.prisma.plugin.findMany({ where: { tenantId } })).map((r) => this.view(r));
  }
  private view(r: any): PluginView {
    return { id: r.id, tenantId: r.tenantId, name: r.name, kind: r.kind, version: r.version, sdkVersion: r.sdkVersion, status: r.status, validated: r.validated, createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt ?? '') };
  }
}

@Injectable()
export class PermissionManager implements IPermissionManager {
  constructor(private readonly prisma: PrismaService) {}
  async grant(tenantId: string, pluginId: string, capabilities: string[]): Promise<void> {
    for (const cap of capabilities) {
      if (!ALLOWED_CAPABILITIES.has(cap)) continue;
      await this.prisma.extensionPermission.upsert({
        where: { tenantId_pluginId_capability: { tenantId, pluginId, capability: cap } },
        create: { tenantId, pluginId, capability: cap, granted: true, reason: 'granted at install' },
        update: { granted: true },
      });
    }
  }
  async check(tenantId: string, pluginId: string, capability: string): Promise<boolean> {
    const row = await this.prisma.extensionPermission.findUnique({ where: { tenantId_pluginId_capability: { tenantId, pluginId, capability } } });
    return row?.granted === true;
  }
  async list(tenantId: string, pluginId: string): Promise<ExtensionPermission[]> {
    const rows = await this.prisma.extensionPermission.findMany({ where: { tenantId, pluginId } });
    return rows.map((r) => ({ capability: r.capability, granted: r.granted, reason: r.reason }));
  }
}

@Injectable()
export class PlatformSDK implements IPlatformSDK {
  constructor(
    private readonly pm: PluginManager,
    private readonly pem: PermissionManager,
  ) {}
  plugins(): IPluginManager { return this.pm; }
  permissions(): IPermissionManager { return this.pem; }
  checkVersion(pluginSdkVersion: string): VersionCheck {
    const issues: string[] = [];
    const [major] = pluginSdkVersion.split('.').map(Number);
    if (major !== 10) issues.push(`SDK major version mismatch: plugin=${pluginSdkVersion}, platform=${CURRENT_SDK_VERSION}`);
    return { compatible: issues.length === 0, requiredSdkVersion: CURRENT_SDK_VERSION, pluginSdkVersion, issues };
  }
  listExtensions = (t: string) => this.pm.list(t);
  async installAndValidate(tenantId: string, name: string, kind: ExtensionKind, permissions?: string[]): Promise<PluginView> {
    const plugin = await this.pm.install(tenantId, name, kind, '1.0.0', permissions);
    if (permissions) await this.pem.grant(tenantId, plugin.id, permissions);
    await this.pm.validate(plugin.id, tenantId);
    return (this.pm.get(plugin.id, tenantId) as Promise<PluginView>);
  }
}
