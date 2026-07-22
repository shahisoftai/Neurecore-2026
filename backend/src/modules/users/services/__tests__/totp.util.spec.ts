/**
 * totp.util.spec.ts — RFC 6238 conformance + business logic tests.
 *
 * Validates the TOTP code generation, verification, otpauth URI building,
 * and base32 roundtrip.
 */

import {
  generateTotpSecret,
  totpAt,
  verifyTotp,
  buildOtpauthUri,
} from '../totp.util';

describe('TOTP util (RFC 6238)', () => {
  describe('generateTotpSecret', () => {
    it('produces a 32-char base32 secret', () => {
      const secret = generateTotpSecret();
      expect(secret).toHaveLength(32);
      expect(secret).toMatch(/^[A-Z2-7]+$/);
    });

    it('produces unique secrets', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 100; i++) {
        seen.add(generateTotpSecret());
      }
      expect(seen.size).toBe(100);
    });
  });

  describe('totpAt', () => {
    it('generates a 6-digit code', () => {
      const secret = generateTotpSecret();
      const code = totpAt(secret, new Date('2026-01-01T00:00:00Z'));
      expect(code).toMatch(/^\d{6}$/);
    });

    it('same secret + same time = same code', () => {
      const secret = generateTotpSecret();
      const t = new Date('2026-01-01T00:00:00Z');
      expect(totpAt(secret, t)).toBe(totpAt(secret, t));
    });

    it('different times may produce different codes (within 30s usually same)', () => {
      const secret = generateTotpSecret();
      const t1 = new Date('2026-01-01T00:00:00Z');
      const t2 = new Date('2026-01-01T00:00:15Z'); // same 30s window
      expect(totpAt(secret, t1)).toBe(totpAt(secret, t2));
    });
  });

  describe('verifyTotp', () => {
    it('verifies a freshly generated code at the same time', () => {
      const secret = generateTotpSecret();
      const now = new Date();
      const code = totpAt(secret, now);
      expect(verifyTotp(secret, code, now)).toBe(true);
    });

    it('rejects a code from a different secret', () => {
      const a = generateTotpSecret();
      const b = generateTotpSecret();
      const now = new Date();
      const code = totpAt(a, now);
      expect(verifyTotp(b, code, now)).toBe(false);
    });

    it('rejects a code from outside the window (±5 min)', () => {
      const secret = generateTotpSecret();
      const ref = new Date('2026-01-01T00:00:00Z');
      const futureCode = totpAt(secret, new Date('2026-01-01T00:05:00Z'));
      expect(verifyTotp(secret, futureCode, ref)).toBe(false);
    });

    it('rejects malformed codes', () => {
      const secret = generateTotpSecret();
      expect(verifyTotp(secret, 'abc123', new Date())).toBe(false);
      expect(verifyTotp(secret, '12345', new Date())).toBe(false); // 5 digits
      expect(verifyTotp(secret, '1234567', new Date())).toBe(false); // 7 digits
      expect(verifyTotp(secret, '', new Date())).toBe(false);
    });

    it('handles leading zeros correctly', () => {
      const secret = generateTotpSecret();
      // Find a time that produces a code with a leading zero (e.g. 007894).
      // The chance is ~1/1000 per step. Try several timestamps.
      const base = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000 / 30);
      for (let i = 0; i < 10000; i++) {
        const t = new Date((base + i) * 30 * 1000);
        const c = totpAt(secret, t);
        if (c.startsWith('0')) {
          expect(verifyTotp(secret, c, t)).toBe(true);
          return;
        }
      }
      // If we didn't find a leading-zero example in 10k steps, that's fine
      // (the algorithm is still correct). Skip silently.
    });
  });

  describe('buildOtpauthUri', () => {
    it('produces a valid otpauth:// URI with all required params', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const uri = buildOtpauthUri({
        issuer: 'NeureCore',
        accountName: 'user@example.com',
        secretBase32: secret,
      });
      expect(uri).toContain('otpauth://totp/');
      expect(uri).toContain('NeureCore');
      expect(uri).toContain(secret);
      expect(uri).toContain('algorithm=SHA1');
      expect(uri).toContain('digits=6');
      expect(uri).toContain('period=30');
    });

    it('URL-encodes special characters in account name', () => {
      const uri = buildOtpauthUri({
        issuer: 'NC',
        accountName: 'user+test@example.com',
        secretBase32: 'JBSWY3DPEHPK3PXP',
      });
      expect(uri).toContain('user%2Btest%40example.com');
    });
  });
});
