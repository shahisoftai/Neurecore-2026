'use client';

/**
 * FieldSchemaEditor — per-plan §5.2 — field schema JSONB builder UI.
 * Renders the list of `EditingField` entries with add / remove.
 */

import { FieldEditor, type EditingField, EMPTY_FIELD } from './FieldEditor';

interface FieldSchemaEditorProps {
  fields: EditingField[];
  onChange: (next: EditingField[]) => void;
  readOnly?: boolean;
}

export type { EditingField };

export const EMPTY_FIELDS: EditingField[] = [];

export function FieldSchemaEditor({
  fields,
  onChange,
  readOnly = false,
}: FieldSchemaEditorProps) {
  function addField() {
    onChange([...fields, { ...EMPTY_FIELD, key: `field_${fields.length + 1}` }]);
  }
  function removeField(idx: number) {
    onChange(fields.filter((_, i) => i !== idx));
  }
  function updateField(idx: number, patch: Partial<EditingField>) {
    onChange(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  return (
    <div>
      <p className="text-xs text-zinc-500 mb-3">
        Custom fields that will appear when creating a project of this type.
      </p>
      <div className="space-y-3">
        {fields.map((f, idx) => (
          <FieldEditor
            key={idx}
            field={f}
            onChange={(p) => updateField(idx, p)}
            onRemove={() => removeField(idx)}
            readOnly={readOnly}
          />
        ))}
      </div>
      {!readOnly && (
        <button
          type="button"
          onClick={addField}
          className="mt-3 w-full py-2 rounded-lg border border-dashed border-surface-border text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition flex items-center justify-center gap-2"
        >
          <span aria-hidden>+</span>
          <span>Add Field</span>
        </button>
      )}
    </div>
  );
}
