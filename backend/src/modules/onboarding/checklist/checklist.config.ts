// checklist.config.ts — Single source of truth for the progressive
// onboarding wizards. Adding a new wizard = adding one entry here.
//
// Each entry maps to a sub-route under `/settings/wizard/[slug]`, an
// OnboardingChecklistEntry row seeded per-tenant, and a MissionFeedItem
// surfaced in the "Things to do" panel.
//
// Phases (0-4) drive the Setup Center grouping on the dashboard.
// Weights (1-3) drive the progress calculation.
// dependsOn defines dependency ordering for smart reordering.

export type WizardPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type WizardPhase = 0 | 1 | 2 | 3 | 4;

export interface WizardConfig {
  /** URL-safe identifier — also used as MissionFeedItem.sourceEventId suffix. */
  slug: string;
  /** Display title shown in settings list and Things-to-do panel. */
  title: string;
  /** One-sentence explanation shown to user. */
  description: string;
  /** Shown on checklist card: "Personalize your portal", etc. */
  estimatedValue: string;
  /** Approximate minutes to complete (rounded). */
  estimatedMinutes: number;
  /** Drives order and visual weight. */
  priority: WizardPriority;
  /** Whether user can skip without data loss. */
  skippable: boolean;
  /** Setup Center grouping phase (0=Foundation, 1=Communication, 2=Operations, 3=Team&Admin, 4=Polish). */
  phase: WizardPhase;
  /** Weight for progress calculation (3=HIGH, 2=MEDIUM, 1=LOW). */
  weight: 1 | 2 | 3;
  /** Slugs that must be in DONE state before this item is unlocked. */
  dependsOn: string[];
}

/**
 * Canonical ordering of the 13 sub-wizards. Order is intentional — Foundation
 * first, then Communication (vital for company working), then Operations,
 * then Team & Admin, then Polish.
 */
export const WIZARD_CONFIGS: readonly WizardConfig[] = [
  // ── Phase 0: Foundation (weight 3) ──────────────────────────────────────
  {
    slug: 'company',
    title: 'Company Profile',
    description: 'Add your website, address, industry, and size.',
    estimatedValue: 'Personalize your portal',
    estimatedMinutes: 3,
    priority: 'HIGH',
    skippable: true,
    phase: 0,
    weight: 3,
    dependsOn: [],
  },
  {
    slug: 'localization',
    title: 'Localization & Currency',
    description: 'Set timezone, locale, currency, and date format.',
    estimatedValue: 'Show dates and money correctly',
    estimatedMinutes: 2,
    priority: 'HIGH',
    skippable: true,
    phase: 0,
    weight: 3,
    dependsOn: [],
  },
  {
    slug: 'security',
    title: 'Security',
    description: 'Verify email, enable 2FA, configure session timeout.',
    estimatedValue: 'Protect your account',
    estimatedMinutes: 3,
    priority: 'MEDIUM',
    skippable: false,
    phase: 0,
    weight: 3,
    dependsOn: ['company'],
  },
  // ── Phase 1: Communication & Documents (weight 2) — vital for company working ─
  {
    slug: 'google-workspace',
    title: 'Google Workspace',
    description: 'Connect Gmail, Drive, Calendar, and Sheets for AI employees.',
    estimatedValue: 'Agents email, create docs, manage calendar',
    estimatedMinutes: 5,
    priority: 'HIGH',
    skippable: true,
    phase: 1,
    weight: 2,
    dependsOn: ['company'],
  },
  {
    slug: 'brevo',
    title: 'Brevo Email',
    description: 'Connect transactional email for notifications and alerts.',
    estimatedValue: 'Enable email delivery for AI agents',
    estimatedMinutes: 3,
    priority: 'HIGH',
    skippable: true,
    phase: 1,
    weight: 2,
    dependsOn: ['company'],
  },
  // ── Phase 2: Operations (weight 2 / 1) ──────────────────────────────────
  {
    slug: 'ai-ops',
    title: 'AI & Operations',
    description:
      'Default AI provider, model, per-agent budget, authority level.',
    estimatedValue: 'Control AI cost and behavior',
    estimatedMinutes: 4,
    priority: 'HIGH',
    skippable: true,
    phase: 2,
    weight: 2,
    dependsOn: ['company'],
  },
  {
    slug: 'integrations',
    title: 'Integrations',
    description: 'Connect Slack, Microsoft 365, and other services.',
    estimatedValue: 'Sync with your existing tools',
    estimatedMinutes: 5,
    priority: 'MEDIUM',
    skippable: true,
    phase: 2,
    weight: 1,
    dependsOn: ['company'],
  },
  // ── Phase 3: Team & Admin (weight 1) ────────────────────────────────────
  {
    slug: 'billing',
    title: 'Billing Profile',
    description:
      'Tax ID, billing contact, payment method, and invoice cadence.',
    estimatedValue: 'Get invoices paid on time',
    estimatedMinutes: 4,
    priority: 'MEDIUM',
    skippable: true,
    phase: 3,
    weight: 1,
    dependsOn: ['company'],
  },
  {
    slug: 'team',
    title: 'Invite Team',
    description: 'Bulk-invite teammates with role assignments.',
    estimatedValue: 'Get your team on board',
    estimatedMinutes: 2,
    priority: 'MEDIUM',
    skippable: true,
    phase: 3,
    weight: 1,
    dependsOn: ['company'],
  },
  {
    slug: 'profile',
    title: 'Your Profile',
    description: 'Avatar, phone, job title, and personal timezone.',
    estimatedValue: 'Make NeureCore feel like yours',
    estimatedMinutes: 2,
    priority: 'MEDIUM',
    skippable: true,
    phase: 3,
    weight: 1,
    dependsOn: [],
  },
  {
    slug: 'org',
    title: 'Org Placement',
    description: 'Primary department for you, per-agent department overrides.',
    estimatedValue: 'Place agents where they belong',
    estimatedMinutes: 3,
    priority: 'LOW',
    skippable: true,
    phase: 3,
    weight: 1,
    dependsOn: ['team'],
  },
  // ── Phase 4: Polish (weight 1) ──────────────────────────────────────────
  {
    slug: 'preferences',
    title: 'Notifications & UX',
    description: 'Digest cadence, quiet hours, theme, default landing.',
    estimatedValue: 'Less noise, more focus',
    estimatedMinutes: 2,
    priority: 'LOW',
    skippable: true,
    phase: 4,
    weight: 1,
    dependsOn: ['profile'],
  },
  {
    slug: 'compliance',
    title: 'Compliance',
    description: 'Data residency, AUP/DPA acceptance, retention policy.',
    estimatedValue: 'Meet your regulatory needs',
    estimatedMinutes: 2,
    priority: 'LOW',
    skippable: true,
    phase: 4,
    weight: 1,
    dependsOn: ['billing'],
  },
] as const;

export const WIZARD_SLUGS: readonly string[] = WIZARD_CONFIGS.map(
  (w) => w.slug,
);

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

/** O(1) lookup by slug — used by service + frontend registry. */
export const WIZARD_CONFIG_BY_SLUG: Record<string, WizardConfig> =
  Object.fromEntries(WIZARD_CONFIGS.map((w) => [w.slug, w]));

/**
 * Build the sourceEventId used for MissionFeedItem dedup.
 * Format: `onboarding:${tenantId}:${slug}` — unique per tenant per wizard.
 */
export function buildSourceEventId(tenantId: string, slug: string): string {
  return `onboarding:${tenantId}:${slug}`;
}
