// ─── AxiosApiClient.ts (Admin) ─────────────────────────────────────────────────
// Adapter that wraps the admin's existing Axios `api` client behind the IApiClient
// abstraction. Allows the unified ChatService to depend on IApiClient (DIP)
// instead of directly on Axios.
//
// The admin's `api` already handles CSRF + auth refresh + error parsing, so this
// adapter is a thin shim that translates IApiClient contracts to Axios calls
// and normalizes the response shape.

import type { AxiosInstance, AxiosResponse } from 'axios';
import type { ApiResponse, IApiClient, RequestConfig } from './interfaces/IApiClient';

export class AxiosApiClient implements IApiClient {
  constructor(private readonly axios: AxiosInstance) {}

  private toConfig(config?: RequestConfig) {
    if (!config) return undefined;
    return {
      ...(config.params ? { params: config.params } : {}),
      ...(config.headers ? { headers: config.headers } : {}),
      ...(config.signal ? { signal: config.signal } : {}),
    };
  }

  private toEnvelope<T>(res: AxiosResponse<T>): ApiResponse<T> {
    // Admin's api returns the body directly via res.data (no envelope).
    // Wrap it to match IApiClient's expected { status, data, meta } shape.
    return {
      status: 'success',
      data: res.data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'unknown',
      },
    };
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const res = await this.axios.get<T>(endpoint, this.toConfig(config));
    return this.toEnvelope(res);
  }

  async post<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    const res = await this.axios.post<T>(endpoint, data, this.toConfig(config));
    return this.toEnvelope(res);
  }

  async patch<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    const res = await this.axios.patch<T>(endpoint, data, this.toConfig(config));
    return this.toEnvelope(res);
  }

  async put<T>(endpoint: string, data: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    const res = await this.axios.put<T>(endpoint, data, this.toConfig(config));
    return this.toEnvelope(res);
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    const res = await this.axios.delete<T>(endpoint, this.toConfig(config));
    return this.toEnvelope(res);
  }
}
