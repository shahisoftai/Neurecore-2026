"use client";

import { useCallback, useEffect, useState } from "react";
import { adminBrevoService } from "@/services/adminBrevo.service";
import type {
  AdminBrevoDisconnectResult,
  AdminBrevoHealth,
  AdminBrevoPlatformStats,
  AdminBrevoResetQuotaResult,
  AdminBrevoTenantRow,
  AdminBrevoUsagePoint,
  BrevoWebhookEventType,
} from "@/types/adminBrevo.types";

export interface UseAdminBrevoState {
  loading: boolean;
  error: string | null;
  stats: AdminBrevoPlatformStats | null;
  tenants: AdminBrevoTenantRow[];
  series: AdminBrevoUsagePoint[];
  health: AdminBrevoHealth | null;
  refresh: () => Promise<void>;
  disconnectTenant: (tenantId: string) => Promise<AdminBrevoDisconnectResult>;
  resetQuota: (tenantId: string) => Promise<AdminBrevoResetQuotaResult>;
}

export function useAdminBrevo(): UseAdminBrevoState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminBrevoPlatformStats | null>(null);
  const [tenants, setTenants] = useState<AdminBrevoTenantRow[]>([]);
  const [series, setSeries] = useState<AdminBrevoUsagePoint[]>([]);
  const [health, setHealth] = useState<AdminBrevoHealth | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t, u, h] = await Promise.all([
        adminBrevoService.getPlatformStats(),
        adminBrevoService.listTenants(),
        adminBrevoService.getUsageSeries(),
        adminBrevoService.getHealth(),
      ]);
      setStats(s);
      setTenants(t ?? []);
      setSeries(u ?? []);
      setHealth(h);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnectTenant = useCallback(
    async (tenantId: string) => {
      const r = await adminBrevoService.disconnectTenant(tenantId);
      await refresh();
      return r;
    },
    [refresh],
  );

  const resetQuota = useCallback(
    async (tenantId: string) => {
      const r = await adminBrevoService.resetQuota(tenantId);
      await refresh();
      return r;
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, stats, tenants, series, health, refresh, disconnectTenant, resetQuota };
}

export interface UseAdminBrevoEventsState {
  loading: boolean;
  error: string | null;
  rows: Awaited<
    ReturnType<typeof adminBrevoService.listEvents>
  >["rows"];
  total: number;
  refresh: () => Promise<void>;
}

export function useAdminBrevoEvents(initial: {
  tenantId?: string;
  eventType?: BrevoWebhookEventType | "";
  messageId?: string;
  limit?: number;
  offset?: number;
}): UseAdminBrevoEventsState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof adminBrevoService.listEvents>>["rows"]
  >([]);
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await adminBrevoService.listEvents({
        tenantId: initial.tenantId,
        eventType: initial.eventType,
        messageId: initial.messageId,
        limit: initial.limit,
        offset: initial.offset,
      });
      setRows(r.rows);
      setTotal(r.total);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [
    initial.tenantId,
    initial.eventType,
    initial.messageId,
    initial.limit,
    initial.offset,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { loading, error, rows, total, refresh };
}
