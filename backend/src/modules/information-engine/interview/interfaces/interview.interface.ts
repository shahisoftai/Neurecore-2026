/**
 * Interview — Interfaces (Phase 2E)
 *
 * SOLID — pure interface contracts for the conversational channel.
 */

import type { EntityCompletenessSnapshot } from '../../completeness/interfaces/completeness.interface';
import type { InformationResponse } from '../../responses/interfaces/response.interface';
import type { ResolvedQuestion } from '../../requirements/interfaces/requirements.interface';

export type InterviewTurn = {
  prompt: string;
  question: ResolvedQuestion | null;
  completeness: EntityCompletenessSnapshot;
};

export interface AskNextContext {
  hasCustomer?: boolean;
  classification?: string | null;
}

export interface IInterviewService {
  /**
   * Returns the conversational prompt + the resolved question that the
   * interviewer should ask next. Pure delegation — no LLM call lives here.
   *
   * `tenantId` is accepted for symmetry with the controller layer; the
   * service derives context from the project row directly.
   */
  askNext(
    projectId: string,
    tenantId: string | null,
    ctx: AskNextContext,
  ): Promise<InterviewTurn>;

  /**
   * Parses a free-form reply into one or more (questionId, value) pairs
   * and persists them via the engine. Returns the extracted responses
   * plus the recomputed completeness snapshot.
   */
  parseReply(
    projectId: string,
    tenantId: string | null,
    message: string,
    ctx: AskNextContext,
  ): Promise<{
    extracted: InformationResponse[];
    completeness: EntityCompletenessSnapshot;
  }>;
}
