/**
 * Extraction — Service (Phase 2E)
 *
 * Single Responsibility: turn a binary upload into structured candidates
 * keyed by questionId. Records accepted candidates via ResponseService and
 * triggers a CompletenessService recompute.
 *
 * Phase 2E ships a regex-based heuristic over the dumped text:
 *   - For SELECT / MULTI_SELECT questions: exact (case-insensitive) match
 *     of an option.
 *   - For NUMBER / DATE / CURRENCY questions: numeric / ISO regex match.
 *   - For TEXT questions: first contiguous line >= 3 chars.
 *   - For BOOLEAN questions: "yes"/"no"/"true"/"false" matches.
 *
 * Phase 2F replaces `extractCandidates` with a real LLM call routed via
 * Hermes (PROJECT_DISCOVERY tool set). The contract here stays the same.
 */

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  type IDocumentExtractionService,
  type ExtractionCandidate,
  type ExtractionJob,
} from './interfaces/extraction.interface';
import { ResponseService } from '../responses/response.service';
import { CompletenessService } from '../completeness/completeness.service';
import { ProjectTypePacksService } from '../project-type-packs/project-type-packs.service';
import { ProjectTypesService } from '../../project-types/project-types.service';
import { RequirementsService } from '../requirements/requirements.service';
import type { ResolvedQuestion } from '../requirements/interfaces/requirements.interface';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { Project } from '../../projects/interfaces/project.interface';

@Injectable()
export class DocumentExtractionService implements IDocumentExtractionService {
  private readonly logger = new Logger(DocumentExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectTypesService: ProjectTypesService,
    private readonly projectTypePacksService: ProjectTypePacksService,
    private readonly requirementsService: RequirementsService,
    private readonly responseService: ResponseService,
    private readonly completenessService: CompletenessService,
  ) {}

  async extract(
    projectId: string,
    file: { buffer: Buffer; fileName: string; mimeType: string },
    resolved: ResolvedQuestion[],
  ): Promise<ExtractionJob> {
    const text = this.bufferToText(file.buffer, file.mimeType);
    const candidates = this.extractCandidates(text, resolved);

    return {
      documentId: uuid(),
      fileName: file.fileName,
      fileSizeBytes: file.buffer.length,
      contentType: file.mimeType,
      text: text.slice(0, 50_000), // cap for safety
      candidates,
    };
  }

  async acceptCandidates(
    projectId: string,
    tenantId: string,
    job: ExtractionJob,
    acceptedQuestionIds: string[],
  ): Promise<{ recorded: number; completeness: unknown }> {
    void tenantId;
    const acceptSet = new Set(acceptedQuestionIds);
    const toRecord = job.candidates.filter((c) => acceptSet.has(c.questionId));

    for (const c of toRecord) {
      await this.responseService.record('PROJECT', projectId, {
        questionId: c.questionId,
        value: c.value,
        sourceType: 'DOCUMENT_EXTRACTION',
        sourceLabel: `Document: ${job.fileName}`,
        sourceRefType: 'Document',
        sourceRefId: job.documentId,
        confidence: c.confidence,
      });
    }

    // Re-fetch + recompute against the latest current responses.
    const resolved = await this.resolveQuestionsFor(projectId);
    const current = await this.responseService.listCurrent(
      'PROJECT',
      projectId,
    );
    const completeness = await this.completenessService.recompute(
      'PROJECT',
      projectId,
      {
        questions: resolved.map((q) => ({
          id: q.id,
          label: q.label,
          required: q.required,
          ...(q.skipIfConfidenceGte !== undefined
            ? { skipIfConfidenceGte: q.skipIfConfidenceGte }
            : {}),
        })),
        responses: current.map((r) => ({
          questionId: r.questionId,
          value: r.value,
          confidence: r.confidence,
        })),
      },
    );

    return { recorded: toRecord.length, completeness };
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  /**
   * Convert a binary buffer to text. For 2E we support plain text + a
   * best-effort PDF dump via simple byte-stream heuristics. Real PDF/DOCX
   * extraction lives in 2F.
   */
  private bufferToText(buffer: Buffer, mimeType: string): string {
    if (mimeType === 'application/pdf') {
      // Naive PDF dump — strip non-printable bytes. Real PDF parsing lives
      // in 2F (DOCLING / pdf-parse).
      return buffer
        .toString('latin1')
        .replace(/[\x00-\x08\x0E-\x1F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    // Default: utf-8 plain text.
    return buffer.toString('utf8');
  }

  /**
   * Heuristic candidate extractor.
   * Pure — does no I/O.
   */
  private extractCandidates(
    text: string,
    resolved: ResolvedQuestion[],
  ): ExtractionCandidate[] {
    const out: ExtractionCandidate[] = [];
    for (const q of resolved) {
      const c = this.matchQuestion(text, q);
      if (c) out.push(c);
    }
    return out;
  }

  private matchQuestion(
    text: string,
    q: ResolvedQuestion,
  ): ExtractionCandidate | null {
    switch (q.type) {
      case 'SELECT':
        return this.matchSelect(text, q);
      case 'MULTI_SELECT':
        return this.matchMultiSelect(text, q);
      case 'NUMBER':
      case 'CURRENCY':
        return this.matchNumeric(text, q);
      case 'DATE':
        return this.matchDate(text, q);
      case 'BOOLEAN':
        return this.matchBoolean(text, q);
      case 'TEXT':
      default:
        return this.matchText(text, q);
    }
  }

  private matchSelect(
    text: string,
    q: ResolvedQuestion,
  ): ExtractionCandidate | null {
    const opts = q.options ?? [];
    for (const opt of opts) {
      const re = new RegExp(`\\b${this.escapeRegex(opt)}\\b`, 'i');
      const m = re.exec(text);
      if (m) {
        return {
          questionId: q.questionId,
          value: opt,
          confidence: 70,
          offset: m.index,
          needsReview: true,
        };
      }
    }
    return null;
  }

  private matchMultiSelect(
    text: string,
    q: ResolvedQuestion,
  ): ExtractionCandidate | null {
    const opts = q.options ?? [];
    const hits: string[] = [];
    let firstOffset = -1;
    for (const opt of opts) {
      const re = new RegExp(`\\b${this.escapeRegex(opt)}\\b`, 'i');
      const m = re.exec(text);
      if (m) {
        hits.push(opt);
        if (firstOffset === -1 || m.index < firstOffset) firstOffset = m.index;
      }
    }
    if (hits.length === 0) return null;
    return {
      questionId: q.questionId,
      value: hits,
      confidence: 60,
      offset: firstOffset,
      needsReview: true,
    };
  }

  private matchNumeric(
    text: string,
    q: ResolvedQuestion,
  ): ExtractionCandidate | null {
    const re = /-?\d+(?:\.\d+)?/;
    const m = re.exec(text);
    if (!m) return null;
    return {
      questionId: q.questionId,
      value: Number(m[0]),
      confidence: 80,
      offset: m.index,
      needsReview: true,
    };
  }

  private matchDate(
    text: string,
    q: ResolvedQuestion,
  ): ExtractionCandidate | null {
    const re = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/;
    const m = re.exec(text);
    if (!m) return null;
    const raw = m[1];
    let iso: string | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) iso = new Date(raw).toISOString();
    else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(raw)) {
      const [a, b, c] = raw.split('/').map((x) => Number(x));
      // Assume MM/DD/YYYY (US convention) — Phase 2E heuristic only.
      const year = c < 100 ? 2000 + c : c;
      iso = new Date(Date.UTC(year, a - 1, b)).toISOString();
    }
    if (!iso) return null;
    return {
      questionId: q.questionId,
      value: iso,
      confidence: 70,
      offset: m.index,
      needsReview: true,
    };
  }

  private matchBoolean(
    text: string,
    q: ResolvedQuestion,
  ): ExtractionCandidate | null {
    const re = /\b(yes|no|true|false)\b/i;
    const m = re.exec(text);
    if (!m) return null;
    return {
      questionId: q.questionId,
      value: m[1].toLowerCase() === 'yes' || m[1].toLowerCase() === 'true',
      confidence: 75,
      offset: m.index,
      needsReview: true,
    };
  }

  private matchText(
    text: string,
    q: ResolvedQuestion,
  ): ExtractionCandidate | null {
    // First line >= 3 chars that isn't a header marker.
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length >= 3 && !trimmed.startsWith('#')) {
        return {
          questionId: q.questionId,
          value: trimmed,
          confidence: 50,
          offset: text.indexOf(trimmed),
          needsReview: true,
        };
      }
    }
    return null;
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async resolveQuestionsFor(
    projectId: string,
  ): Promise<ResolvedQuestion[]> {
    const project: Pick<Project, 'projectTypeId' | 'customerId'> | null =
      await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { projectTypeId: true, customerId: true },
      });
    if (!project || !project.projectTypeId) return [];

    const version = await this.projectTypesService.getCurrentVersion(
      project.projectTypeId,
      null,
    );
    if (!version) return [];

    const links = await this.projectTypePacksService.listForProjectType(
      project.projectTypeId,
    );
    const linkedPacks = links.map((l) => ({
      key: l.questionPack.key,
      questions: Array.isArray(l.questionPack.questions)
        ? (l.questionPack.questions as never)
        : [],
    }));

    return this.requirementsService.resolveForProjectType(
      version.informationRequirements ?? [],
      linkedPacks,
      {
        entityType: 'PROJECT',
        entityId: projectId,
        hasCustomer: !!project.customerId,
        classification: null,
        currentResponses: [],
      },
    );
  }
}
