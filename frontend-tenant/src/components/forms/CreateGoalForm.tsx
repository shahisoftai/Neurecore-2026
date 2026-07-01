'use client';
// ─── Create Goal Form ─────────────────────────────────────────────────────────
import { useState } from 'react';
import { TextField, TextAreaField, SelectField, DateField } from '@/components/creatio/FormField';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import api from '@/services/api';

interface Agent {
  id: string;
  name: string;
}

export interface CreateGoalFormProps {
  departmentId?: string;
  agents?: Agent[];
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function CreateGoalForm({
  departmentId,
  agents = [],
  onClose,
  onCreated,
}: CreateGoalFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('DEPARTMENT');
  const [ownerAgentId, setOwnerAgentId] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        level,
      };
      if (description.trim()) payload.description = description.trim();
      if (departmentId) payload.departmentId = departmentId;
      if (ownerAgentId) payload.ownerAgentId = ownerAgentId;
      if (targetDate) payload.targetDate = new Date(targetDate).toISOString();

      const res = await api.post('/goals', payload);
      const created = res?.data?.data ?? res?.data ?? res;
      onCreated?.(created?.id ?? '');
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create goal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <TextField
        label="Title"
        required
        placeholder="e.g. Increase monthly active users by 20%"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TextAreaField
        label="Description"
        placeholder="What does success look like?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="COMPANY">Company</option>
          <option value="DEPARTMENT">Department</option>
          <option value="TEAM">Team</option>
          <option value="INDIVIDUAL">Individual</option>
        </SelectField>
        <SelectField
          label="Owner Agent"
          value={ownerAgentId}
          onChange={(e) => setOwnerAgentId(e.target.value)}
        >
          <option value="">— No owner —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </SelectField>
      </div>
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
        <ActionButton variant="primary" size="md" onClick={submit} disabled={submitting || !title.trim()}>
          {submitting ? 'Creating…' : 'Create Goal'}
        </ActionButton>
      </div>
    </div>
  );
}