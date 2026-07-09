'use client';
// ─── /projects/new — Create project wizard ────────────────────────────────────
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import TenantShell from '@/components/TenantShell';
import { GlassPanel } from '@/components/home/GlassPanel';
import { CreateProjectForm } from '@/components/forms/CreateProjectForm';
import { useTenantAuth } from '@/hooks/useTenantAuth';

export default function NewProjectPage() {
  const user = useTenantAuth()!;
  const router = useRouter();
  const searchParams = useSearchParams();
  const departmentId = searchParams.get('departmentId') ?? undefined;
  const customerId = searchParams.get('customerId') ?? undefined;

  return (
    <TenantShell user={user}>
      <div className="px-6 py-6 flex flex-col gap-6 max-w-2xl mx-auto w-full">
        <header>
          <Link href="/projects" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← Pipeline
          </Link>
          <h1 className="text-2xl font-bold text-zinc-100 mt-1">New Project</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Fill in the details below to create a new project.
          </p>
        </header>

        <GlassPanel className="p-6">
          <CreateProjectForm
            departmentId={departmentId}
            customerId={customerId}
            onClose={() => router.push('/projects')}
            onCreated={(id) => router.push(`/projects/${id}`)}
          />
        </GlassPanel>
      </div>
    </TenantShell>
  );
}
