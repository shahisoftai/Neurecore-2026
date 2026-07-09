// storage/storage.interface.ts — DIP: UploadsService depends on this abstract
// class (used both as a type AND as a Nest DI token). Concrete impls (local
// disk, S3, GCS) extend this class and live in their own files.
//
// Why abstract class instead of TS interface + Symbol token?
//   - Nest's `emitDecoratorMetadata` requires runtime types on decorated
//     constructor params. A TS interface gets erased at compile time and
//     breaks the @Inject() decorator. An abstract class is both a type and a
//     runtime value, so it works as a DI token without extra ceremony.
//   - The DI swap point is still a single line in UploadsModule.

export abstract class IUploadStorage {
  /**
   * Persist a buffer under `key`, return its public URL.
   * Implementations MUST validate content type and size defensively.
   */
  abstract put(
    tenantId: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<UploadResult>;

  /** Delete by key. Idempotent — missing keys should NOT throw. */
  abstract delete(key: string): Promise<void>;
}

export interface UploadResult {
  /** Public URL where the uploaded file can be fetched. */
  url: string;
  /** Storage key (path inside the bucket, or S3 object key). */
  key: string;
  /** Detected MIME type — server-side sniffed, not trusted from client. */
  contentType: string;
  /** Size in bytes (post-validation). */
  size: number;
}

/**
 * Logo upload constraints. Keep these in one place so frontend preview + backend
 * validation can reference the same numbers.
 */
export const LOGO_UPLOAD = {
  /** Allowed MIME types. PNG / JPEG / WEBP / SVG. */
  allowedTypes: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
  ] as const,
  /** Hard limit 5 MB — anything larger is rejected before buffering. */
  maxBytes: 5 * 1024 * 1024,
  /** Storage prefix. */
  prefix: 'logos',
} as const;

/**
 * Agent avatar upload constraints. Same image set as logos (PNG/JPEG/WEBP/SVG),
 * but tighter size limit since avatars are rendered at small sizes and a 5 MB
 * avatar would slow every page that lists agents.
 */
export const AGENT_AVATAR_UPLOAD = {
  allowedTypes: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
  ] as const,
  maxBytes: 2 * 1024 * 1024,
  prefix: 'agent-avatars',
} as const;

/**
 * Client document upload constraints for the portal.
 * Allows common document formats with a 20 MB limit.
 */
export const DOCUMENT_UPLOAD = {
  allowedTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ] as const,
  maxBytes: 20 * 1024 * 1024,
  prefix: 'portal-documents',
} as const;
