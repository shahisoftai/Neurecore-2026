// services/compliance.service.ts — AUP/DPA acceptance + residency/retention settings.
//
// Used by the ComplianceWizard to record AUP/DPA acceptance and configure
// data residency + retention policies.

import { restClient } from './api';

export interface ComplianceAcceptance {
  dataResidency: 'auto' | 'us' | 'eu' | 'uk' | 'asia';
  retentionDays: number;
  aupAcceptedAt: string | null;
  dpaAcceptedAt: string | null;
  aupRequiredBy: string;
  dpaRequiredBy: string;
}

const EMPTY: ComplianceAcceptance = {
  dataResidency: 'auto',
  retentionDays: 90,
  aupAcceptedAt: null,
  dpaAcceptedAt: null,
  aupRequiredBy: 'v2026.07',
  dpaRequiredBy: 'v2026.07',
};

const unwrap = async <T,>(p: Promise<{ data?: T } | null | undefined>): Promise<T | null> => {
  try {
    const r = await p;
    if (!r) return null;
    return (r.data ?? null) as T | null;
  } catch {
    return null;
  }
};

class ComplianceService {
  get = async (): Promise<ComplianceAcceptance> => {
    const r = await unwrap<ComplianceAcceptance>(
      restClient.get<ComplianceAcceptance>('/compliance/acceptance'),
    );
    return r ?? EMPTY;
  };

  acceptAup = () =>
    restClient.post<{ aupAcceptedAt: string }>(
      '/compliance/acceptance/aup',
      {},
    );

  acceptDpa = () =>
    restClient.post<{ dpaAcceptedAt: string }>(
      '/compliance/acceptance/dpa',
      {},
    );

  setResidency = (dataResidency: 'auto' | 'us' | 'eu' | 'uk' | 'asia') =>
    restClient.patch<{ dataResidency: string }>(
      '/compliance/acceptance/residency',
      { dataResidency },
    );

  setRetention = (retentionDays: number) =>
    restClient.patch<{ retentionDays: number }>(
      '/compliance/acceptance/retention',
      { retentionDays },
    );
}

export const complianceService = new ComplianceService();
export default complianceService;
