'use client';

/**
 * useServerFeatureFlag — reads a backend-managed feature flag.
 *
 * Backed by `featureFlags.service.ts` which calls `/api/v1/feature-flags/me`.
 * Returns `false` while loading (fail-closed default) and supports the
 * `unknown` flag name shape used by the backend (string union optional).
 *
 * Server-side flags include: HERMES_ENABLED, HERMES_AUTO_LINK,
 * HERMES_APPROVAL_REQUIRED, HERMES_SESSION_LOGGING, DISABLE_AI_ACTIONS.
 */

import { useEffect, useState } from 'react';
import { fetchMyFeatureFlags } from '@/services/featureFlags.service';

export type ServerFeatureFlag =
  | 'HERMES_ENABLED'
  | 'HERMES_AUTO_LINK'
  | 'HERMES_APPROVAL_REQUIRED'
  | 'HERMES_SESSION_LOGGING'
  | 'DISABLE_AI_ACTIONS'
  | 'COMM_THREADS_ENABLED'
  | 'COMM_ACTIVITIES_ENABLED'
  | 'COMM_PRESENCE_ENABLED'
  | 'COMM_CONVERSATION_INTELLIGENCE_ENABLED'
  | 'COMM_DIGEST_ENABLED'
  | 'COMM_ESCALATION_ENABLED'
  | 'COMM_FOLLOWUP_ENABLED'
  | 'COMM_MENTIONS_ENABLED'
  | 'AGENT_MESSAGING_ENABLED'
  | 'COMM_AGENT_MESSAGING_ENABLED';

export function useServerFeatureFlag(flag: ServerFeatureFlag): boolean {
  const [value, setValue] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyFeatureFlags()
      .then((snap) => {
        if (!cancelled) setValue(Boolean(snap.effective?.[flag]));
      })
      .catch(() => {
        if (!cancelled) setValue(false);
      });
    return () => {
      cancelled = true;
    };
  }, [flag]);

  return value;
}

/** Returns the full snapshot — useful for components that gate on multiple flags. */
export function useServerFeatureFlags() {
  const [snapshot, setSnapshot] = useState<{
    effective: Record<string, boolean>;
    overrides: Record<string, boolean>;
  }>({ effective: {}, overrides: {} });

  useEffect(() => {
    let cancelled = false;
    fetchMyFeatureFlags()
      .then((snap) => {
        if (!cancelled) setSnapshot(snap);
      })
      .catch(() => {
        /* swallow — default empty */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return snapshot;
}