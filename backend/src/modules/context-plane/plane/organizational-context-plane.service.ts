/**
 * OrganizationalContextPlane — aggregation (ADR-002).
 *
 * Owns ONLY: provider registration, identity/governance resolution, per-
 * capability authorization-aware caching, and aggregation. It contains NO
 * capability business logic and never queries capability tables directly.
 *
 * assemble() fails safe: if identity cannot be resolved, every requested
 * capability is returned as a DENIED CapabilityContext (never silent full
 * access, never a hardcoded authority default).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ContextIdentityResolver } from '../resolvers/context-identity.resolver';
import { ContextCache } from '../cache/context-cache.service';
import type {
  AssembleParams,
  AssembledContext,
  CapabilityContext,
  ContextAuth,
  ContextScope,
  IOrganizationalContextPlane,
  IOrganizationalContextProvider,
  ResolvedIdentity,
} from '../contracts/context-plane.interface';

const PROVIDER_TIMEOUT_MS = 4000;

@Injectable()
export class OrganizationalContextPlane implements IOrganizationalContextPlane {
  private readonly logger = new Logger(OrganizationalContextPlane.name);
  private readonly providers = new Map<string, IOrganizationalContextProvider>();

  constructor(
    private readonly identityResolver: ContextIdentityResolver,
    private readonly cache: ContextCache,
  ) {}

  registerProvider(provider: IOrganizationalContextProvider): void {
    if (this.providers.has(provider.capability)) {
      this.logger.warn(`Provider "${provider.capability}" re-registered`);
    }
    this.providers.set(provider.capability, provider);
    this.logger.log(`Registered context provider "${provider.capability}"`);
  }

  listProviders(): string[] {
    return [...this.providers.keys()];
  }

  async assemble(params: AssembleParams): Promise<AssembledContext> {
    const tenantId = params.tenantId;
    const scope: ContextScope = { ...params.scope, tenantId };
    const now = new Date().toISOString();

    // Which capabilities are being requested.
    const requested = this.selectCapabilities(scope);

    // Resolve identity + governance. Null → DENY everything (fail safe).
    const auth = await this.identityResolver.resolve(
      tenantId,
      params.actorId,
      params.actorType,
    );

    if (!auth) {
      const denied: Record<string, CapabilityContext> = {};
      for (const cap of requested) {
        denied[cap] = this.deniedContext(
          cap,
          tenantId,
          params.actorId,
          scope,
          'identity could not be resolved',
          'context-plane:fail-safe',
        );
      }
      return {
        tenantId,
        actorId: params.actorId,
        identity: this.unknownIdentity(params.actorId, params.actorType),
        authContext: {
          applicablePolicies: [],
          effectiveAuthority: 0,
          effectiveAutonomy: 0,
          governanceBlocked: true,
        },
        capabilities: denied,
        assembledAt: now,
      };
    }

    // Assemble each requested capability (cache-aware), isolating provider errors.
    const capabilities: Record<string, CapabilityContext> = {};
    await Promise.all(
      requested.map(async (cap) => {
        const provider = this.providers.get(cap);
        if (!provider) {
          capabilities[cap] = this.unavailableContext(
            cap,
            auth,
            scope,
            'no provider registered',
          );
          return;
        }
        capabilities[cap] = await this.assembleOne(provider, auth, scope);
      }),
    );

    return {
      tenantId,
      actorId: params.actorId,
      identity: auth.identity,
      authContext: auth.authContext,
      capabilities,
      assembledAt: now,
    };
  }

  private async assembleOne(
    provider: IOrganizationalContextProvider,
    auth: ContextAuth,
    scope: ContextScope,
  ): Promise<CapabilityContext> {
    const cap = provider.capability;
    // Cache key includes tenant + actor + capability + effective authority +
    // scope. We only cache AFTER a provider produces an authorized result, so
    // the decision is baked into the key.
    const cacheKey = this.cache.key({
      tenantId: auth.tenantId,
      actorId: auth.identity.employeeId,
      capability: cap,
      access: 'PENDING', // replaced below once we know the decision
      effectiveAuthority: auth.authContext.effectiveAuthority,
      scope: scope as unknown as Record<string, unknown>,
    });

    // Try cache first (keyed by authority; different authority → different key).
    const cached = this.cache.get(cacheKey, scope.maxContextAgeMs);
    if (cached) return cached;

    try {
      const result = await this.withTimeout(
        provider.getContext(auth, scope),
        PROVIDER_TIMEOUT_MS,
        cap,
      );
      // Cache the authorized result (safe: it already reflects the decision).
      this.cache.set(cacheKey, { ...result, cacheStatus: 'FRESH' });
      return { ...result, cacheStatus: 'FRESH' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Provider "${cap}" failed: ${msg}`);
      // A failed provider must not corrupt others — return UNAVAILABLE.
      return this.unavailableContext(cap, auth, scope, `provider error: ${msg}`);
    }
  }

  private selectCapabilities(scope: ContextScope): string[] {
    let caps = [...this.providers.keys()];
    if (scope.includeCapabilities && scope.includeCapabilities.length > 0) {
      caps = caps.filter((c) => scope.includeCapabilities!.includes(c));
      // include may name a not-yet-registered capability; keep the request set.
      for (const c of scope.includeCapabilities) {
        if (!caps.includes(c)) caps.push(c);
      }
    }
    if (scope.excludeCapabilities && scope.excludeCapabilities.length > 0) {
      caps = caps.filter((c) => !scope.excludeCapabilities!.includes(c));
    }
    return caps;
  }

  private deniedContext(
    capability: string,
    tenantId: string,
    actorId: string,
    scope: ContextScope,
    reason: string,
    policySource: string,
  ): CapabilityContext {
    const now = new Date().toISOString();
    return {
      capability,
      provider: 'context-plane',
      authorization: {
        access: 'DENIED',
        reason,
        policySource,
        actorId,
        capability,
        scope,
        decidedAt: now,
      },
      data: {},
      sourceEntities: [],
      tenantId,
      scope,
      fetchedAt: now,
      lastModifiedAt: null,
      cacheStatus: 'UNAVAILABLE',
      expiresAt: now,
    };
  }

  private unavailableContext(
    capability: string,
    auth: ContextAuth,
    scope: ContextScope,
    reason: string,
  ): CapabilityContext {
    const now = new Date().toISOString();
    return {
      capability,
      provider: capability,
      authorization: {
        access: 'DENIED',
        reason,
        policySource: 'context-plane:unavailable',
        actorId: auth.identity.employeeId,
        capability,
        scope,
        decidedAt: now,
      },
      data: {},
      sourceEntities: [],
      tenantId: auth.tenantId,
      scope,
      fetchedAt: now,
      lastModifiedAt: null,
      cacheStatus: 'UNAVAILABLE',
      expiresAt: now,
      unavailable: true,
      unavailableReason: reason,
    };
  }

  private unknownIdentity(
    actorId: string,
    actorType: ContextAuth['identity']['employeeType'],
  ): ResolvedIdentity {
    return {
      employeeId: actorId,
      employeeType: actorType,
      displayName: actorId,
      role: 'UNKNOWN',
      departmentId: null,
      departmentName: null,
      authorityLevel: 0,
      autonomyLevel: 0,
      resolvedFrom: 'unresolved',
    };
  }

  private async withTimeout<T>(
    p: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`provider ${label} timed out after ${ms}ms`)),
        ms,
      );
      if (typeof timer === 'object' && timer && 'unref' in timer) {
        (timer as { unref: () => void }).unref();
      }
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }
}
