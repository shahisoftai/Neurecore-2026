'use client';
// ─── Create Task Form ─────────────────────────────────────────────────────────
import { useState } from 'react';
import { TextField, TextAreaField, SelectField } from '@/components/creatio/FormField';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import api from '@/services/api';

interface Agent {
  id: string;
  name: string;
}

export interface CreateTaskFormProps {
  departmentId?: string;
  agents?: Agent[];
  onClose: () => void;
  onCreated?: (taskId: string) => void;
}

export function CreateTaskForm({
  agents = [],
  onClose,
  onCreated,
}: CreateTaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [agentId, setAgentId] = useState('');
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
        priority,
      };
      if (description.trim()) payload.description = description.trim();
      if (agentId) payload.agentId = agentId;

      const res = await api.post('/tasks', payload);
      const created = res?.data?.data ?? res?.data ?? res;
      onCreated?.(created?.id ?? '');
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <TextField
        label="Title"
        required
        placeholder="e.g. Generate Q3 financial report"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TextAreaField
        label="Description"
        placeholder="Optional context for the agent"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </SelectField>
        <SelectField
          label="Assign to Agent"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
        >
          <option value="">— Unassigned —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </SelectField>
      </div>
      {error && <p className="text-xs text-state-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
        <ActionButton variant="ghost" size="md" onClick={onClose} disabled={submitting}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" size="md" onClick={submit} disabled={submitting || !title.trim()}>
          {submitting ? 'Creating…' : 'Create Task'}
        </ActionButton>
      </div>
    </div>
  );
}