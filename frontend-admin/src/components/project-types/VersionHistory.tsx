'use client';

/**
 * VersionHistory — per-plan §5.2 — read-only view of past project type versions.
 * Existing logic inlined in `[id]/page.tsx` is moved here.
 */

import { useState, useEffect } from 'react';
import { projectTypesService, type ProjectTypeVersion } from '@/services/projectTypes.service';

interface VersionHistoryProps {
  typeId: string;
  refreshKey?: number;
}

export function VersionHistory({ typeId, refreshKey = 0 }: VersionHistoryProps) {
  const [versions, setVersions] = useState<ProjectTypeVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const list = await projectTypesService.listVersions(typeId);
        if (!cancelled) setVersions(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [typeId, refreshKey]);

  if (loading) {
    return <div className="text-xs text-zinc-500">Loading versions…</div>;
  }
  if (versions.length === 0) {
    return (
      <div className="text-xs text-zinc-500">
        No versions yet. Create the first version from the editor.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {versions.map((v) => (
        <li
          key={v.id}
          className="rounded-lg border border-surface-border bg-surface-raised p-3 text-sm"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-200">Version {v.version}</span>
            <span className="text-[10px] text-zinc-500">
              {new Date(v.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            {(v.fieldSchema?.length ?? 0)} fields · {(v.stageTemplate?.length ?? 0)} stages
          </div>
        </li>
      ))}
    </ul>
  );
}
