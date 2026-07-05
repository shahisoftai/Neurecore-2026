// uploads.service.ts — Single-purpose wrapper around IUploadStorage.
// Responsibilities:
//   1. Validate MIME type and size BEFORE hitting the storage layer.
//   2. Sniff the actual content type via the first bytes (defence against
//      spoofed Content-Type headers).
//   3. Mint the storage key using the configured prefix + tenantId.
//   4. Wire future S3 swap by only depending on IUploadStorage.
//
// SRP: validation lives here. Storage mechanics live in the impl.
// OCP: new file kinds (e.g. avatars, documents) get a new public method that
//      re-uses the same machinery — no edits to IUploadStorage.

import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  IUploadStorage,
  LOGO_UPLOAD,
  UploadResult,
} from './storage/storage.interface';

/**
 * Minimal in-process content-type sniffer for the four allowed image formats.
 * Each branch returns the canonical MIME type. Anything else returns null
 * and the caller rejects the upload.
 *
 * For production, swap to the `file-type` npm package — kept inline here to
 * avoid adding a dep just for four signatures.
 */
function sniffImageType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // WEBP: RIFF .... WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  // SVG: starts with `<svg` or `<?xml` followed by `<svg` (we accept both,
  // but only after sniffing because SVG is text and trivially spoofed;
  // additionally we cap it with size to limit SVG-bomb attacks).
  const head = buf.slice(0, 256).toString('utf8').trim().toLowerCase();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) {
    return 'image/svg+xml';
  }
  return null;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly storage: IUploadStorage) {}

  /**
   * Validate + persist a logo upload for `tenantId`. Returns the public URL.
   * Throws BadRequestException on type rejection, PayloadTooLargeException on
   * size rejection.
   */
  async uploadLogo(
    tenantId: string,
    buffer: Buffer,
    declaredType: string | undefined,
  ): Promise<UploadResult> {
    if (buffer.length > LOGO_UPLOAD.maxBytes) {
      throw new PayloadTooLargeException(
        `Logo exceeds ${LOGO_UPLOAD.maxBytes / (1024 * 1024)} MB limit`,
      );
    }
    const sniffed = sniffImageType(buffer);
    if (!sniffed) {
      throw new BadRequestException(
        'Unsupported image type. Allowed: PNG, JPEG, WEBP, SVG.',
      );
    }
    // If the client declared a type, prefer it but require it to match a
    // sniffed signature from our allow-list. Spoofed headers are rejected.
    if (
      declaredType &&
      declaredType !== sniffed &&
      !(declaredType === 'image/svg+xml' && sniffed === 'image/svg+xml')
    ) {
      throw new BadRequestException(
        `Declared Content-Type (${declaredType}) does not match file signature (${sniffed}).`,
      );
    }
    const result = await this.storage.put(
      tenantId,
      LOGO_UPLOAD.prefix,
      buffer,
      sniffed,
    );
    this.logger.log(
      `Logo uploaded for tenant ${tenantId}: ${result.key} (${result.size}B, ${sniffed})`,
    );
    return result;
  }

  async deleteLogo(key: string): Promise<void> {
    await this.storage.delete(key);
    this.logger.log(`Logo deleted: ${key}`);
  }
}
