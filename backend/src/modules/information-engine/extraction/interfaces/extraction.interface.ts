/**
 * Extraction — Interfaces (Phase 2E)
 *
 * SOLID — pure interface contracts for the document-extraction channel.
 */

import type { ResolvedQuestion } from '../../requirements/interfaces/requirements.interface';

export type ExtractionCandidate = {
  questionId: string;
  value: unknown;
  confidence: number;
  /** 0-based offset of the matched text in the original document. */
  offset: number;
  /** True when the extractor wants the user to confirm before recording. */
  needsReview: boolean;
};

export type ExtractionJob = {
  documentId: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  /** Markdown / plain-text dump of the document. */
  text: string;
  candidates: ExtractionCandidate[];
};

export type AcceptCandidatesInput = {
  documentId: string;
  acceptedQuestionIds: string[];
};

export interface IDocumentExtractionService {
  /**
   * Run the extraction pipeline over a buffer. Returns the parsed text +
   * heuristic candidates for the engine's resolved questions.
   *
   * Phase 2E ships a regex-based heuristic; Phase 2F upgrades to a real LLM
   * extractor (via PROJECT_DISCOVERY tool set + Hermes).
   */
  extract(
    projectId: string,
    file: { buffer: Buffer; fileName: string; mimeType: string },
    resolved: ResolvedQuestion[],
  ): Promise<ExtractionJob>;

  /**
   * Persist a subset of candidates (those the user accepted) into
   * InformationResponse, then recompute completeness.
   */
  acceptCandidates(
    projectId: string,
    tenantId: string,
    job: ExtractionJob,
    acceptedQuestionIds: string[],
  ): Promise<{ recorded: number; completeness: unknown }>;
}
