// ─── KeywordFallbackReply.test.ts ───────────────────────────────────────────────
// Verifies keyword routing and suggestion inference for offline fallback.

import { describe, expect, it } from 'vitest';
import { KeywordFallbackReply } from '@/core/services/chat/fallback/KeywordFallbackReply';

const fb = new KeywordFallbackReply();

describe('KeywordFallbackReply.generate', () => {
  it('routes revenue/sales keyword to analytics reply', () => {
    const r = fb.generate('show me revenue this quarter');
    expect(r.reply).toContain('Analytics');
  });

  it('routes agent keyword to agents-page reply', () => {
    const r = fb.generate('which agents are idle');
    expect(r.reply).toContain('Agents page');
  });

  it('routes task keyword to tasks-page reply', () => {
    const r = fb.generate('list overdue tasks');
    expect(r.reply).toContain('Tasks page');
  });

  it('routes workflow keyword to workflows-page reply', () => {
    const r = fb.generate('which workflows failed');
    expect(r.reply).toContain('Workflows page');
  });

  it('returns generic offline message for unknown keywords', () => {
    const r = fb.generate('what is the meaning of life');
    expect(r.reply).toContain('offline');
  });

  it('is case-insensitive', () => {
    const r = fb.generate('REVENUE check');
    expect(r.reply).toContain('Analytics');
  });
});

describe('KeywordFallbackReply.generateSuggestions', () => {
  it('infers agent suggestion when reply mentions agents', () => {
    expect(fb.generateSuggestions('check the agents page')).toContain('Show me all agents');
  });

  it('infers task suggestion when reply mentions tasks', () => {
    expect(fb.generateSuggestions('open tasks page')).toContain('Show pending tasks');
  });

  it('infers revenue/analytics suggestion when reply mentions revenue', () => {
    expect(fb.generateSuggestions('revenue is on analytics')).toContain('Open analytics');
  });

  it('caps suggestions at 3', () => {
    const all = fb.generateSuggestions('agents tasks revenue');
    expect(all.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array for unrelated reply', () => {
    expect(fb.generateSuggestions('just a status update')).toEqual([]);
  });
});
