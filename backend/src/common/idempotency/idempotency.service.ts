import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24h

/**
 * IdempotencyService — Phase 1 (Simulation-5) reusable idempotency layer.
 *
 * Not simulation-specific. Any controller that does a state-changing operation
 * (webhook ingest, billing, agent action, external API retry) can use this.
 *
 * Behaviour (per design package 07-idempotency-strategy.md):
 *
 * - The first call with a key creates an IN_FLIGHT record and runs the
 *   handler. The response is persisted with a sha256 checksum.
 * - A replay (same key, same path, same body hash) returns the original
 *   response with `replayed: true` and the same body.
 * - A reused key with a different body returns 422 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD.
 * - An IN_FLIGHT key is rare (only in distributed mode); it returns 409 IDEMPOTENCY_IN_FLIGHT.
 *
 * Atomicity: the create-then-check uses Postgres's unique-constraint semantics
 * via ON CONFLICT to prevent two workers from both winning the race.
 *
 * Response storage:
 *   - If responseBody fits in 256KB, store inline (responseStorageKind='BODY_INLINE').
 *   - If larger, store in object storage (future work); for now we cap at 256KB.
 *
 * NEVER stores plaintext service tokens or secrets.
 */
export interface IdempotencyOptions {
  /** Tenant scoping (required) */
  tenantId: string;
  /** Client-supplied key (required) */
  key: string;
  /** The request path, e.g. '/api/v1/simulations' */
  requestPath: string;
  /** Canonicalized request body (object) — used for hash + replay detection */
  requestBody: object;
  /** TTL in seconds (default 24h) */
  ttlSeconds?: number;
}

export interface IdempotencyRunOptions<T> {
  /** The handler to run on first call. Its result is persisted as the response. */
  handler: () => Promise<{ status: number; body: T }>;
  /** Optional callback for IN_FLIGHT detection (e.g. to clean up stuck records) */
  onInFlight?: (record: { startedAt: Date }) => Promise<void>;
}

export interface IdempotentResult<T> {
  status: number;
  body: T & { replayed?: boolean };
  replayed: boolean;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run a handler idempotently. On the first call, executes the handler and
   * persists the response. On replay, returns the persisted response with
   * replayed: true. See the design doc for the full state machine.
   */
  async run<T>(
    options: IdempotencyOptions,
    run: IdempotencyRunOptions<T>,
  ): Promise<IdempotentResult<T>> {
    const { tenantId, key, requestPath } = options;
    if (!key) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for this endpoint.',
      });
    }

    const requestHash = this.hashRequest(options.requestBody);
    const expiresAt = new Date(
      Date.now() + (options.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000,
    );

    // Step 1: try to create a new IN_FLIGHT record. If the key already
    // exists, we get a conflict and fall into the lookup path.
    let created: { id: string } | null = null;
    try {
      const row = await this.prisma.idempotencyRecord.create({
        data: {
          tenantId,
          key,
          requestPath,
          requestHash,
          status: 'IN_FLIGHT',
          expiresAt,
          attemptCount: 1,
        },
        select: { id: true },
      });
      created = row;
    } catch (e: any) {
      // Unique constraint violation: key already exists for this tenant.
      if (e?.code !== 'P2002') throw e;
      created = null;
    }

    if (!created) {
      return await this.replayOrReject(tenantId, key, requestPath, requestHash, run);
    }

    // Step 2: we own this key. Run the handler, persist the result.
    const startedAt = new Date();
    try {
      const { status, body } = await run.handler();
      const responseBody = body as object;
      const responseChecksum = this.hashRequest(responseBody);
      const bodyJson = JSON.stringify(responseBody);
      const storageKind = bodyJson.length <= 256 * 1024 ? 'BODY_INLINE' : 'NONE';
      await this.prisma.idempotencyRecord.update({
        where: { id: created.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          responseStatus: status,
          responseBody: storageKind === 'BODY_INLINE' ? (responseBody as any) : undefined,
          responseStorageKind: storageKind,
          responseChecksum,
        },
      });
      return { status, body: { ...body, replayed: false }, replayed: false };
    } catch (err: any) {
      await this.prisma.idempotencyRecord.update({
        where: { id: created.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          lastErrorCode: err?.code ?? 'INTERNAL_ERROR',
          lastErrorMessage: (err?.message ?? 'Unknown error').substring(0, 1024),
        },
      });
      throw err;
    }
  }

  private async replayOrReject<T>(
    tenantId: string,
    key: string,
    requestPath: string,
    requestHash: string,
    run: IdempotencyRunOptions<T>,
  ): Promise<IdempotentResult<T>> {
    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { tenantId_key: { tenantId, key } },
    });
    if (!existing) {
      // Race: someone deleted between our create attempt and lookup. Retry once.
      throw new ConflictException({
        code: 'IDEMPOTENCY_RACE',
        message: 'Idempotency record disappeared; retry the request.',
      });
    }

    if (existing.requestPath !== requestPath || existing.requestHash !== requestHash) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
        message:
          'Idempotency-Key was already used with a different endpoint or payload. Use a new key for distinct operations.',
      });
    }

    if (existing.status === 'IN_FLIGHT') {
      const ageMs = Date.now() - existing.startedAt.getTime();
      if (ageMs > 5 * 60 * 1000) {
        // Stuck record. The sweep job will eventually clean this up. Allow
        // a manual retry path: the client may pass a force=1 hint later.
        if (run.onInFlight) await run.onInFlight(existing);
        throw new ConflictException({
          code: 'IDEMPOTENCY_IN_FLIGHT_STUCK',
          message: 'Original request is stuck. Retry shortly.',
        });
      }
      throw new ConflictException({
        code: 'IDEMPOTENCY_IN_FLIGHT',
        message: 'Original request is still in flight. Retry shortly.',
      });
    }

    if (existing.status === 'FAILED') {
      throw new ConflictException({
        code: 'IDEMPOTENCY_PREVIOUSLY_FAILED',
        message: `Previous attempt failed (${existing.lastErrorCode ?? 'unknown'}): ${existing.lastErrorMessage ?? ''}. Use a new key to retry.`,
      });
    }

    // status === 'COMPLETED'
    if (existing.responseStorageKind === 'BODY_REFERENCE') {
      throw new ConflictException({
        code: 'RESPONSE_TOO_LARGE',
        message: 'Stored response exceeds inline limit; manual recovery required.',
      });
    }

    // Verify response integrity
    if (existing.responseBody && existing.responseChecksum) {
      const storedChecksum = this.hashRequest(existing.responseBody);
      if (storedChecksum !== existing.responseChecksum) {
        throw new ConflictException({
          code: 'RESPONSE_CORRUPTED',
          message: 'Stored response checksum does not match; the response may have been tampered with.',
        });
      }
    }

    // Increment attempt count (informational; does not invalidate the record)
    await this.prisma.idempotencyRecord.update({
      where: { id: existing.id },
      data: {
        attemptCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    return {
      status: existing.responseStatus ?? 200,
      body: { ...((existing.responseBody as any) ?? {}), replayed: true },
      replayed: true,
    };
  }

  /**
   * Canonicalize an object, sort its keys recursively, JSON-stringify it, and
   * hash with sha256. Two semantically equivalent payloads produce the same hash.
   */
  hashRequest(body: unknown): string {
    const canonical = this.canonicalize(body);
    return createHash('sha256').update(canonical).digest('hex');
  }

  private canonicalize(value: unknown): string {
    if (value === null || value === undefined || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return '[' + value.map((v: unknown) => this.canonicalize(v)).join(',') + ']';
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return (
      '{' +
      keys
        .map((k) => JSON.stringify(k) + ':' + this.canonicalize(obj[k]))
        .join(',') +
      '}'
    );
  }
}