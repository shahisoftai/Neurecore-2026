/**
 * Settings Services Index
 *
 * Barrel export for all settings services
 * Following modular architecture
 */

// Interfaces
export type {
  ISettingsApiClient,
  IAISettingsService,
  ITierSettingsService,
  IEmailSettingsService,
  IAuditLogsService,
  IPlatformSettingsService,
  ISettingsServiceFactory,
} from "./interfaces";

// Implementations
export { AISettingsService } from "./aiSettings.service";
export { TierSettingsService } from "./tierSettings.service";
export { EmailSettingsService } from "./emailSettings.service";
export { AuditLogsService } from "./auditSettings.service";
export { PlatformSettingsService } from "./platformSettings.service";
export { SettingsApiClient } from "./apiClient";
export { SettingsServiceFactory } from "./factory";

// Factory & Convenience
export {
  getSettingsServiceFactory,
  setSettingsServiceFactory,
  getAISettingsService,
  getTierSettingsService,
  getEmailSettingsService,
  getAuditLogsService,
  getPlatformSettingsService,
} from "./factory";
