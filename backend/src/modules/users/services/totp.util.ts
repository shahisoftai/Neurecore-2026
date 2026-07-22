/**
 * totp.util.ts — RFC 6238 Time-based One-Time Password.
 *
 * Lightweight implementation that does not require an external library.
 * Only depends on Node.js `crypto` (HMAC-SHA1).
 *
 * Used by the 2FA wizard — generates a secret, computes the current TOTP,
 * and verifies a user-provided code within a tolerance window.
 *
 * Storage: we store the *base32-encoded secret* under User.metadata.twoFactorSecret.
 * Verification: we recompute TOTP from the secret and compare in constant time.
 *
 * SECURITY:
 * - The secret is generated via crypto.randomBytes (CSPRNG).
 * - We do constant-time string comparison (`timingSafeEqual`).
 * - The window defaults to ±1 step (30s each) — i.e. validates the previous,
 *   current, and next code.
 * - Server clock drift is not corrected; production deployments should
 *   sync clocks (NTP) and may extend the window to ±2 if needed.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6238
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1; // ±1 step

/**
 * Convert an arbitrary byte buffer into RFC 4648 base32 (uppercase, no padding).
 */
function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

/**
 * Decode an RFC 4648 base32 string into bytes.
 * Tolerant of lowercase + spaces/dashes (e.g. otpauth:// URIs, copied paste).
 */
function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateCounter(step: number): Buffer {
  const counter = Math.floor(step);
  const buf = Buffer.alloc(8);
  // Big-endian 64-bit counter (RFC 6238 §5.1)
  buf.writeBigUInt64BE(BigInt(counter), 0);
  return buf;
}

/**
 * Compute the TOTP code for `secret` at `now` (defaults to current time).
 * Returns a zero-padded 6-digit string.
 */
export function totpAt(secretBase32: string, now: Date = new Date()): string {
  const secretBytes = base32Decode(secretBase32);
  const step = Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  const counterBytes = generateCounter(step);
  const hmac = createHmac('sha1', secretBytes).update(counterBytes).digest();
  // RFC 6238 §5.3 dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const truncated =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = truncated % 10 ** TOTP_DIGITS;
  return code.toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Verify a 6-digit code against the secret, with ±`window` step tolerance.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  now: Date = new Date(),
  window: number = TOTP_WINDOW,
): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const currentStep = Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS);
  for (let offset = -window; offset <= window; offset++) {
    const candidate = totpAt(
      secretBase32,
      new Date((currentStep + offset) * TOTP_PERIOD_SECONDS * 1000),
    );
    const a = Buffer.from(candidate);
    const b = Buffer.from(code);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Generate a fresh base32 TOTP secret (160 bits / 32 chars). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Build an otpauth:// URI suitable for a QR-code generator. */
export function buildOtpauthUri(opts: {
  issuer: string;
  accountName: string;
  secretBase32: string;
}): string {
  const label = `${encodeURIComponent(opts.issuer)}:${encodeURIComponent(opts.accountName)}`;
  return (
    `otpauth://totp/${label}?issuer=${encodeURIComponent(opts.issuer)}` +
    `&secret=${opts.secretBase32}&algorithm=SHA1&digits=${TOTP_DIGITS}` +
    `&period=${TOTP_PERIOD_SECONDS}`
  );
}

/** Convenience: compute current TOTP from a base32 secret (for tests). */
export function currentTotp(secretBase32: string): string {
  return totpAt(secretBase32);
}
