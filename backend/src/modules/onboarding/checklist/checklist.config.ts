// checklist.config.ts — Single source of truth for the 11 progressive
// onboarding wizards. Adding a new wizard = adding one entry here.
//
// Each entry maps to a sub-route under `/settings/wizard/[slug]`, an
// OnboardingChecklistEntry row seeded per-tenant, and a MissionFeedItem
// surfaced in the "Things to do" panel.

export type WizardPriority = 'HIGH' | 'MEDIUM' | 'LOW';

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
}

/**
 * Canonical ordering of the 11 sub-wizards. Order is intentional — the first
 * three are blocking for production-grade tenant setup (billing + tax + AI key).
 */
export const WIZARD_CONFIGS: readonly WizardConfig[] = [
  {
    slug: 'company',
    title: 'Company Profile',
    description: 'Add your website, address, industry, and size.',
    estimatedValue: 'Personalize your portal',
    estimatedMinutes: 3,
    priority: 'HIGH',
    skippable: true,
  },
  {
    slug: 'localization',
    title: 'Localization & Currency',
    description: 'Set timezone, locale, currency, and date format.',
    estimatedValue: 'Show dates and money correctly',
    estimatedMinutes: 2,
    priority: 'HIGH',
    skippable: true,
  },
  {
    slug: 'billing',
    title: 'Billing Profile',
    description:
      'Tax ID, billing contact, payment method, and invoice cadence.',
    estimatedValue: 'Get invoices paid on time',
    estimatedMinutes: 4,
    priority: 'MEDIUM',
    skippable: true,
  },
  {
    slug: 'profile',
    title: 'Your Profile',
    description: 'Avatar, phone, job title, and personal timezone.',
    estimatedValue: 'Make NeureCore feel like yours',
    estimatedMinutes: 2,
    priority: 'MEDIUM',
    skippable: true,
  },
  {
    slug: 'preferences',
    title: 'Notifications & UX',
    description: 'Digest cadence, quiet hours, theme, default landing.',
    estimatedValue: 'Less noise, more focus',
    estimatedMinutes: 2,
    priority: 'LOW',
    skippable: true,
  },
  {
    slug: 'security',
    title: 'Security',
    description: 'Verify email, enable 2FA, configure session timeout.',
    estimatedValue: 'Protect your account',
    estimatedMinutes: 3,
    priority: 'MEDIUM',
    skippable: false,
  },
  {
    slug: 'ai-ops',
    title: 'AI & Operations',
    description:
      'Default AI provider, model, per-agent budget, authority level.',
    estimatedValue: 'Control AI cost and behavior',
    estimatedMinutes: 4,
    priority: 'HIGH',
    skippable: true,
  },
  {
    slug: 'org',
    title: 'Org Placement',
    description: 'Primary department for you, per-agent department overrides.',
    estimatedValue: 'Place agents where they belong',
    estimatedMinutes: 3,
    priority: 'LOW',
    skippable: true,
  },
  {
    slug: 'integrations',
    title: 'Integrations',
    description: 'Connect Google Workspace, Slack, Microsoft 365, Brevo.',
    estimatedValue: 'Sync with your existing tools',
    estimatedMinutes: 5,
    priority: 'LOW',
    skippable: true,
  },
  {
    slug: 'compliance',
    title: 'Compliance',
    description: 'Data residency, AUP/DPA acceptance, retention policy.',
    estimatedValue: 'Meet your regulatory needs',
    estimatedMinutes: 2,
    priority: 'LOW',
    skippable: true,
  },
  {
    slug: 'team',
    title: 'Invite Team',
    description: 'Bulk-invite teammates with role assignments.',
    estimatedValue: 'Get your team on board',
    estimatedMinutes: 2,
    priority: 'MEDIUM',
    skippable: true,
  },
] as const;

export const WIZARD_SLUGS: readonly string[] = WIZARD_CONFIGS.map(
  (w) => w.slug,
);

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
