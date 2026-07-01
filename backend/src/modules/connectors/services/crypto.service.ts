import { Injectable, Logger } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16; // authentication tag
const SALT = 'neurecore-oauth-salt-v1'; // static salt for key derivation; rotate with key version

/**
 * CryptoService — Phase 4.6
 *
 * Provides AES-256-GCM encrypt/decrypt for sensitive values (OAuth tokens, secrets).
 * Replaces the insecure base64 placeholder used during scaffolding.
 *
 * SRP:  Only handles symmetric encryption — key storage/rotation is external.
 * OCP:  Add new algorithms by subclassing or adding methods; don't touch encrypt/decrypt.
 *
 * Key source (priority order):
 *  1. ENCRYPTION_KEY env var (hex-encoded 32-byte key)
 *  2. APP_SECRET env var (derived via scrypt)
 *  3. Development fallback (NOT SAFE FOR PRODUCTION — logged as warning)
 *
 * Output format: <iv_hex>:<tag_hex>:<ciphertext_hex>
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer;

  constructor() {
    const hexKey = process.env['ENCRYPTION_KEY'];
    const appSecret = process.env['APP_SECRET'];

    if (hexKey) {
      this.key = Buffer.from(hexKey, 'hex');
    } else if (appSecret) {
      this.key = scryptSync(appSecret, SALT, 32) as Buffer;
    } else {
      this.logger.warn(
        'ENCRYPTION_KEY and APP_SECRET are not set — using insecure dev key. SET THIS IN PRODUCTION.',
      );
      this.key = scryptSync('dev-insecure-key', SALT, 32) as Buffer;
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: TAG_LENGTH,
    });
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format — expected <iv>:<tag>:<data>');
    }
    const [ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv, {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(tag);
    return decipher.update(data).toString('utf8') + decipher.final('utf8');
  }

  /** Returns true if the value looks like an encrypted ciphertext (iv:tag:data) */
  isEncrypted(value: string): boolean {
    return value.split(':').length === 3;
  }
}
