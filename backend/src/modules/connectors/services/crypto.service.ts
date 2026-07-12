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
    const hexKey = process.env['ENCRYPTION_KEY'] || process.env['GOOGLE_TOKEN_ENCRYPTION_KEY'];
    const appSecret = process.env['APP_SECRET'];
    const devFallback = scryptSync('dev-insecure-key', SALT, 32) as Buffer;

    if (hexKey) {
      this.key = Buffer.from(hexKey, 'hex');
      this.logger.log(`Using explicit encryption key (${hexKey.substring(0, 8)}...)`);
    } else if (appSecret) {
      this.key = scryptSync(appSecret, SALT, 32) as Buffer;
      this.logger.log('Using APP_SECRET derived key');
    } else {
      this.logger.warn(
        'ENCRYPTION_KEY and APP_SECRET are not set — using insecure dev key. SET THIS IN PRODUCTION.',
      );
      this.key = devFallback;
    }

    // Try decrypt with dev fallback if explicit key fails (backward compat)
    // This allows transitioning from dev-fallback to explicit key without
    // invalidating existing encrypted credentials.
    if (hexKey) {
      this._devFallback = devFallback;
    }
  }

  private _devFallback: Buffer | null = null;

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

    const tryDecrypt = (key: Buffer): string => {
      const decipher = createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: TAG_LENGTH,
      });
      decipher.setAuthTag(tag);
      return decipher.update(data).toString('utf8') + decipher.final('utf8');
    };

    try {
      return tryDecrypt(this.key);
    } catch {
      if (this._devFallback) {
        try {
          return tryDecrypt(this._devFallback);
        } catch {
          throw new Error('Decryption failed with all available keys');
        }
      }
      throw new Error('Decryption failed');
    }
  }

  /** Returns true if the value looks like an encrypted ciphertext (iv:tag:data) */
  isEncrypted(value: string): boolean {
    return value.split(':').length === 3;
  }
}
