// storage/local-disk.storage.ts — Default IUploadStorage impl.
// Persists under `apps/cdn/uploads/{prefix}/{tenantId}/{uuid}.{ext}`.
// Files are served by UploadsController at `GET /cdn/:tenantId/:filename`.
//
// Swap-out path: register a different IUploadStorage provider in
// UploadsModule to switch to S3 / GCS / R2 without touching UploadsService.

import { promises as fs, createWriteStream } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { IUploadStorage } from './storage.interface';
import type { UploadResult } from './storage.interface';

/**
 * Resolve the upload root once at module load.
 * - Production / Contabo: `apps/cdn/uploads/` (rsync-deployed alongside the app).
 * - Dev: same path; the directory is created on first write.
 */
const UPLOAD_ROOT = resolve(process.cwd(), 'apps', 'cdn', 'uploads');

/** Public URL prefix served by UploadsController. */
export const CDN_PUBLIC_PREFIX = '/cdn';

export class LocalDiskStorage extends IUploadStorage {
  async put(
    tenantId: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    // Defence in depth: never trust caller-supplied `key` for path traversal.
    const safeTenant = tenantId.replace(/[^a-zA-Z0-9-]/g, '');
    const safeName = `${randomBytes(16).toString('hex')}${extFor(contentType)}`;
    const relativePath = join(key, safeTenant, safeName);
    const absolutePath = join(UPLOAD_ROOT, relativePath);

    await fs.mkdir(dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);

    return {
      url: `${CDN_PUBLIC_PREFIX}/${relativePath.split('/').join('/')}`,
      key: relativePath,
      contentType,
      size: buffer.length,
    };
  }

  async delete(key: string): Promise<void> {
    const absolutePath = join(UPLOAD_ROOT, key);
    try {
      await fs.unlink(absolutePath);
    } catch (err: unknown) {
      // ENOENT = already gone — idempotent.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
}

function extFor(contentType: string): string {
  switch (contentType) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/svg+xml':
      return '.svg';
    default:
      return '.bin';
  }
}

// Re-export the write stream helper for callers that prefer streaming.
// (Not used by UploadsService today but kept here for future S3-style
//  multipart upload support without changing the interface.)
export const _internal = { createWriteStream };
