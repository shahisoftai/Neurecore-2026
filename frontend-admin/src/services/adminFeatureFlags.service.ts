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