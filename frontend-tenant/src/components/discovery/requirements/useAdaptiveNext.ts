/**
 * useAdaptiveNext — fetch the deterministic next question.
 */

'use client';

import { useEffect, useState } from 'react';
import { informationEngineService } from '@/services/projectTypes.service';
import type { ResolvedQuestion } from '../types';

interface State {
  question: ResolvedQuestion | null;
  existingResponse: { value: unknown; confidence: number } | null;
  loading: boolean;
  error: string | null;
}

export function useAdaptiveNext(
  projectId: string | null,
): State & { refresh: () => Promise<void> } {
  const [state, setState] = useState<State>({
    question: null,
    existingResponse: null,
    loading: false,
    error: null,
  });

  async function load() {
    if (!projectId) {
      setState({ question: null, existingResponse: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { question, existingResponse } = await informationEngineService.getNextQuestion(projectId);
      setState({ question, existingResponse: existingResponse ?? null, loading: false, error: null });
    } catch (e) {
      setState({
        question: null,
        existingResponse: null,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load next question',
      });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return { ...state, refresh: load };
}