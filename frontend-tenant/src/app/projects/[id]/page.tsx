'use client';
// ─── /projects/[id] — Project workspace ──────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import TenantShell from '@/components/TenantShell';
import { GlassPanel } from '@/components/home/GlassPanel';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ProjectInspector } from '@/components/inspector/ProjectInspector';
import { projectsService, type Project } from '@/services/projects.service';
import { useTenantAuth } from '@/hooks/useTenantAuth';

export default function ProjectDetailPage() {
  const user = useTenantAuth()!;
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await projectsService.get(id);
      setProject(p);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !project) {
    return (
      <TenantShell user={user}>
        <div className="p-12 text-center text-sm text-zinc-500">Loading…</div>
      </TenantShell>
    );
  }
  if (!project) {
    return (
      <TenantShell user={user}>
        <div className="p-12 text-center text-sm text-zinc-500">
          Project not found.{' '}
          <Link href="/projects" className="text-primary hover:underline">
            Back to pipeline
          </Link>
        </div>
      </TenantShell>
    );
  }

  return (
    <TenantShell user={user}>
      <div className="px-6 py-6 flex flex-col gap-6 max-w-6xl mx-auto w-full">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/projects" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← Pipeline
            </Link>
            <h1 className="text-2xl font-bold text-zinc-100 mt-1">{project.name}</h1>
            <div className="flex items-center gap-2 mt-2 text-sm text-zinc-400">
              {project.customer && <span>{project.customer.name}</span>}
              <StatusBadge status={project.status} />
            </div>
          </div>
        </header>

        <ProjectInspector id={id} />
      </div>
    </TenantShell>
  );
}
