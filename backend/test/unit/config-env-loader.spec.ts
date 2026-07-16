import {
  decodeBrevoMasterKey,
  validate,
} from '../../src/config/env.loader';

describe('config/env.loader', () => {
  describe('decodeBrevoMasterKey', () => {
    it('returns null for empty/null input', () => {
      expect(decodeBrevoMasterKey(undefined)).toBeNull();
      expect(decodeBrevoMasterKey(null)).toBeNull();
      expect(decodeBrevoMasterKey('')).toBeNull();
      expect(decodeBrevoMasterKey('   ')).toBeNull();
    });

    it('returns the bare key as-is', () => {
      expect(
        decodeBrevoMasterKey('xkeysib-13cdcea22bcffd99457895cb1d885312'),
      ).toBe('xkeysib-13cdcea22bcffd99457895cb1d885312');
      expect(decodeBrevoMasterKey('xsmtpsib-abc')).toBe('xsmtpsib-abc');
    });

    it('decodes base64-wrapped JSON', () => {
      const raw = Buffer.from(
        JSON.stringify({ api_key: 'xkeysib-abc123' }),
      ).toString('base64');
      expect(decodeBrevoMasterKey(raw)).toBe('xkeysib-abc123');
    });

    it('accepts alternate apiKey casing', () => {
      const raw = Buffer.from(
        JSON.stringify({ apiKey: 'xkeysib-camel' }),
      ).toString('base64');
      expect(decodeBrevoMasterKey(raw)).toBe('xkeysib-camel');
    });

    it('returns null for garbage base64', () => {
      expect(decodeBrevoMasterKey('!!!not-base64!!!')).toBeNull();
    });

    it('returns null when JSON does not contain an api_key', () => {
      const raw = Buffer.from(JSON.stringify({ foo: 'bar' })).toString(
        'base64',
      );
      expect(decodeBrevoMasterKey(raw)).toBeNull();
    });
  });

  describe('validate()', () => {
    it('decodes BREVO_API into BREVO_MASTER_API_KEY when only legacy form is provided', () => {
      const apiKey = 'xkeysib-from-legacy';
      const b64 = Buffer.from(JSON.stringify({ api_key: apiKey })).toString(
        'base64',
      );
      const out = validate({
        NODE_ENV: 'test',
        BREVO_API: b64,
      }) as Record<string, unknown>;
      expect(out.BREVO_MASTER_API_KEY).toBe(apiKey);
    });

    it('prefers explicit BREVO_MASTER_API_KEY over BREVO_API', () => {
      const b64 = Buffer.from(
        JSON.stringify({ api_key: 'xkeysib-legacy' }),
      ).toString('base64');
      const out = validate({
        NODE_ENV: 'test',
        BREVO_MASTER_API_KEY: 'xkeysib-explicit',
        BREVO_API: b64,
      }) as Record<string, unknown>;
      expect(out.BREVO_MASTER_API_KEY).toBe('xkeysib-explicit');
    });

    it('leaves BREVO_MASTER_API_KEY unset when neither env present', () => {
      const out = validate({ NODE_ENV: 'test' }) as Record<string, unknown>;
      expect(out.BREVO_MASTER_API_KEY).toBeUndefined();
    });

    it('provides default PORT and NODE_ENV', () => {
      const out = validate({}) as Record<string, unknown>;
      expect(out.PORT).toBe(3000);
      expect(out.NODE_ENV).toBe('development');
    });

    it('treats empty strings as undefined', () => {
      const out = validate({ FOO: '', BAR: 'baz' }) as Record<string, unknown>;
      expect(out.FOO).toBeUndefined();
      expect(out.BAR).toBe('baz');
    });
  });
});
