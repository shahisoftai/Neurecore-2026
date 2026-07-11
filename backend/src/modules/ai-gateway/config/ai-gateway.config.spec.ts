/**
 * AI Gateway config — Zod parsing
 */

import { readAiGatewayConfig } from './ai-gateway.config';

describe('readAiGatewayConfig', () => {
  it('returns defaults when env is empty', () => {
    const cfg = readAiGatewayConfig({});
    expect(cfg.AI_GATEWAY_V2).toBe(false);
    expect(cfg.AI_CACHE_TTL_SECONDS).toBe(60);
    expect(cfg.AI_CIRCUIT_THRESHOLD).toBe(5);
    expect(cfg.AI_CIRCUIT_COOLDOWN_SECONDS).toBe(60);
    expect(cfg.AI_CIRCUIT_WINDOW_SECONDS).toBe(30);
    expect(cfg.AI_DEFAULT_TEMPERATURE).toBe(0.3);
    expect(cfg.AI_DEFAULT_TIMEOUT_MS).toBe(60_000);
  });

  it('parses string booleans and numbers', () => {
    const cfg = readAiGatewayConfig({
      AI_GATEWAY_V2: 'true',
      AI_CACHE_TTL_SECONDS: '120',
      AI_DEFAULT_TEMPERATURE: '0.7',
    });
    expect(cfg.AI_GATEWAY_V2).toBe(true);
    expect(cfg.AI_CACHE_TTL_SECONDS).toBe(120);
    expect(cfg.AI_DEFAULT_TEMPERATURE).toBe(0.7);
  });

  it('rejects out-of-range temperature', () => {
    expect(() =>
      readAiGatewayConfig({ AI_DEFAULT_TEMPERATURE: '3.5' }),
    ).toThrow();
  });

  it('ignores unknown keys', () => {
    const cfg = readAiGatewayConfig({ SOMETHING_ELSE: 'x' });
    expect(cfg.AI_GATEWAY_V2).toBe(false);
  });
});
