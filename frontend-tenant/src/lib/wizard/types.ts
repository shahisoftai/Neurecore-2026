// types/wizard.types.ts — Shared types for the progressive onboarding wizard
// system. Mirrors `backend/src/modules/onboarding/checklist/checklist.config.ts`.
// PR-1 only includes the skeleton — wizard-specific step definitions land in PR-3.

export type WizardPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type WizardSlug =
  | 'company'
  | 'localization'
  | 'billing'
  | 'profile'
  | 'preferences'
  | 'security'
  | 'ai-ops'
  | 'org'
  | 'integrations'
  | 'compliance'
  | 'team';

export type WizardState =
  | 'PENDING'
  | 'DONE'
  | 'DISMISSED'
  | 'SKIPPED';

export type MissionFeedPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface WizardConfig {
  slug: WizardSlug;
  title: string;
  description: string;
  estimatedValue: string;
  estimatedMinutes: number;
  priority: WizardPriority;
  skippable: boolean;
}

export interface ChecklistEntryView {
  slug: WizardSlug;
  state: WizardState;
  completedAt: string | null;
  dismissedAt: string | null;
  skippedAt: string | null;
  config: WizardConfig;
  missionFeedItem: {
    id: string;
    dismissedAt: string | null;
    priority: MissionFeedPriority;
  } | null;
}

export interface ChecklistListResponse {
  entries: ChecklistEntryView[];
}

/** A single step inside a wizard. Defined per-wizard in PR-3. */
export interface WizardStepDefinition<TValues = Record<string, unknown>> {
  id: string;
  title: string;
  description?: string;
  component: React.ComponentType<{
    values: TValues;
    setValues: (patch: Partial<TValues>) => void;
  }>;
}

/**
 * WizardDefinition is the contract for a single wizard. Adding a new wizard =
 * adding one entry to wizardRegistry — nothing else changes.
 *
 * Fields filled in by PR-3: `steps`, `endpoint`, `schema`.
 */
export interface WizardDefinition<TValues = Record<string, unknown>> {
  config: WizardConfig;
  endpoint: {
    save: string;
    complete: string;
    skip?: string;
  };
  steps: WizardStepDefinition<TValues>[];
}

export const WIZARD_SLUGS: readonly WizardSlug[] = [
  'company',
  'localization',
  'billing',
  'profile',
  'preferences',
  'security',
  'ai-ops',
  'org',
  'integrations',
  'compliance',
  'team',
] as const;