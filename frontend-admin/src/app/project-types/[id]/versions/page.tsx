"use client";

/**
 * /project-types/[id]/versions — read-only version history (per plan §5.1).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  projectTypesService,
  type ProjectType,
  type ProjectTypeVersion,
} from '@/services/projectTypes.service';
import { VersionHistory } from '@/components/project-types/VersionHistory';

export default function ProjectTypeVersionsPage() {
  const user = useAdminAuth();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const [pt, setPt] = useState<ProjectType | null>(null);
  const [versions, setVersions] = useState<ProjectTypeVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [ptData, list] = await Promise.all([
          projectTypesService.get(id),
          projectTypesService.listVersions(id),
        ]);
        if (cancelled) return;
        setPt(ptData);
        setVersions(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!user) return null;
  return (
    <AdminShell user={user}>
      <div className="max-w-4xl mx-auto space-y-4">
        <Link
          href={`/project-types/${id}`}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          ← Back to {pt?.name ?? 'project type'}
        </Link>
        <h1 className="text-xl font-semibold text-zinc-100">
          Version History{pt ? `: ${pt.name}` : ''}
        </h1>
        <p className="text-sm text-zinc-500">
          Project type versions are immutable. Each shows the field schema, stage
          template, approval chain and goal template that projects of this type
          inherit.
        </p>
        {loading ? (
          <div className="text-xs text-zinc-500">Loading…</div>
        ) : (
          <VersionHistory typeId={id} refreshKey={versions.length} />
        )}
      </div>
    </AdminShell>
  );
}
