/**
 * Tier Settings Service Implementation
 *
 * Single Responsibility: Only handles tenant tier management
 * Depends on abstraction (ISettingsApiClient) - DIP compliant
 */

import type { TenantTier } from "@/types/settings.types";
import type { ITierSettingsService, ISettingsApiClient } from "./interfaces";

export class TierSettingsService implements ITierSettingsService {
  constructor(private apiClient: ISettingsApiClient) {}

  // Tier CRUD
  async getTiers(): Promise<TenantTier[]> {
    const response = await this.apiClient.get<{ items: TenantTier[] }>(
      "/tiers",
    );
    return response.items;
  }

  async getTier(id: string): Promise<TenantTier> {
    return this.apiClient.get<TenantTier>(`/tiers/${id}`);
  }

  async createTier(data: Partial<TenantTier>): Promise<TenantTier> {
    return this.apiClient.post<TenantTier>("/tiers", data);
  }

  async updateTier(id: string, data: Partial<TenantTier>): Promise<TenantTier> {
    return this.apiClient.patch<TenantTier>(`/tiers/${id}`, data);
  }

  async deleteTier(id: string): Promise<void> {
    await this.apiClient.delete(`/tiers/${id}`);
  }

  async toggleTier(id: string, active: boolean): Promise<TenantTier> {
    return this.apiClient.patch<TenantTier>(`/tiers/${id}/toggle`, {
      isActive: active,
    });
  }

  async setDefaultTier(id: string): Promise<TenantTier> {
    return this.apiClient.post<TenantTier>(`/tiers/${id}/set-default`);
  }

  async reorderTiers(orderedIds: string[]): Promise<TenantTier[]> {
    const response = await this.apiClient.post<{ items: TenantTier[] }>(
      "/tiers/reorder",
      { orderedIds },
    );
    return response.items;
  }

  // Features
  async getTierFeatures(tierId: string): Promise<TenantTier["features"]> {
    const tier = await this.getTier(tierId);
    return tier.features;
  }

  async updateTierFeatures(
    tierId: string,
    features: TenantTier["features"],
  ): Promise<TenantTier> {
    return this.updateTier(tierId, { features });
  }

  // Permissions
  async getTierPermissions(tierId: string): Promise<TenantTier["permissions"]> {
    const tier = await this.getTier(tierId);
    return tier.permissions;
  }

  async updateTierPermissions(
    tierId: string,
    permissions: TenantTier["permissions"],
  ): Promise<TenantTier> {
    return this.updateTier(tierId, { permissions });
  }
}
