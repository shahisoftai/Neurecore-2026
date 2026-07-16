// Admin Brevo dashboard types (frontend). Mirrors backend response shapes.
//
// Backend source:
//   src/modules/integrations/brevo/admin-brevo.service.ts

export type BrevoTenantStatus = 'CONNECTED' | 'MASTER' | 'NOT_CONNECTED';
export type BrevoApiKeySource = 'tenant' | 'master' | 'none';

export type BrevoWebhookEventType =
  | 'DELIVERED'
  | 'OPEN'
  | 'CLICK'
  | 'BOUNCE_HARD'
  | 'BOUNCE_SOFT'
  | 'SPAM'
  | 'UNSUBSCRIBE'
  | 'BLOCKED'
  | 'ERROR'
  | 'REQUEST';

export interface AdminBrevoTenantRow {
  tenantId: string;
  tenantName: string;
  status: BrevoTenantStatus;
  source: BrevoApiKeySource;
  brevoSenderEmail: string | null;
  brevoSenderName: string | null;
  brevoReplyToEmail: string | null;
  hasMasterKey: boolean;
  sentToday: number;
  dailyLimit: number;
  remainingToday: number;
  isAtWarning: boolean;
  isAtLimit: boolean;
  credentialCreatedAt: string | null;
  credentialLastUpdatedAt: string | null;
}

export interface AdminBrevoPlatformStats {
  totalTenants: number;
  tenantsConnected: number;
  tenantsUsingMasterKey: number;
  tenantsNotRouted: number;
  totalSentToday: number;
  totalSentLast30Days: number;
  globalDailyLimit: number;
  masterKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  globalFromAddress: string;
  globalFromName: string;
  globalReplyTo: string | null;
  tenantLimits: Record<string, number>;
  suppressions: {
    total: number;
    byReason: Record<BrevoSuppressionReason, number>;
  };
}

export interface AdminBrevoUsagePoint {
  date: string; // YYYY-MM-DD
  total: number;
  byTenant: Record<string, number>;
}

export interface AdminBrevoWebhookEvent {
  id: string;
  tenantId: string | null;
  eventType: BrevoWebhookEventType;
  email: string;
  messageId: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
  receivedAt: string;
}

export interface AdminBrevoHealth {
  ok: boolean;
  source: BrevoApiKeySource;
  account?: Record<string, unknown>;
  error?: string;
  webhook: {
    secretConfigured: boolean;
    endpoint: string;
  };
  fetchedAt: string;
}

export interface AdminBrevoDisconnectResult {
  tenantId: string;
  revoked: true;
  hadCredential: boolean;
  hadSenderIdentity: boolean;
}

export interface AdminBrevoResetQuotaResult {
  tenantId: string;
  reset: boolean;
  previousCount: number;
}

export interface AdminBrevoEventsResponse {
  rows: AdminBrevoWebhookEvent[];
  total: number;
}

export type BrevoSuppressionReason =
  | "BOUNCE_HARD"
  | "UNSUBSCRIBE"
  | "ADMIN_BLOCK"
  | "SPAM_COMPLAINT"
  | "MANUAL";

export interface AdminBrevoSuppressionRow {
  id: string;
  tenantId: string | null;
  email: string;
  reason: BrevoSuppressionReason;
  details: Record<string, unknown>;
  addedBy: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminBrevoSuppressionListResponse {
  rows: AdminBrevoSuppressionRow[];
  total: number;
}

export interface AdminBrevoSuppressionAggregate {
  total: number;
  byReason: Record<BrevoSuppressionReason, number>;
  byTenant: Array<{ tenantId: string | null; count: number }>;
}

export const BREVO_SUPPRESSION_REASONS: BrevoSuppressionReason[] = [
  "BOUNCE_HARD",
  "UNSUBSCRIBE",
  "ADMIN_BLOCK",
  "SPAM_COMPLAINT",
  "MANUAL",
];
