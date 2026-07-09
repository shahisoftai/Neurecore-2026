export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
  meta: { timestamp: string; requestId: string };
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface TenantTier {
  id: string;
  slug: string;
  name: string;
  description?: string;
  isActive?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  monthlyPrice?: number | string;
  yearlyPrice?: number | string;
  currency?: string;
  maxUsers: number;
  maxAgents: number;
  maxDepartments: number;
  maxStorageGB?: number;
  maxApiCalls?: number;
  maxConversationMessages?: number;
  maxFileSizeMB?: number;
  allowCustomBranding?: boolean;
  allowApiAccess?: boolean;
  allowSso?: boolean;
  allowAuditExport?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantAddress {
  street?: string;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  /** @deprecated use `tier.slug` (Phase 6) — kept for legacy admin UI. */
  plan?: string;
  /** @deprecated use `tier.maxAgents` (Phase 6) — kept for legacy admin UI. */
  agentLimit?: number;
  status: string;
  /** Phase 6 billing-tier rollup; preferred over `plan` / `agentLimit`. */
  tier?: TenantTier;
  createdAt: string;

  // Branding / Contact
  logoUrl?: string | null;
  website?: string | null;
  industry?: string | null;
  phone?: string | null;
  supportEmail?: string | null;

  // Company Profile
  sizeBucket?: string | null;
  foundedYear?: number | null;
  businessType?: string | null;
  addressJson?: TenantAddress | null;
  billingProfileJson?: Record<string, unknown> | null;
  defaultsJson?: Record<string, unknown> | null;

  // Localization
  locale?: string | null;
  timezone?: string | null;
  currency?: string | null;
  dateFormat?: string | null;
  timeFormat?: string | null;
  fiscalYearStart?: string | null;

  // Onboarding state
  onboardingCompletedAt?: string | null;
  onboardingStep?: string | null;
  checklistDismissedAt?: string | null;

  // Google Workspace
  googleDriveRootFolderId?: string | null;
  googleCalendarId?: string | null;

  // Retention
  retentionDays?: number;

  // Flexible blobs
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;

  // Timestamps
  updatedAt: string;
}
