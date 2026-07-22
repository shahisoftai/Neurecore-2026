'use client';

/**
 * /workspace/[feature] — dynamic stub page for any industry-specific
 * workspace route.
 *
 * INDUSTRY-SETUP-CONCEPT.md §3.1 G6 (Phase 1 G6): previously this page
 * hardcoded a parallel `FEATURE_META_MAP` that duplicated metadata already
 * defined in `industryNavigation.ts`. The bug: an Agriculture tenant
 * clicking `production` saw "Industrial & Infrastructure" labels because
 * the static map took precedence over the tenant's actual group.
 *
 * Fix (DRY — single source of truth): ALL metadata now flows through
 * <IndustryStubFromNav />, which reads from `industryNavigation.ts`.
 * The page cannot drift from the runtime IconRail — both share the
 * same `getIndustryNavConfig()` factory.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { IndustryStubFromNav } from '@/components/industry/IndustryStubPage';
import { tenantsService } from '@/services/tenants.service';

export default function DynamicWorkspacePage() {
  const params = useParams();
  const feature = params.feature as string;
  const [tenantGroup, setTenantGroup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tenantsService
      .getCurrent()
      .then((t) => {
        if (!cancelled) setTenantGroup(t.industryGroup);
      })
      .catch(() => {
        /* non-fatal — keep generic stub */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Until we know the tenant's group, pass an empty string — the
  // IndustryStubFromNav wrapper itself falls back to the FALLBACK config
  // (generic copy + humanized slug) and re-renders cleanly once the group
  // arrives. This avoids the SSR-vs-CSR flash.
  return <IndustryStubFromNav featureId={feature} industryGroup={tenantGroup ?? ''} />;
}
