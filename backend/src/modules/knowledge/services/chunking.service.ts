/**
 * ChunkingService — recursive character text splitter.
 *
 * Phase 6, Task 6.1 (per EAOS-implementation-plan.md §9.7).
 *
 * Splits long knowledge text into overlapping chunks that respect natural
 * paragraph / sentence boundaries, suitable for embedding + retrieval.
 *
 * Algorithm:
 *   1. Try splitting on `\n\n` (paragraphs).
 *   2. If any chunk > maxChunkChars, split on `\n` (lines).
 *   3. If still too large, split on sentence terminators (`. `, `? `, `! `).
 *   4. If still too large, hard-split at maxChunkChars.
 *   5. Greedily merge short consecutive chunks (avoid sub-100 char slivers).
 *   6. Apply overlap of `overlapChars` between consecutive chunks.
 *
 * SOLID — SRP: owns ONLY chunking. No embedding, no persistence.
 */

import { Injectable } from '@nestjs/common';
import type {
  ChunkingOptions,
  IChunkingService,
  KnowledgeChunk,
} from '../interfaces/knowledge.interface';

const DEFAULT_MAX_CHUNK = 1_200;
const DEFAULT_OVERLAP = 200;
const MIN_CHUNK_CHARS = 100;

@Injectable()
export class ChunkingService implements IChunkingService {
  split(text: string, options?: ChunkingOptions): KnowledgeChunk[] {
    const max = options?.maxChunkChars ?? DEFAULT_MAX_CHUNK;
    const overlap = Math.min(options?.overlapChars ?? DEFAULT_OVERLAP, max / 2);

    if (!text || !text.trim()) return [];

    const cleaned = text.replace(/\r\n/g, '\n').trim();

    const raw = this.recursiveSplit(cleaned, max, [
      '\n\n',
      '\n',
      '. ',
      '? ',
      '! ',
      '; ',
    ]);

    const merged = this.greedyMerge(raw, max, MIN_CHUNK_CHARS);

    return this.applyOverlap(merged, overlap).map((chunk, i) => ({
      chunkIndex: i,
      text: chunk.text.trim(),
      tokenEstimate: Math.ceil(chunk.text.length / 4),
    }));
  }

  /**
   * Recursive split: try separators in order; if any piece exceeds max,
   * recurse with the next separator. When separators are exhausted,
   * hard-cut at `max` to guarantee no chunk exceeds the limit.
   */
  private recursiveSplit(text: string, max: number, seps: string[]): string[] {
    if (text.length <= max) return [text];

    const sep = seps[0];
    const rest = seps.slice(1);

    // No more separators — hard-split at max.
    if (!sep) {
      const out: string[] = [];
      for (let i = 0; i < text.length; i += max) {
        out.push(text.slice(i, i + max));
      }
      return out;
    }

    // If the separator doesn't appear in the text, skip it entirely.
    if (!text.includes(sep)) {
      return this.recursiveSplit(text, max, rest);
    }

    const pieces = text.split(sep).flatMap((p) => [p, sep]);
    // Trim the trailing separator that split() always leaves.
    pieces.pop();

    const out: string[] = [];
    let buf = '';
    for (const piece of pieces) {
      if (buf.length + piece.length <= max) {
        buf += piece;
      } else {
        if (buf.trim()) out.push(buf);
        buf = piece;
      }
    }
    if (buf.trim()) out.push(buf);

    if (rest.length === 0) return out;

    return out.flatMap((p) =>
      p.length > max ? this.recursiveSplit(p, max, rest) : [p],
    );
  }

  /**
   * Merge consecutive sub-threshold chunks to reduce embedding churn.
   * Never merges a chunk into a buffer if doing so would exceed `max`.
   * Never merges two chunks that are both already at the max length.
   */
  private greedyMerge(
    chunks: string[],
    max: number,
    minChars: number,
  ): string[] {
    const out: string[] = [];
    let buf = '';
    for (const chunk of chunks) {
      const wouldExceed = buf.length + chunk.length > max;

      if (chunk.length >= minChars) {
        if (buf) {
          out.push(buf);
          buf = '';
        }
        out.push(chunk);
      } else if (!wouldExceed) {
        buf += chunk;
      } else {
        if (buf) out.push(buf);
        buf = chunk;
      }
    }
    if (buf) out.push(buf);
    return out.length > 0 ? out : chunks;
  }

  /** Add `overlap` chars from the tail of each chunk to the head of the next. */
  private applyOverlap(
    chunks: string[],
    overlap: number,
  ): { text: string }[] {
    if (overlap <= 0 || chunks.length <= 1) {
      return chunks.map((text) => ({ text }));
    }

    return chunks.map((text, i) => {
      if (i === 0) return { text };
      const tail = chunks[i - 1].slice(-overlap);
      return { text: tail + text };
    });
  }
}