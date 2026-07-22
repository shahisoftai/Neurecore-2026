// types/wizard.types.ts — Shared types for the progressive onboarding wizard
// system. Mirrors `backend/src/modules/onboarding/checklist/checklist.config.ts`.

export type WizardPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type WizardPhase = 0 | 1 | 2 | 3 | 4;

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
  | 'team'
  | 'google-workspace'
  | 'brevo';

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
  phase: WizardPhase;
  weight: 1 | 2 | 3;
  dependsOn: string[];
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

/** A single step inside a wizard. Defined per-wizard. */
export interface WizardStepDefinition<TValues = Record<string, unknown>> {
  id: string;
  title: string;
  description?: string;
  component: React.ComponentType<{
    values: TValues;
    setValues: (patch: Partial<TValues>) => void;
  }>;
}

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
  'google-workspace',
  'brevo',
] as const;

export const WIZARD_PHASES: readonly WizardPhase[] = [0, 1, 2, 3, 4];

export const PHASE_LABELS: Record<WizardPhase, string> = {
  0: 'Foundation',
  1: 'Communication & Documents',
  2: 'Operations',
  3: 'Team & Admin',
  4: 'Polish',
};

export const PHASE_DESCRIPTIONS: Record<WizardPhase, string> = {
  0: 'Essential company settings to get started',
  1: 'Connect the tools your company relies on daily',
  2: 'Configure AI behavior and third-party integrations',
  3: 'Set up billing, your team, and personal profiles',
  4: 'Fine-tune preferences and compliance',
};
