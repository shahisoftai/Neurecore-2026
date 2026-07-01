/**
 * Settings Service for NeureCore Admin
 *
 * Handles all API calls for the Settings interface including:
 * - AI Provider management (Deepseek, Gemini, Openrouter)
 * - Tenant Tier management
 * - Email configuration and templates
 * - Audit logs
 * - Platform settings
 */

import api from "./api";
import { unwrapItem, unwrapList } from "./unwrap";
import type {
  AIProviderConfig,
  AIModel,
  TenantTier,
  EmailConfig,
  EmailTemplate,
  EmailLog,
  AuditLog,
  PlatformSettings,
  PaginatedAuditLogs,
  SettingsResponse,
} from "@/types/settings.types";

// ============================================
// AI PROVIDERS
// ============================================

export const aiSettingsService = {
  async listProviders(): Promise<AIProviderConfig[]> {
    const res = await api.get("/settings/ai/providers");
    return unwrapList(res).items;
  },

  async getProvider(id: string): Promise<AIProviderConfig> {
    const res = await api.get(`/settings/ai/providers/${id}`);
    return unwrapItem(res);
  },

  async createProvider(
    data: Partial<AIProviderConfig>,
  ): Promise<AIProviderConfig> {
    const res = await api.post("/settings/ai/providers", data);
    return unwrapItem(res);
  },

  async updateProvider(
    id: string,
    data: Partial<AIProviderConfig>,
  ): Promise<AIProviderConfig> {
    const res = await api.patch(`/settings/ai/providers/${id}`, data);
    return unwrapItem(res);
  },

  async deleteProvider(id: string): Promise<void> {
    await api.delete(`/settings/ai/providers/${id}`);
  },

  async setDefaultProvider(id: string): Promise<AIProviderConfig> {
    const res = await api.post(`/settings/ai/providers/${id}/set-default`);
    return unwrapItem(res);
  },

  async testProvider(
    id: string,
  ): Promise<{ success: boolean; latency: number; error?: string }> {
    const res = await api.post(`/settings/ai/providers/${id}/test`);
    return unwrapItem(res);
  },

  // Models
  async listModels(providerId?: string): Promise<AIModel[]> {
    const res = await api.get("/settings/ai/models", {
      params: providerId ? { providerId } : undefined,
    });
    return unwrapList(res).items;
  },

  async addModel(providerId: string, data: Partial<AIModel>): Promise<AIModel> {
    const res = await api.post(
      `/settings/ai/providers/${providerId}/models`,
      data,
    );
    return unwrapItem(res);
  },

  async updateModel(
    providerId: string,
    modelId: string,
    data: Partial<AIModel>,
  ): Promise<AIModel> {
    const res = await api.patch(
      `/settings/ai/providers/${providerId}/models/${modelId}`,
      data,
    );
    return unwrapItem(res);
  },

  async deleteModel(providerId: string, modelId: string): Promise<void> {
    await api.delete(`/settings/ai/providers/${providerId}/models/${modelId}`);
  },
};

// ============================================
// TENANT TIERS
// ============================================

export const tierService = {
  async list(): Promise<TenantTier[]> {
    const res = await api.get("/settings/tiers");
    return unwrapList(res).items;
  },

  async get(id: string): Promise<TenantTier> {
    const res = await api.get(`/settings/tiers/${id}`);
    return unwrapItem(res);
  },

  async create(data: Partial<TenantTier>): Promise<TenantTier> {
    const res = await api.post("/settings/tiers", data);
    return unwrapItem(res);
  },

  async update(id: string, data: Partial<TenantTier>): Promise<TenantTier> {
    const res = await api.patch(`/settings/tiers/${id}`, data);
    return unwrapItem(res);
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/settings/tiers/${id}`);
  },

  async setDefault(id: string): Promise<TenantTier> {
    const res = await api.post(`/settings/tiers/${id}/set-default`);
    return unwrapItem(res);
  },

  async reorder(tierIds: string[]): Promise<TenantTier[]> {
    const res = await api.post("/settings/tiers/reorder", { tierIds });
    return unwrapList(res).items;
  },

  async getUsage(tierId: string): Promise<{ tenants: number; users: number }> {
    const res = await api.get(`/settings/tiers/${tierId}/usage`);
    return unwrapItem(res);
  },
};

// ============================================
// EMAIL SYSTEM
// ============================================

export const emailSettingsService = {
  async getConfig(): Promise<EmailConfig | null> {
    try {
      const res = await api.get("/settings/email/config");
      return unwrapItem(res);
    } catch {
      return null;
    }
  },

  async updateConfig(data: Partial<EmailConfig>): Promise<EmailConfig> {
    const res = await api.patch("/settings/email/config", data);
    return unwrapItem(res);
  },

  async testConfig(): Promise<{ success: boolean; message: string }> {
    const res = await api.post("/settings/email/test");
    return unwrapItem(res);
  },

  // Templates
  async listTemplates(): Promise<EmailTemplate[]> {
    const res = await api.get("/settings/email/templates");
    return unwrapList(res).items;
  },
};

// ============================================
// AUDIT LOGS
// ============================================

export const auditService = {
  async listLogs(params?: {
    page?: number;
    limit?: number;
  }): Promise<AuditLog[]> {
    const res = await api.get("/settings/audit/logs", { params });
    return unwrapList(res).items;
  },

  async getLog(id: string): Promise<AuditLog> {
    const res = await api.get(`/settings/audit/logs/${id}`);
    return unwrapItem(res);
  },
};

// ============================================
// PLATFORM SETTINGS
// ============================================

export const platformSettingsService = {
  async get(): Promise<PlatformSettings> {
    const res = await api.get("/settings/platform");
    return unwrapItem(res);
  },

  async update(data: Partial<PlatformSettings>): Promise<PlatformSettings> {
    const res = await api.patch("/settings/platform", data);
    return unwrapItem(res);
  },
};

export default {
  ai: aiSettingsService,
  tiers: tierService,
  email: emailSettingsService,
  audit: auditService,
  platform: platformSettingsService,
};
