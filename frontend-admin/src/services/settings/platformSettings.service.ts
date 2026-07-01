/**
 * Platform Settings Service Implementation
 *
 * Single Responsibility: Only handles platform-wide settings
 * Depends on abstraction (ISettingsApiClient) - DIP compliant
 */

import type { PlatformSettings } from "@/types/settings.types";
import type {
  IPlatformSettingsService,
  ISettingsApiClient,
} from "./interfaces";

export class PlatformSettingsService implements IPlatformSettingsService {
  constructor(private apiClient: ISettingsApiClient) {}

  async getSettings(): Promise<PlatformSettings> {
    return this.apiClient.get<PlatformSettings>("/platform");
  }

  async updateSettings(
    settings: Partial<PlatformSettings>,
  ): Promise<PlatformSettings> {
    return this.apiClient.patch<PlatformSettings>("/platform", settings);
  }

  // General Settings
  async getGeneralSettings(): Promise<PlatformSettings["general"]> {
    const settings = await this.getSettings();
    return settings.general;
  }

  async updateGeneralSettings(
    settings: Partial<PlatformSettings["general"]>,
  ): Promise<PlatformSettings["general"]> {
    return this.apiClient.patch<PlatformSettings["general"]>(
      "/platform/general",
      settings,
    );
  }

  // Security Settings
  async getSecuritySettings(): Promise<PlatformSettings["security"]> {
    const settings = await this.getSettings();
    return settings.security;
  }

  async updateSecuritySettings(
    settings: Partial<PlatformSettings["security"]>,
  ): Promise<PlatformSettings["security"]> {
    return this.apiClient.patch<PlatformSettings["security"]>(
      "/platform/security",
      settings,
    );
  }

  // Notification Settings
  async getNotificationSettings(): Promise<PlatformSettings["notifications"]> {
    const settings = await this.getSettings();
    return settings.notifications;
  }

  async updateNotificationSettings(
    settings: Partial<PlatformSettings["notifications"]>,
  ): Promise<PlatformSettings["notifications"]> {
    return this.apiClient.patch<PlatformSettings["notifications"]>(
      "/platform/notifications",
      settings,
    );
  }

  // Integration Settings
  async getIntegrationSettings(): Promise<PlatformSettings["integrations"]> {
    const settings = await this.getSettings();
    return settings.integrations;
  }

  async updateIntegrationSettings(
    settings: Partial<PlatformSettings["integrations"]>,
  ): Promise<PlatformSettings["integrations"]> {
    return this.apiClient.patch<PlatformSettings["integrations"]>(
      "/platform/integrations",
      settings,
    );
  }
}
