'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeptTemplatesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/departments-pool');
  }, [router]);
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-zinc-500 text-sm">Redirecting to /departments-pool …</div>
    </div>
  );
}
