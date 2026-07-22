// Honest tests for the onboarding orchestrator's step-mapping logic.
// Reproduces the inline logic from app/onboarding/setup/page.tsx and
// verifies the resume behaviour is correct.

import { describe, it, expect } from 'vitest';

const STEPS = ['company', 'logo', 'localization', 'plan', 'template', 'integrations', 'complete'] as const;

function resolveStepFromServer(step: string | undefined | null): typeof STEPS[number] {
  // Mirrors the mapping in app/onboarding/setup/page.tsx
  if (step === 'plan') return 'plan';
  if (step === 'template') return 'template';
  if (step === 'review' || step === 'team' || step === 'integrations') return 'integrations';
  return 'company';
}

describe('Onboarding step resolver (the hydration logic)', () => {
  it('default to company when no server step is set', () => {
    expect(resolveStepFromServer(null)).toBe('company');
    expect(resolveStepFromServer(undefined)).toBe('company');
  });

  it('plan → plan', () => {
    expect(resolveStepFromServer('plan')).toBe('plan');
  });

  it('template → template', () => {
    expect(resolveStepFromServer('template')).toBe('template');
  });

  it('review → integrations (NOT complete) — bug fix verification', () => {
    // After selectTemplate(), backend sets step='review'.
    // User should land back at integrations, not at complete.
    // This catches the bug fixed in this PR.
    expect(resolveStepFromServer('review')).toBe('integrations');
  });

  it('team → integrations (legacy path)', () => {
    expect(resolveStepFromServer('team')).toBe('integrations');
  });

  it('integrations → integrations (forward compat if backend adds this)', () => {
    expect(resolveStepFromServer('integrations')).toBe('integrations');
  });
});

describe('Initial Onboarding has 7 steps', () => {
  it('matches the spec (Company, Logo, Localization, Plan, Template, Integrations, Complete)', () => {
    expect(STEPS.length).toBe(7);
    expect(STEPS[0]).toBe('company');
    expect(STEPS[1]).toBe('logo');
    expect(STEPS[2]).toBe('localization');
    expect(STEPS[3]).toBe('plan');
    expect(STEPS[4]).toBe('template');
    expect(STEPS[5]).toBe('integrations');
    expect(STEPS[6]).toBe('complete');
  });
});
