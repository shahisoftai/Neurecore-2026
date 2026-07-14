/**
 * Shared authorization helper for context providers.
 *
 * Centralizes the FULL / REDACTED / DENIED decision shape so every provider
 * produces consistent, provenance-bearing authorization decisions. The actual
 * threshold policy is capability-specific and passed in by each provider.
 */

import type {
  CapabilityContext,
  ContextAccess,
  ContextAuth,
  ContextAuthorization,
  ContextScope,
} from '../contracts/context-plane.interface';

export function decide(
  auth: ContextAuth,
  capability: string,
  scope: ContextScope,
  rule: {
    denyBelow: number; // effectiveAuthority below this → DENIED
    redactBelow: number; // below this (but >= denyBelow) → REDACTED
  },
): ContextAuthorization {
  const now = new Date().toISOString();
  const eff = auth.authContext.effectiveAuthority;
  let access: ContextAccess;
  let reason: string;
  let policySource: string;

  if (auth.authContext.governanceBlocked) {
    access = 'DENIED';
    reason = 'governance policy blocked this actor';
    policySource = 'governance:blocked';
  } else if (eff < rule.denyBelow) {
    access = 'DENIED';
    reason = `effective authority ${eff} < deny threshold ${rule.denyBelow}`;
    policySource = `context-plane:${capability}:authority`;
  } else if (eff < rule.redactBelow) {
    access = 'REDACTED';
    reason = `effective authority ${eff} < full threshold ${rule.redactBelow}`;
    policySource = `context-plane:${capability}:authority`;
  } else {
    access = 'FULL';
    reason = `effective authority ${eff} >= full threshold ${rule.redactBelow}`;
    policySource = `context-plane:${capability}:authority`;
  }

  return {
    access,
    reason,
    policySource,
    actorId: auth.identity.employeeId,
    capability,
    scope,
    decidedAt: now,
  };
}

export function buildContext(params: {
  capability: string;
  provider: string;
  auth: ContextAuth;
  scope: ContextScope;
  authorization: ContextAuthorization;
  data: Record<string, unknown>;
  sourceEntities?: Array<{ entityType: string; entityId: string }>;
  lastModifiedAt?: string | null;
  ttlMs?: number;
}): CapabilityContext {
  const now = new Date().toISOString();
  return {
    capability: params.capability,
    provider: params.provider,
    authorization: params.authorization,
    data: params.authorization.access === 'DENIED' ? {} : params.data,
    sourceEntities: params.sourceEntities ?? [],
    tenantId: params.auth.tenantId,
    scope: params.scope,
    fetchedAt: now,
    lastModifiedAt: params.lastModifiedAt ?? null,
    cacheStatus: 'FRESH',
    expiresAt: new Date(Date.now() + (params.ttlMs ?? 30_000)).toISOString(),
  };
}

export function unavailable(params: {
  capability: string;
  provider: string;
  auth: ContextAuth;
  scope: ContextScope;
  reason: string;
}): CapabilityContext {
  const now = new Date().toISOString();
  return {
    capability: params.capability,
    provider: params.provider,
    authorization: {
      access: 'DENIED',
      reason: params.reason,
      policySource: `context-plane:${params.capability}:unavailable`,
      actorId: params.auth.identity.employeeId,
      capability: params.capability,
      scope: params.scope,
      decidedAt: now,
    },
    data: {},
    sourceEntities: [],
    tenantId: params.auth.tenantId,
    scope: params.scope,
    fetchedAt: now,
    lastModifiedAt: null,
    cacheStatus: 'UNAVAILABLE',
    expiresAt: now,
    unavailable: true,
    unavailableReason: params.reason,
  };
}
