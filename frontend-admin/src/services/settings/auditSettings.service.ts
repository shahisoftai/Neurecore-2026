/**
 * Audit Settings Service Implementation
 *
 * Single Responsibility: Only handles audit log retrieval and export
 * Depends on abstraction (ISettingsApiClient) - DIP compliant
 */

import type { AuditLog, PaginatedAuditLogs } from "@/types/settings.types";
import type { IAuditLogsService, ISettingsApiClient } from "./interfaces";

export class AuditLogsService implements IAuditLogsService {
  constructor(private apiClient: ISettingsApiClient) {}

  async getLogs(params?: {
    page?: number;
    limit?: number;
    level?: AuditLog["level"];
    category?: AuditLog["category"];
    actorId?: string;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<PaginatedAuditLogs> {
    return this.apiClient.get<PaginatedAuditLogs>(
      "/audit/logs",
      params as Record<string, unknown>,
    );
  }

  async getLog(id: string): Promise<AuditLog> {
    return this.apiClient.get<AuditLog>(`/audit/logs/${id}`);
  }

  async exportLogs(params: {
    format: "csv" | "json" | "pdf";
    level?: AuditLog["level"];
    category?: AuditLog["category"];
    startDate?: string;
    endDate?: string;
  }): Promise<Blob> {
    const response = await this.apiClient.post<Blob>("/audit/export", params);
    return response;
  }

  async getLogSummary(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    total: number;
    byLevel: Record<AuditLog["level"], number>;
    byCategory: Record<AuditLog["category"], number>;
    byActor: { actorId: string; count: number }[];
  }> {
    return this.apiClient.get<{
      total: number;
      byLevel: Record<AuditLog["level"], number>;
      byCategory: Record<AuditLog["category"], number>;
      byActor: { actorId: string; count: number }[];
    }>("/audit/summary", params as Record<string, unknown>);
  }
}
