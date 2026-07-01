'use client';

/**
 * useFeatureFlag — Phase 3 feature flag hook
 *
 * Reads flag values from NEXT_PUBLIC_REDESIGN_* env vars at build time,
 * with runtime override support via window.__FLAGS__ (for staging soak tests).
 *
 * Usage:
 *   const showCommandCenter = useFeatureFlag('commandCenter');
 *   const showWorkspace = useFeatureFlag('workspace');
 *   const showMarketplace = useFeatureFlag('marketplace');
 *
 * Env vars:
 *   NEXT_PUBLIC_REDESIGN_COMMAND_CENTER=true
 *   NEXT_PUBLIC_REDESIGN_WORKSPACE=true
 *   NEXT_PUBLIC_REDESIGN_MARKETPLACE=true
 *   ... (one per flag)
 *
 * Default: false (old UI shown) — gradual rollout via env.
 *
 * Tenant override (for staged production rollout): set the value via
 * the auth user response, then read via useFeatureFlagUserOverride.
 */

import { useEffect, useState } from 'react';

export type FeatureFlag =
  | 'commandCenter'
  | 'workspace'
  | 'marketplace'
  | 'serviceDesk'
  | 'intelligence'
  | 'finance'
  | 'departments';

/**
 * Map flag name → NEXT_PUBLIC_REDESIGN_<UPPER_SNAKE_CASE> env var.
 */
const FLAG_ENV: Record<FeatureFlag, string> = {
  commandCenter: 'NEXT_PUBLIC_REDESIGN_COMMAND_CENTER',
  workspace: 'NEXT_PUBLIC_REDESIGN_WORKSPACE',
  marketplace: 'NEXT_PUBLIC_REDESIGN_MARKETPLACE',
  serviceDesk: 'NEXT_PUBLIC_REDESIGN_SERVICE_DESK',
  intelligence: 'NEXT_PUBLIC_REDESIGN_INTELLIGENCE',
  finance: 'NEXT_PUBLIC_REDESIGN_FINANCE',
  departments: 'NEXT_PUBLIC_REDESIGN_DEPARTMENTS',
};

interface RuntimeFlags {
  [key: string]: boolean;
}

declare global {
  interface Window {
    __FLAGS__?: RuntimeFlags;
  }
}

/**
 * Read a feature flag's value.
 * Order of precedence (highest first):
 *   1. window.__FLAGS__?.[flag]  (runtime override, e.g. staging soak)
 *   2. NEXT_PUBLIC_REDESIGN_<X> env var (build-time)
 *   3. false (default)
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  const envKey = FLAG_ENV[flag];

  // Read env at build time (NEXT_PUBLIC_ inlined by Next.js)
  const envValue = (process.env[envKey] ?? '').toLowerCase() === 'true';

  const [value, setValue] = useState<boolean>(envValue);

  useEffect(() => {
    // Re-read at mount in case window.__FLAGS__ was injected before hydration
    if (typeof window !== 'undefined' && window.__FLAGS__) {
      const runtime = window.__FLAGS__[flag];
      if (typeof runtime === 'boolean') {
        setValue(runtime);
      }
    }
  }, [flag]);

  return value;
}

/**
 * Set a runtime flag override (for staging soak testing).
 * Useful for admins to flip a flag without rebuilding.
 */
export function setRuntimeFlag(flag: FeatureFlag, value: boolean): void {
  if (typeof window === 'undefined') return;
  window.__FLAGS__ = window.__FLAGS__ ?? {};
  window.__FLAGS__[flag] = value;
  // Notify listeners — same tab
  window.dispatchEvent(new CustomEvent('flags:change', { detail: { flag, value } }));
}

/**
 * Combined flags hook — returns all flags at once.
 * Components that gate multiple sections use this to avoid 7 hook calls.
 */
export function useFeatureFlags(): Record<FeatureFlag, boolean> {
  const commandCenter = useFeatureFlag('commandCenter');
  const workspace = useFeatureFlag('workspace');
  const marketplace = useFeatureFlag('marketplace');
  const serviceDesk = useFeatureFlag('serviceDesk');
  const intelligence = useFeatureFlag('intelligence');
  const finance = useFeatureFlag('finance');
  const departments = useFeatureFlag('departments');

  return {
    commandCenter,
    workspace,
    marketplace,
    serviceDesk,
    intelligence,
    finance,
    departments,
  };
}