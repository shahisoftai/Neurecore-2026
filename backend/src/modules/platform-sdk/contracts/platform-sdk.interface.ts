/**
 * Platform SDK — contracts (Phase 10). Plugin registry, lifecycle, permissions,
 * version compatibility, extension validation. Extensions are GOVERNED — isolated,
 * permission-bounded, never accessing Prisma or capability internals. Execution
 * through P4 (Work Runtime) only. Marketplace/workflow-builder/connector SDK are
 * frontend/infrastructure concerns — backend provides registry + governance.
 */

export type PluginStatus = 'DRAFT' | 'INSTALLED' | 'VALIDATED' | 'ENABLED' | 'DISABLED' | 'DEPRECATED' | 'REMOVED';
export type ExtensionKind = 'PLUGIN' | 'WORKFLOW' | 'AGENT' | 'CONNECTOR' | 'DASHBOARD' | 'ANALYTICS' | 'VISUALIZATION' | 'CUSTOM';

export interface PluginView { id: string; tenantId: string; name: string; kind: ExtensionKind; version: string; sdkVersion: string; status: PluginStatus; validated: boolean; createdAt: string }
export interface ExtensionPermission { capability: string; granted: boolean; reason: string | null }
export interface ValidationResult { ok: boolean; issues: string[] }
export interface VersionCheck { compatible: boolean; requiredSdkVersion: string; pluginSdkVersion: string; issues: string[] }

export const PLUGIN_MANAGER = Symbol('PLUGIN_MANAGER');
export interface IPluginManager {
  install(tenantId: string, name: string, kind: ExtensionKind, version?: string, permissions?: string[]): Promise<PluginView>;
  validate(pluginId: string, tenantId: string): Promise<ValidationResult>;
  enable(pluginId: string, tenantId: string): Promise<PluginView>;
  disable(pluginId: string, tenantId: string): Promise<PluginView>;
  deprecate(pluginId: string, tenantId: string): Promise<PluginView>;
  remove(pluginId: string, tenantId: string): Promise<PluginView>;
  get(pluginId: string, tenantId: string): Promise<PluginView | null>;
  list(tenantId: string): Promise<PluginView[]>;
}

export const PERMISSION_MANAGER = Symbol('PERMISSION_MANAGER');
export interface IPermissionManager {
  grant(tenantId: string, pluginId: string, capabilities: string[]): Promise<void>;
  check(tenantId: string, pluginId: string, capability: string): Promise<boolean>;
  list(tenantId: string, pluginId: string): Promise<ExtensionPermission[]>;
}

export const PLATFORM_SDK = Symbol('PLATFORM_SDK');
export interface IPlatformSDK {
  plugins(): IPluginManager;
  permissions(): IPermissionManager;
  checkVersion(pluginSdkVersion: string): VersionCheck;
  listExtensions(tenantId: string): Promise<PluginView[]>;
  installAndValidate(tenantId: string, name: string, kind: ExtensionKind, permissions?: string[]): Promise<PluginView>;
}
