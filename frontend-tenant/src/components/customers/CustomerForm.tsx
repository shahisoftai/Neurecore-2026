'use client';
// ─── Customer create/edit form ────────────────────────────────────────────────
import { useState } from 'react';
import { TextField, TextAreaField } from '@/components/creatio/FormField';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { IndustryCustomerFields } from '@/components/customers/IndustryCustomerFields';
import { customersService } from '@/services/customers.service';
import type { Customer } from '@/types/customers.types';

interface CustomerFormProps {
  customer?: Customer;
  onClose: () => void;
  onCreated?: (c: Customer) => void;
  onUpdated?: (c: Customer) => void;
}

function extractIndustryFields(billingInfo?: Record<string, unknown> | null): Record<string, string | boolean> {
  if (!billingInfo) return {};
  const fields = billingInfo['industryFields'];
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    const result: Record<string, string | boolean> = {};
    for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
      if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
        result[key] = typeof value === 'number' ? String(value) : value;
      }
    }
    return result;
  }
  return {};
}

export function CustomerForm({ customer, onClose, onCreated, onUpdated }: CustomerFormProps) {
  const [name, setName] = useState(customer?.name ?? '');
  const [industry, setIndustry] = useState(customer?.industry ?? '');
  const [primaryEmail, setPrimaryEmail] = useState(customer?.primaryEmail ?? '');
  const [primaryPhone, setPrimaryPhone] = useState(customer?.primaryPhone ?? '');
  const [tagsInput, setTagsInput] = useState(customer?.tags?.join(', ') ?? '');
  const [industryFieldValues, setIndustryFieldValues] = useState<Record<string, string | boolean>>(
    extractIndustryFields(customer?.billingInfo),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIndustryFieldChange = (key: string, value: string | boolean) => {
    setIndustryFieldValues((prev) => ({ ...prev, [key]: value }));
  };

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

      const hasIndustryFields = Object.keys(industryFieldValues).length > 0;
      const billingInfo = hasIndustryFields
        ? { industryFields: industryFieldValues }
        : undefined;

      if (customer) {
        const updated = await customersService.update(customer.id, {
          name: name.trim(),
          industry: industry.trim() || undefined,
          primaryEmail: primaryEmail.trim() || undefined,
          primaryPhone: primaryPhone.trim() || undefined,
          tags,
          billingInfo,
        });
        onUpdated?.(updated);
      } else {
        const created = await customersService.create({
          name: name.trim(),
          industry: industry.trim() || undefined,
          primaryEmail: primaryEmail.trim() || undefined,
          primaryPhone: primaryPhone.trim() || undefined,
          tags,
          billingInfo,
        });
        onCreated?.(created);
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <TextField
        label="Name"
        required
        placeholder="Acme Industries"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        label="Industry"
        placeholder="accounting, legal, marketing…"
        value={industry}
        onChange={(e) => setIndustry(e.target.value)}
      />
      <TextField
        label="Primary Email"
        type="email"
        placeholder="ops@acme.com"
        value={primaryEmail}
        onChange={(e) => setPrimaryEmail(e.target.value)}
      />
      <TextField
        label="Primary Phone"
        type="tel"
        placeholder="+1 …"
        value={primaryPhone}
        onChange={(e) => setPrimaryPhone(e.target.value)}
      />
      <TextAreaField
        label="Tags"
        placeholder="comma-separated, e.g. priority, retainer"
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        rows={1}
      />

      <IndustryCustomerFields
        industrySlug={industry || null}
        fieldValues={industryFieldValues}
        onFieldChange={handleIndustryFieldChange}
      />

      {error && <p className="text-xs text-state-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-3 border-t border-surface-border">
        <ActionButton variant="ghost" size="md" onClick={onClose} disabled={submitting}>
          Cancel
        </ActionButton>
        <ActionButton
          variant="primary"
          size="md"
          onClick={submit}
          disabled={submitting || !name.trim()}
        >
          {submitting ? 'Saving…' : customer ? 'Save Changes' : 'Create Customer'}
        </ActionButton>
      </div>
    </div>
  );
}
