import api from './api';
import type {
  AdminBrevoDisconnectResult,
  AdminBrevoEventsResponse,
  AdminBrevoHealth,
  AdminBrevoPlatformStats,
  AdminBrevoResetQuotaResult,
  AdminBrevoSuppressionListResponse,
  AdminBrevoTenantRow,
  AdminBrevoUsagePoint,
  BrevoSuppressionReason,
  BrevoWebhookEventType,
} from '@/types/adminBrevo.types';

class AdminBrevoService {
  async getPlatformStats(): Promise<AdminBrevoPlatformStats> {
    const r = await api.get('/integrations/admin/brevo/platform-status');
    return (r.data ?? r) as AdminBrevoPlatformStats;
  }

  async listTenants(): Promise<AdminBrevoTenantRow[]> {
    const r = await api.get('/integrations/admin/brevo/tenants');
    return (Array.isArray(r) ? r : (r.data ?? [])) as AdminBrevoTenantRow[];
  }

  async getUsageSeries(): Promise<AdminBrevoUsagePoint[]> {
    const r = await api.get('/integrations/admin/brevo/usage-series');
    return (Array.isArray(r) ? r : (r.data ?? [])) as AdminBrevoUsagePoint[];
  }

  async getHealth(): Promise<AdminBrevoHealth> {
    const r = await api.get('/integrations/admin/brevo/health');
    return (r.data ?? r) as AdminBrevoHealth;
  }

  async listEvents(opts: {
    tenantId?: string;
    eventType?: BrevoWebhookEventType | '';
    messageId?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<AdminBrevoEventsResponse> {
    const r = await api.get('/integrations/admin/brevo/events', {
      params: {
        tenantId: opts.tenantId || undefined,
        eventType: opts.eventType || undefined,
        messageId: opts.messageId || undefined,
        from: opts.from || undefined,
        to: opts.to || undefined,
        limit: opts.limit,
        offset: opts.offset,
      },
    });
    return (r.data ?? r) as AdminBrevoEventsResponse;
  }

  async disconnectTenant(
    tenantId: string,
  ): Promise<AdminBrevoDisconnectResult> {
    const r = await api.post(
      `/integrations/admin/brevo/tenants/${tenantId}/disconnect`,
    );
    return (r.data ?? r) as AdminBrevoDisconnectResult;
  }

  async resetQuota(tenantId: string): Promise<AdminBrevoResetQuotaResult> {
    const r = await api.post(
      `/integrations/admin/brevo/tenants/${tenantId}/reset-quota`,
    );
    return (r.data ?? r) as AdminBrevoResetQuotaResult;
  }

  // ── Suppressions ────────────────────────────────────────────────

  async listSuppressions(opts: {
    email?: string;
    reason?: BrevoSuppressionReason | "";
    tenantId?: string | null;
    limit?: number;
    offset?: number;
  } = {}): Promise<AdminBrevoSuppressionListResponse> {
    const r = await api.get('/integrations/admin/brevo/suppressions', {
      params: {
        email: opts.email || undefined,
        reason: opts.reason || undefined,
        tenantId:
          opts.tenantId === null
            ? 'null'
            : opts.tenantId === undefined
              ? undefined
              : opts.tenantId,
        limit: opts.limit,
        offset: opts.offset,
      },
    });
    return (r.data ?? r) as AdminBrevoSuppressionListResponse;
  }

  async addSuppression(input: {
    email: string;
    reason: BrevoSuppressionReason;
    tenantId?: string | null;
    details?: Record<string, unknown>;
  }): Promise<{ success: boolean; created: boolean }> {
    const r = await api.post('/integrations/admin/brevo/suppressions', input);
    return (r.data ?? r) as { success: boolean; created: boolean };
  }

  async removeSuppression(id: string): Promise<{ deleted: boolean }> {
    const r = await api.delete(
      `/integrations/admin/brevo/suppressions/${id}`,
    );
    return (r.data ?? r) as { deleted: boolean };
  }
}

export const adminBrevoService = new AdminBrevoService();
