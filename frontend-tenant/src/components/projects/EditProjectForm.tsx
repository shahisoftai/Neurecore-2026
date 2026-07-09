'use client';

import { useState } from 'react';
import { TextField, TextAreaField, DateField, SelectField } from '@/components/creatio/FormField';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { projectsService } from '@/services/projects.service';
import type { Project, BudgetType, Priority } from '@/services/projects.service';

interface EditProjectFormProps {
  project: Project;
  onSaved: () => void;
}

export function EditProjectForm({ project, onSaved }: EditProjectFormProps) {
  const [name, setName] = useState(project.name ?? '');
  const [description, setDescription] = useState(project.description ?? '');
  const [budgetType, setBudgetType] = useState<BudgetType | ''>(project.budgetType ?? '');
  const [budgetAmount, setBudgetAmount] = useState(
    project.budgetAmount != null ? String(project.budgetAmount) : '',
  );
  const [priority, setPriority] = useState<Priority>(project.priority ?? 'MEDIUM');
  const [tagsInput, setTagsInput] = useState(project.tags?.join(', ') ?? '');
  const [targetDate, setTargetDate] = useState(
    project.targetDate ? project.targetDate.slice(0, 10) : '',
  );
  const [customerId, setCustomerId] = useState(project.customerId ?? '');
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
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = {};
      payload.name = name.trim();
      if (description.trim()) payload.description = description.trim();
      if (budgetType) payload.budgetType = budgetType;
      if (budgetAmount) payload.budgetAmount = Number(budgetAmount);
      if (priority) payload.priority = priority;
      if (targetDate) payload.targetDate = new Date(targetDate).toISOString();
      if (customerId) payload.customerId = customerId;
      payload.tags = tags;

      await projectsService.update(project.id, payload as Partial<Project>);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save project');
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

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Customer ID"
          placeholder="customer id"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        />
        <SelectField
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </SelectField>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SelectField
          label="Budget Type"
          value={budgetType}
          onChange={(e) => setBudgetType(e.target.value as BudgetType | '')}
        >
          <option value="">—</option>
          <option value="FIXED_FEE">Fixed Fee</option>
          <option value="HOURLY">Hourly</option>
          <option value="RETAINER">Retainer</option>
        </SelectField>
        <TextField
          label="Budget Amount"
          type="number"
          placeholder="0.00"
          value={budgetAmount}
          onChange={(e) => setBudgetAmount(e.target.value)}
        />
        <DateField
          label="Target Date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </div>

      <TextField
        label="Tags"
        placeholder="comma-separated, e.g. priority, retainer"
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
      />

      {error && <p className="text-xs text-state-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
        <ActionButton variant="ghost" size="md" onClick={onSaved} disabled={submitting}>
          Cancel
        </ActionButton>
        <ActionButton
          variant="primary"
          size="md"
          onClick={submit}
          disabled={submitting || !name.trim()}
        >
          {submitting ? 'Saving…' : 'Save Changes'}
        </ActionButton>
      </div>
    </div>
  );
}
