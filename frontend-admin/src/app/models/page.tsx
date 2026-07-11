'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * @deprecated Per ai-gateway-imp-plan.md §7.4: this page is a
 * deprecated redirect to /admin/models. The legacy read-only tester
 * has been replaced by the new SuperAdmin catalog management UI
 * (providers, models, per-tenant overrides, health, cost summary).
 */
export default function ModelsLegacyPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/models');
  }, [router]);
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-500 text-sm">
      Redirecting to /admin/models…
    </div>
  );
}
