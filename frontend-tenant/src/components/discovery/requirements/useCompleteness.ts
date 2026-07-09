/**
 * useCompleteness — fetch + re-fetch EntityCompleteness for a project.
 */

'use client';

import { useEffect, useState } from 'react';
import { informationEngineService } from '@/services/projectTypes.service';
import type { EntityCompleteness } from '../types';

interface State {
  snapshot: EntityCompleteness | null;
  loading: boolean;
  error: string | null;
}

export function useCompleteness(
  projectId: string | null,
): State & { refresh: () => Promise<void> } {
  const [state, setState] = useState<State>({
    snapshot: null,
    loading: false,
    error: null,
  });

  async function load() {
    if (!projectId) {
      setState({ snapshot: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const snapshot = await informationEngineService.getCompleteness(projectId);
      setState({ snapshot, loading: false, error: null });
    } catch (e) {
      setState({
        snapshot: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load completeness',
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return { ...state, refresh: load };
}