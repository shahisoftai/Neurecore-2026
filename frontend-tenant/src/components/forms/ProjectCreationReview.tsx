/**
 * ProjectCreationReview — Layer 3 of the 3-host create flow.
 *
 * Shows the resolved answers + asks for final confirmation. On confirm,
 * the host (CreateProjectForm) closes the modal and calls `onCreated`.
 */

'use client';

import { ActionButton } from '@/components/creatio/ActionToolbar';
import { CompletenessMeter, useCompleteness, useResolvedRequirements } from '@/components/discovery';

export interface ProjectCreationReviewProps {
  projectId: string;
  projectName: string;
  projectTypeName?: string;
  onConfirm: () => void;
  onBack: () => void;
  onEdit: () => void;
}

export function ProjectCreationReview({
  projectId,
  projectName,
  projectTypeName,
  onConfirm,
  onBack,
  onEdit,
}: ProjectCreationReviewProps) {
  const { snapshot, loading, error } = useCompleteness(projectId);
  const { questions, loading: reqsLoading } = useResolvedRequirements(projectId);

  return (
    <div className="space-y-4" data-testid="review-host">
      <div className="rounded border border-surface-border bg-surface-elevated p-3 space-y-1">
        <div className="text-sm text-zinc-100 font-medium">{projectName}</div>
        {projectTypeName ? (
          <div className="text-xs text-zinc-400">Type: {projectTypeName}</div>
        ) : null}
      </div>
      <CompletenessMeter snapshot={snapshot} loading={loading} error={error} />
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Requirements</p>
        {reqsLoading ? (
          <div className="text-xs text-zinc-500">Loading…</div>
        ) : questions.length === 0 ? (
          <div className="text-xs text-zinc-500">No questions required for this project.</div>
        ) : (
          <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {questions.map((q) => (
              <li key={q.id} className="text-xs text-zinc-300 flex items-baseline gap-2">
                <span className="text-zinc-500">{q.required ? '*' : '·'}</span>
                <span>{q.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-between gap-2 pt-3 border-t border-surface-border">
        <div className="flex gap-2">
          <ActionButton variant="ghost" size="md" onClick={onBack}>
            ← Back to Discovery
          </ActionButton>
          <ActionButton variant="ghost" size="md" onClick={onEdit} data-testid="review-edit">
            Edit Essentials
          </ActionButton>
        </div>
        <ActionButton
          variant="primary"
          size="md"
          onClick={onConfirm}
          data-testid="review-confirm"
        >
          Confirm &amp; Create
        </ActionButton>
      </div>
    </div>
  );
}