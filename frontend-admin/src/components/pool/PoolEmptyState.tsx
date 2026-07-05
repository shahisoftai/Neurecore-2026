"use client";

/**
 * PoolEmptyState — Phase 10.
 * Reusable empty state for pool pages.
 */

export function PoolEmptyState({
  title = "Nothing here yet",
  hint,
  action,
}: {
  title?: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-20 text-center text-zinc-500 text-sm">
      <div className="font-medium text-zinc-300 mb-1">{title}</div>
      {hint && <div className="text-xs">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
