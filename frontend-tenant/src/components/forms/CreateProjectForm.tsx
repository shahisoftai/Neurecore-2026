'use client';
// ─── Create Project Form ──────────────────────────────────────────────────────
import { useState } from 'react';
import { TextField, TextAreaField, DateField } from '@/components/creatio/FormField';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import api from '@/services/api';

export interface CreateProjectFormProps {
  departmentId?: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function CreateProjectForm({ departmentId, onClose, onCreated }: CreateProjectFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
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
      };
      if (description.trim()) payload.description = description.trim();
      if (departmentId) payload.departmentId = departmentId;
      if (targetDate) payload.targetDate = new Date(targetDate).toISOString();

      const res = await api.post('/projects', payload);
      const created = res?.data?.data ?? res?.data ?? res;
      onCreated?.(created?.id ?? '');
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <TextField
        label="Name"
        required
        placeholder="e.g. Q4 product launch"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextAreaField
        label="Description"
        placeholder="Project goals and deliverables"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <DateField
        label="Target Date"
        value={targetDate}
        onChange={(e) => setTargetDate(e.target.value)}
      />
      {error && <p className="text-xs text-state-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
        <ActionButton variant="ghost" size="md" onClick={onClose} disabled={submitting}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" size="md" onClick={submit} disabled={submitting || !name.trim()}>
          {submitting ? 'Creating…' : 'Create Project'}
        </ActionButton>
      </div>
    </div>
  );
}