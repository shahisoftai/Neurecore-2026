/**
 * useRecordResponse — write an answer and re-fetch completeness.
 *
 * Returns the new EntityCompleteness snapshot. The caller (e.g. the form
 * skin) is responsible for keeping `inFlightAnswer` state for UX.
 */

'use client';

import { useCallback, useState } from 'react';
import { informationEngineService } from '@/services/projectTypes.service';
import type { EntityCompleteness } from '../types';

export type RecordInput = {
  questionId: string;
  value: unknown;
  sourceType?: string;
  sourceLabel?: string;
  confidence?: number;
};

export function useRecordResponse(projectId: string | null) {
  const [inFlight, setInFlight] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const record = useCallback(
    async (input: RecordInput): Promise<EntityCompleteness | null> => {
      if (!projectId) return null;
      setError(null);
      setInFlight((s) => ({ ...s, [projectId]: input.questionId }));
      try {
        const { completeness } = await informationEngineService.recordResponse(projectId, {
          questionId: input.questionId,
          value: input.value,
          sourceType: input.sourceType ?? 'USER_INPUT',
          sourceLabel: input.sourceLabel ?? 'Discovery form',
          confidence: input.confidence ?? 100,
        });
        return completeness;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to record answer');
        return null;
      } finally {
        setInFlight((s) => {
          const next = { ...s };
          delete next[projectId];
          return next;
        });
      }
    },
    [projectId],
  );

  return { record, inFlight, error };
}