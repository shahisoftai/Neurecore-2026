'use client';

/**
 * StageTemplateEditor — per-plan §5.2 — stage template JSONB builder.
 * Ordered list of stages with name + default duration.
 */

import { StageEditor, type EditingStage, EMPTY_STAGE } from './StageEditor';

interface StageTemplateEditorProps {
  stages: EditingStage[];
  onChange: (next: EditingStage[]) => void;
  readOnly?: boolean;
}

export type { EditingStage };

export function StageTemplateEditor({
  stages,
  onChange,
  readOnly = false,
}: StageTemplateEditorProps) {
  function addStage() {
    onChange([...stages, { ...EMPTY_STAGE, order: stages.length }]);
  }
  function removeStage(idx: number) {
    onChange(stages.filter((_, i) => i !== idx));
  }
  function updateStage(idx: number, patch: Partial<EditingStage>) {
    onChange(stages.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-3">
        Default stages that will be created when a project starts.
      </p>
      <div className="space-y-2">
        {stages.map((s, idx) => (
          <StageEditor
            key={idx}
            stage={s}
            index={idx}
            onChange={(p) => updateStage(idx, p)}
            onRemove={() => removeStage(idx)}
            readOnly={readOnly}
          />
        ))}
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={addStage}
          className="mt-3 w-full py-2 rounded-lg border border-dashed border-surface-border text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition flex items-center justify-center gap-2"
        >
          <span aria-hidden>+</span>
          <span>Add Stage</span>
        </button>
      )}
    </div>
  );
}
