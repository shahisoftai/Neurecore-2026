/**
 * useResolvedRequirements — fetch the flat question list for a project.
 *
 * Re-fetches when `projectId` changes. Returns `undefined` while loading
 * and `[]` when the project is untyped (engine has nothing to ask).
 */

'use client';

import { useEffect, useState } from 'react';
import { informationEngineService } from '@/services/projectTypes.service';
import type { ResolvedQuestion } from '../types';

interface State {
  questions: ResolvedQuestion[];
  loading: boolean;
  error: string | null;
}

export function useResolvedRequirements(
  projectId: string | null,
): State & { refresh: () => Promise<void> } {
  const [state, setState] = useState<State>({
    questions: [],
    loading: false,
    error: null,
  });

  async function load() {
    if (!projectId) {
      setState({ questions: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { questions } = await informationEngineService.getResolvedRequirements(projectId);
      setState({ questions, loading: false, error: null });
    } catch (e) {
      setState({
        questions: [],
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load requirements',
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return { ...state, refresh: load };
}