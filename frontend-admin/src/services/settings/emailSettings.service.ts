/**
 * Email Settings Service Implementation
 *
 * Single Responsibility: Only handles email configuration
 * Depends on abstraction (ISettingsApiClient) - DIP compliant
 */

import type {
  EmailConfig,
  EmailTemplate,
  EmailLog,
  PaginatedAuditLogs,
} from "@/types/settings.types";
import type { IEmailSettingsService, ISettingsApiClient } from "./interfaces";

export class EmailSettingsService implements IEmailSettingsService {
  constructor(private apiClient: ISettingsApiClient) {}

  // Configuration
  async getConfigs(): Promise<EmailConfig[]> {
    const response = await this.apiClient.get<{ items: EmailConfig[] }>(
      "/email/configs",
    );
    return response.items;
  }

  async getConfig(id: string): Promise<EmailConfig> {
    return this.apiClient.get<EmailConfig>(`/email/configs/${id}`);
  }

  async createConfig(data: Partial<EmailConfig>): Promise<EmailConfig> {
    return this.apiClient.post<EmailConfig>("/email/configs", data);
  }

  async updateConfig(
    id: string,
    data: Partial<EmailConfig>,
  ): Promise<EmailConfig> {
    return this.apiClient.patch<EmailConfig>(`/email/configs/${id}`, data);
  }

  async deleteConfig(id: string): Promise<void> {
    await this.apiClient.delete(`/email/configs/${id}`);
  }

  async toggleConfig(id: string, enabled: boolean): Promise<EmailConfig> {
    return this.apiClient.patch<EmailConfig>(`/email/configs/${id}/toggle`, {
      isEnabled: enabled,
    });
  }

  async setDefaultConfig(id: string): Promise<EmailConfig> {
    return this.apiClient.post<EmailConfig>(`/email/configs/${id}/set-default`);
  }

  async testConfig(
    id: string,
    testEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.apiClient.post<{ success: boolean; error?: string }>(
      `/email/configs/${id}/test`,
      { testEmail },
    );
  }

  // Templates
  async getTemplates(): Promise<EmailTemplate[]> {
    const response = await this.apiClient.get<{ items: EmailTemplate[] }>(
      "/email/templates",
    );
    return response.items;
  }

  async getTemplate(id: string): Promise<EmailTemplate> {
    return this.apiClient.get<EmailTemplate>(`/email/templates/${id}`);
  }

  async createTemplate(data: Partial<EmailTemplate>): Promise<EmailTemplate> {
    return this.apiClient.post<EmailTemplate>("/email/templates", data);
  }

  async updateTemplate(
    id: string,
    data: Partial<EmailTemplate>,
  ): Promise<EmailTemplate> {
    return this.apiClient.patch<EmailTemplate>(`/email/templates/${id}`, data);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.apiClient.delete(`/email/templates/${id}`);
  }

  async toggleTemplate(id: string, active: boolean): Promise<EmailTemplate> {
    return this.apiClient.patch<EmailTemplate>(
      `/email/templates/${id}/toggle`,
      { isActive: active },
    );
  }

  // Logs
  async getLogs(params?: {
    page?: number;
    limit?: number;
    status?: EmailLog["status"];
    type?: EmailTemplate["type"];
    search?: string;
  }): Promise<PaginatedAuditLogs> {
    return this.apiClient.get<PaginatedAuditLogs>("/email/logs", params);
  }

  async getLog(id: string): Promise<EmailLog> {
    return this.apiClient.get<EmailLog>(`/email/logs/${id}`);
  }

  async resendEmail(logId: string): Promise<EmailLog> {
    return this.apiClient.post<EmailLog>(`/email/logs/${logId}/resend`);
  }
}
