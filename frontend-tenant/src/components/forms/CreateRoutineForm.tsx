'use client';
// ─── Create Routine Form (simplified v1) ──────────────────────────────────────
// v1 form: name + ownerAgentId + cron expression.
// A minimal agent node graph is pre-filled so the backend graph validator passes.
// Full visual graph builder is v2.
import { useState } from 'react';
import { TextField, TextAreaField, SelectField } from '@/components/creatio/FormField';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import api from '@/services/api';

interface Agent {
  id: string;
  name: string;
}

export interface CreateRoutineFormProps {
  agents?: Agent[];
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export function CreateRoutineForm({ agents = [], onClose, onCreated }: CreateRoutineFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerAgentId, setOwnerAgentId] = useState('');
  const [cron, setCron] = useState('0 9 * * *');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!ownerAgentId) {
      setError('Owner agent is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        ownerAgentId,
        graphDefinition: {
          nodes: [
            {
              id: 'start',
              name: 'Start',
              type: 'transform',
              config: {},
            },
            {
              id: 'agent-1',
              name: 'Run Agent',
              type: 'agent',
              config: { agentId: ownerAgentId },
            },
          ],
          edges: [{ source: 'start', target: 'agent-1' }],
          entryPoint: 'start',
        },
        config: { timeoutMs: 60000 },
        triggers: [
          {
            type: 'SCHEDULE',
            name: `${name} schedule`,
            config: { cronExpression: cron },
          },
        ],
      };

      const res = await api.post('/routines', payload);
      const created = res?.data?.data ?? res?.data ?? res;
      onCreated?.(created?.id ?? '');
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create routine');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <TextField
        label="Name"
        required
        placeholder="e.g. Daily report digest"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextAreaField
        label="Description"
        placeholder="What does this routine do?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <SelectField
        label="Owner Agent"
        required
        value={ownerAgentId}
        onChange={(e) => setOwnerAgentId(e.target.value)}
      >
        <option value="">— Select agent —</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </SelectField>
      <TextField
        label="Cron Expression"
        required
        placeholder="0 9 * * *"
        hint="5-field cron (minute hour dom month dow)"
        value={cron}
        onChange={(e) => setCron(e.target.value)}
      />
      <p className="text-xs text-zinc-500">
        v1 creates a minimal 2-node graph (Start → Run Owner Agent). Edit the full graph on the routine's detail page.
      </p>
      {error && <p className="text-xs text-state-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
        <ActionButton variant="ghost" size="md" onClick={onClose} disabled={submitting}>
          Cancel
        </ActionButton>
        <ActionButton variant="primary" size="md" onClick={submit} disabled={submitting || !name.trim() || !ownerAgentId}>
          {submitting ? 'Creating…' : 'Create Routine'}
        </ActionButton>
      </div>
    </div>
  );
}