'use client';

// HomeTasksPanel — Recent tasks strip shown beneath the KPIs on the home page.
//
// Mirrors the second-to-last section in the Creatio reference image. Renders
// the 5 most-recent tasks (status badge + agent-name + relative timestamp)
// with each row clickable → opens the inspector / task page.

import { useRouter } from 'next/navigation';
import { ListTodo, Inbox } from 'lucide-react';
import { Task } from '@/stores/taskStore';

interface HomeTasksPanelProps {
  tasks: Task[];
  isLoading?: boolean;
  onClickTask?: (taskId: string) => void;
}

function relativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 60) return `${Math.max(0, diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

const STATUS_TONE: Record<string, string> = {
  COMPLETED: 'bg-state-success text-white',
  RUNNING:   'bg-state-info text-white',
  PENDING:   'bg-state-warning text-zinc-900',
  FAILED:    'bg-state-danger text-white',
  IDLE:      'bg-surface-muted text-zinc-100',
};

export function HomeTasksPanel({ tasks, isLoading = false, onClickTask }: HomeTasksPanelProps) {
  const router = useRouter();
  // Defensive: persist-hydration can momentarily hand back undefined; the
  // store contract is array. Coerce + bail to empty so useMemo never reads
  // `.length`/`[…tasks]` on undefined.
  const safeTasks: Task[] = Array.isArray(tasks) ? tasks : [];
  const recent = [...safeTasks]
    .filter((t) => Boolean((t as { updatedAt?: string }).updatedAt))
    .sort((a, b) => {
      const av = new Date((a as { updatedAt?: string }).updatedAt ?? 0).getTime();
      const bv = new Date((b as { updatedAt?: string }).updatedAt ?? 0).getTime();
      return bv - av;
    })
    .slice(0, 5);

  return (
    <section aria-label="Recent tasks" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-accent-500" aria-hidden />
          Tasks
        </h2>
        <button
          type="button"
          onClick={() => router.push('/departments?tab=tasks')}
          className="text-xs text-zinc-500 hover:text-accent-500 transition"
        >
          View all
        </button>
      </div>

      {isLoading && recent.length === 0 ? (
        <div className="card-surface p-8 text-center text-sm text-zinc-500">Loading tasks…</div>
      ) : recent.length === 0 ? (
        <div className="card-surface p-8 text-center text-sm text-zinc-500 flex flex-col items-center gap-2">
          <Inbox className="w-7 h-7 text-zinc-600" aria-hidden />
          <span>No tasks yet. Try the AI prompt above to give one to your team.</span>
        </div>
      ) : (
        <div className="card-surface divide-y divide-surface-border">
          {recent.map((task) => {
            const status = (task as { status?: string }).status ?? 'PENDING';
            const tone = STATUS_TONE[status] ?? STATUS_TONE.PENDING;
            const id = task.id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => (onClickTask ? onClickTask(id) : router.push(`/tasks/${encodeURIComponent(id)}`))}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-overlay transition"
              >
                <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-full ${tone}`}>
                  {status}
                </span>
                <p className="text-sm text-zinc-200 truncate flex-1">
                  {(task as { title?: string }).title ?? `Task ${id.slice(0, 8)}`}
                </p>
                <span className="text-xs text-zinc-500 shrink-0">
                  {relativeTime((task as { updatedAt?: string }).updatedAt)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
