/**
 * PackValidator — pre-flight checks before install/uninstall.
 *
 * Phase 7, Task 7.6 (per `EAOS-implementation-roadmap.md` §11 +
 * `EAOS-implementation-plan.md` §9.8).
 *
 * Performs:
 *   - Tier check (`canInstallPack` per `EAOS-implementation-plan.md` §9.8)
 *   - Dependency check (every `requiresPacks` slug must be installed already)
 *   - Conflict check (no pack in `conflictsWith` may already be installed)
 *   - Lifecycle check (pack must be published: `status` ∈ {stable, beta})
 *   - Idempotency check (already-installed → still allowed for re-install of same version)
 *
 * Each check returns zero-or-more `PackValidationFailure`s so the caller
 * can surface *every* problem to the user in one pass (better UX than
 * failing on the first error).
 *
 * SOLID:
 *  - SRP — this file owns ONLY validation logic. No DB writes, no installs.
 *  - OCP — new check types can be added without modifying existing checks.
 *  - DIP — depends on Prisma + the tenant context abstraction, not concrete
 *    controller objects.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  PackTierRequired,
  PackValidationFailure,
  SolutionPack,
  TenantInstalledPack,
} from '../interfaces/solution-pack.interface';
import { tierMeetsPackRequirement } from '../interfaces/solution-pack.interface';

export interface PackValidationInput {
  pack: SolutionPack;
  /** All currently-installed packs for the tenant (active = not uninstalled). */
  tenantInstallations: TenantInstalledPack[];
  /** The tenant's tier slug. */
  tenantTier: PackTierRequired;
}

export interface PackValidationResult {
  /** True when no blocker failures (warnings allowed). */
  canInstall: boolean;
  /** All failures collected across every check. */
  failures: PackValidationFailure[];
  /** True when an existing install with the same version was found. */
  alreadyInstalledSameVersion: boolean;
}

@Injectable()
export class PackValidator {
  private readonly logger = new Logger(PackValidator.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Run every pre-flight check. Returns a structured result; never throws.
   */
  validate(input: PackValidationInput): PackValidationResult {
    const failures: PackValidationFailure[] = [];

    // 1. Lifecycle: pack must be published.
    if (input.pack.status === 'draft' || input.pack.status === 'deprecated') {
      failures.push({
        code: 'PACK_NOT_PUBLISHED',
        message:
          input.pack.status === 'draft'
            ? `Pack "${input.pack.slug}" is still a draft and cannot be installed.`
            : `Pack "${input.pack.slug}" is deprecated and can no longer be installed.`,
      });
    }

    // 2. Tier check.
    if (!tierMeetsPackRequirement(input.tenantTier, input.pack.tierRequired)) {
      failures.push({
        code: 'TIER_INSUFFICIENT',
        message:
          `Pack "${input.pack.slug}" requires the ${input.pack.tierRequired} tier. ` +
          `Your tenant is on ${input.tenantTier}. Upgrade to install.`,
        tenantTier: input.tenantTier,
        requiredTier: input.pack.tierRequired,
      });
    }

    // 3. Dependency check.
    const installedSlugs = new Set(
      input.tenantInstallations
        .filter((i) => !i.uninstalledAt)
        .map((i) => i.packSlug),
    );
    for (const dep of input.pack.requiresPacks) {
      if (!installedSlugs.has(dep)) {
        failures.push({
          code: 'DEPENDENCY_MISSING',
          message: `Pack "${input.pack.slug}" requires "${dep}" to be installed first.`,
          relatedPackSlug: dep,
        });
      }
    }

    // 4. Conflict check.
    for (const conflict of input.pack.conflictsWith) {
      if (installedSlugs.has(conflict)) {
        failures.push({
          code: 'CONFLICT',
          message:
            `Pack "${input.pack.slug}" conflicts with installed pack "${conflict}". ` +
            `Uninstall "${conflict}" before installing "${input.pack.slug}".`,
          relatedPackSlug: conflict,
        });
      }
    }

    // 5. Idempotency: already installed?
    const sameVersion = input.tenantInstallations.find(
      (i) => i.packSlug === input.pack.slug && !i.uninstalledAt,
    );
    const alreadyInstalledSameVersion = Boolean(
      sameVersion && sameVersion.packVersion === input.pack.version,
    );

    // canInstall = no *blocker* failures. (Already-installed is NOT a blocker
    // for re-install of the same version — that's an idempotent no-op.)
    const blockerFailures = failures.filter(
      (f) => f.code !== 'ALREADY_INSTALLED',
    );
    const canInstall = blockerFailures.length === 0;

    if (this.logger) {
      this.logger.debug(
        `PackValidator: pack=${input.pack.slug} canInstall=${canInstall} failures=${failures.length}`,
      );
    }

    return {
      canInstall,
      failures,
      alreadyInstalledSameVersion,
    };
  }

  /**
   * Helper used by `SolutionPacksService.install()` — performs validation
   * for a single (tenant, pack-slug) pair against fresh DB state.
   */
  async validateForInstall(args: {
    packSlug: string;
    tenantTier: PackTierRequired;
    tenantId: string;
  }): Promise<PackValidationResult> {
    const tenantId = args.tenantId;

    const pack = await this.prisma.solutionPack.findUnique({
      where: { slug: args.packSlug },
    });

    if (!pack) {
      return {
        canInstall: false,
        failures: [
          {
            code: 'PACK_NOT_FOUND',
            message: `Pack "${args.packSlug}" does not exist.`,
          },
        ],
        alreadyInstalledSameVersion: false,
      };
    }

    const tenantInstallations = await this.prisma.tenantInstalledPack.findMany({
      where: { tenantId, uninstalledAt: null },
    });

    return this.validate({
      pack: pack as unknown as SolutionPack,
      tenantInstallations:
        tenantInstallations as unknown as TenantInstalledPack[],
      tenantTier: args.tenantTier,
    });
  }
}
