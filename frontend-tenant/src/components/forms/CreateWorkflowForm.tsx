'use client';
// ─── Create Workflow Form ─────────────────────────────────────────────────────
import { useState } from 'react';
import { TextField, TextAreaField } from '@/components/creatio/FormField';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import api from '@/services/api';

export interface CreateWorkflowFormProps {
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function CreateWorkflowForm({ onClose, onCreated }: CreateWorkflowFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        isTemplate,
      };
      if (description.trim()) payload.description = description.trim();

      const res = await api.post('/workflows', payload);
      const created = res?.data?.data ?? res?.data ?? res;
      onCreated?.(created?.id ?? '');
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create workflow');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <TextField
        label="Name"
        required
        placeholder="e.g. Customer onboarding"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextAreaField
        label="Description"
        placeholder="What does this workflow do?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
        <input
          type="checkbox"
          checked={isTemplate}
          onChange={(e) => setIsTemplate(e.target.checked)}
          className="w-4 h-4 rounded border-surface-border bg-surface-overlay accent-accent-500"
        />
        Save as template
      </label>
      <p className="text-xs text-zinc-500">
        Workflow graph (definition) can be edited on the workflow's detail page after creation.
      </p>
      {error && <p className="text-xs text-state-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
        <ActionButton variant="ghost" size="md" onClick={onClose} disabled={submitting}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" size="md" onClick={submit} disabled={submitting || !name.trim()}>
          {submitting ? 'Creating…' : 'Create Workflow'}
        </ActionButton>
      </div>
    </div>
  );
}