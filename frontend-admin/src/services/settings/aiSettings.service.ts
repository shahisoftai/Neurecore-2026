/**
 * AI Settings Service Implementation
 *
 * Single Responsibility: Only handles AI provider configuration
 * Depends on abstraction (ISettingsApiClient) - DIP compliant
 */

import type { AIProviderConfig, AIModel } from "@/types/settings.types";
import type { IAISettingsService, ISettingsApiClient } from "./interfaces";

export class AISettingsService implements IAISettingsService {
  constructor(private apiClient: ISettingsApiClient) {}

  // Provider Management
  async getProviders(): Promise<AIProviderConfig[]> {
    const response = await this.apiClient.get<{ items: AIProviderConfig[] }>(
      "/ai/providers",
    );
    return response.items;
  }

  async getProvider(id: string): Promise<AIProviderConfig> {
    return this.apiClient.get<AIProviderConfig>(`/ai/providers/${id}`);
  }

  async createProvider(
    data: Partial<AIProviderConfig>,
  ): Promise<AIProviderConfig> {
    return this.apiClient.post<AIProviderConfig>("/ai/providers", data);
  }

  async updateProvider(
    id: string,
    data: Partial<AIProviderConfig>,
  ): Promise<AIProviderConfig> {
    return this.apiClient.patch<AIProviderConfig>(`/ai/providers/${id}`, data);
  }

  async deleteProvider(id: string): Promise<void> {
    await this.apiClient.delete(`/ai/providers/${id}`);
  }

  async toggleProvider(
    id: string,
    enabled: boolean,
  ): Promise<AIProviderConfig> {
    return this.apiClient.patch<AIProviderConfig>(
      `/ai/providers/${id}/toggle`,
      { enabled },
    );
  }

  async setDefaultProvider(id: string): Promise<AIProviderConfig> {
    return this.apiClient.post<AIProviderConfig>(
      `/ai/providers/${id}/set-default`,
    );
  }

  // Model Management
  async getModels(providerId: string): Promise<AIModel[]> {
    const response = await this.apiClient.get<{ items: AIModel[] }>(
      `/ai/providers/${providerId}/models`,
    );
    return response.items;
  }

  async addModel(
    providerId: string,
    model: Partial<AIModel>,
  ): Promise<AIModel> {
    return this.apiClient.post<AIModel>(
      `/ai/providers/${providerId}/models`,
      model,
    );
  }

  async updateModel(
    providerId: string,
    modelId: string,
    data: Partial<AIModel>,
  ): Promise<AIModel> {
    return this.apiClient.patch<AIModel>(
      `/ai/providers/${providerId}/models/${modelId}`,
      data,
    );
  }

  async deleteModel(providerId: string, modelId: string): Promise<void> {
    await this.apiClient.delete(
      `/ai/providers/${providerId}/models/${modelId}`,
    );
  }

  async toggleModel(
    providerId: string,
    modelId: string,
    enabled: boolean,
  ): Promise<AIModel> {
    return this.apiClient.patch<AIModel>(
      `/ai/providers/${providerId}/models/${modelId}/toggle`,
      { enabled },
    );
  }

  async setDefaultModel(providerId: string, modelId: string): Promise<AIModel> {
    return this.apiClient.post<AIModel>(
      `/ai/providers/${providerId}/models/${modelId}/set-default`,
    );
  }

  // Validation
  async testProviderConnection(
    id: string,
  ): Promise<{ success: boolean; latency: number; error?: string }> {
    return this.apiClient.post<{
      success: boolean;
      latency: number;
      error?: string;
    }>(`/ai/providers/${id}/test`);
  }
}
