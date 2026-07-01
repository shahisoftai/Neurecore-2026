'use client';

import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import dynamic from 'next/dynamic';

// D3/visx uses browser APIs — SSR-disabled
const BrainMapCanvas = dynamic(() => import('@/components/brain-map/BrainMapCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
      Loading Brain Map…
    </div>
  ),
});

export default function BrainMapPage() {
  const user = useAdminAuth();
  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-[1400px] mx-auto h-full flex flex-col space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Platform Brain Map</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Live graph of tenant → department → agent relationships across the platform
          </p>
        </div>
        <div className="flex-1 rounded-xl border border-surface-border bg-surface-raised overflow-hidden min-h-[600px]">
          <BrainMapCanvas />
        </div>
      </div>
    </AdminShell>
  );
}
