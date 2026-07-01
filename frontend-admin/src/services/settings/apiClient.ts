/**
 * Settings API Client Implementation
 *
 * Concrete implementation of ISettingsApiClient
 * Uses dependency injection - can be easily swapped for testing (DIP)
 */

import api from "@/services/api";
import type { ISettingsApiClient } from "./interfaces";

export class SettingsApiClient implements ISettingsApiClient {
  private basePath: string;

  constructor(basePath: string = "/settings") {
    this.basePath = basePath;
  }

  async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const response = await api.get<T>(`${this.basePath}${endpoint}`, {
      params,
    });
    return response.data;
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await api.post<T>(`${this.basePath}${endpoint}`, data);
    return response.data;
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await api.put<T>(`${this.basePath}${endpoint}`, data);
    return response.data;
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await api.patch<T>(`${this.basePath}${endpoint}`, data);
    return response.data;
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await api.delete<T>(`${this.basePath}${endpoint}`);
    return response.data;
  }
}

// ============================================
// FACTORY (DIP - depends on interface)
// ============================================

let apiClientInstance: ISettingsApiClient | null = null;

export function getSettingsApiClient(): ISettingsApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new SettingsApiClient();
  }
  return apiClientInstance;
}

export function setSettingsApiClient(client: ISettingsApiClient): void {
  apiClientInstance = client;
}
