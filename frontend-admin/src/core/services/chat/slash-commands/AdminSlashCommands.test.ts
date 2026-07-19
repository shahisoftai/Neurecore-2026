// ─── AdminSlashCommands.test.ts ────────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { AdminSlashCommands } from '@/core/services/chat/slash-commands/AdminSlashCommands';

const sc = new AdminSlashCommands();

describe('AdminSlashCommands.getSuggestions', () => {
  it('returns matching commands by trigger prefix', () => {
    const matches = sc.getSuggestions('/t');
    const triggers = matches.map((m) => m.trigger);
    expect(triggers).toContain('/tenants');
  });

  it('returns empty for non-matching input', () => {
    expect(sc.getSuggestions('/xyz')).toEqual([]);
  });

  it('is case-insensitive', () => {
    const matches = sc.getSuggestions('/TENANTS');
    expect(matches.map((m) => m.trigger)).toContain('/tenants');
  });

  it('returns exact match for full trigger', () => {
    const matches = sc.getSuggestions('/billing');
    expect(matches).toHaveLength(1);
    expect(matches[0].context).toBe('billing');
  });

  it('supports admin-specific /feature-flags trigger', () => {
    const matches = sc.getSuggestions('/feature-flags');
    expect(matches).toHaveLength(1);
    expect(matches[0].context).toBe('system');
  });
});

describe('AdminSlashCommands.getContextForTrigger', () => {
  it('maps /agents → agent context', () => {
    expect(sc.getContextForTrigger('/agents')).toBe('agent');
  });

  it('maps /tenants → tenant context', () => {
    expect(sc.getContextForTrigger('/tenants')).toBe('tenant');
  });

  it('maps /billing → billing context', () => {
    expect(sc.getContextForTrigger('/billing')).toBe('billing');
  });

  it('maps /system + /feature-flags → system context', () => {
    expect(sc.getContextForTrigger('/system')).toBe('system');
    expect(sc.getContextForTrigger('/feature-flags')).toBe('system');
  });

  it('returns undefined for unknown trigger', () => {
    expect(sc.getContextForTrigger('/unknown')).toBeUndefined();
  });
});

describe('AdminSlashCommands.command integrity', () => {
  it('every command has a non-empty trigger, label, context, and suggestions array', () => {
    for (const c of sc.commands) {
      expect(c.trigger).toMatch(/^\//);
      expect(c.label.length).toBeGreaterThan(0);
      expect(['agent', 'task', 'workflow', 'system', 'tenant', 'billing']).toContain(c.context);
      expect(c.suggestions.length).toBeGreaterThan(0);
    }
  });
});
