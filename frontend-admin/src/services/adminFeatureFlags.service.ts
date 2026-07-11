// services/adminFeatureFlags.service.ts — admin-side feature flag toggle.
//
// Hits the super-admin-only `/api/v1/feature-flags/tenants/:tenantId`
// endpoints to read & write any tenant's flag overrides.

import api from './api';

export interface TenantFeatureFlagOverrides {
  HERMES_ENABLED?: boolean;
  HERMES_AUTO_LINK?: boolean;
  HERMES_APPROVAL_REQUIRED?: boolean;
  HERMES_SESSION_LOGGING?: boolean;
  DISABLE_AI_ACTIONS?: boolean;
  // Enterprise Communication Platform (2026-07-11)
  COMM_THREADS_ENABLED?: boolean;
  COMM_ACTIVITIES_ENABLED?: boolean;
  COMM_PRESENCE_ENABLED?: boolean;
  COMM_CONVERSATION_INTELLIGENCE_ENABLED?: boolean;
  COMM_DIGEST_ENABLED?: boolean;
  COMM_ESCALATION_ENABLED?: boolean;
  COMM_FOLLOWUP_ENABLED?: boolean;
  COMM_MENTIONS_ENABLED?: boolean;
  AGENT_MESSAGING_ENABLED?: boolean;
  COMM_AGENT_MESSAGING_ENABLED?: boolean;
  COMM_WORKFLOW_TEMPLATES_ENABLED?: boolean;
}

export async function getTenantFeatureFlags(
  tenantId: string,
): Promise<TenantFeatureFlagOverrides> {
  const res = await api.get(`/feature-flags/tenants/${tenantId}`);
  const data = (res.data?.data ?? res.data) as {
    overrides?: TenantFeatureFlagOverrides;
  };
  return data.overrides ?? {};
}

export async function updateTenantFeatureFlags(
  tenantId: string,
  patch: TenantFeatureFlagOverrides,
): Promise<TenantFeatureFlagOverrides> {
  const res = await api.patch(`/feature-flags/tenants/${tenantId}`, patch);
  const data = (res.data?.data ?? res.data) as {
    overrides?: TenantFeatureFlagOverrides;
  };
  return data.overrides ?? patch;
}