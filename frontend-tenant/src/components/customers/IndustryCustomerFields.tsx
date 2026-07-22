'use client';

/**
 * IndustryCustomerFields
 *
 * Stage 2 Phase 2B: Dynamic customer field rendering.
 *
 * Reads per-industry customer field definitions from the backend API
 * and renders structured form sections with appropriate input types.
 * Fields are grouped by `appearance.section` for logical organization.
 *
 * Props:
 * - industrySlug: the customer's industry (e.g. 'financial-services')
 * - fieldValues: current values for the dynamic fields (controlled form)
 * - onFieldChange: callback when any field value changes
 *
 * SOLID:
 * - SRP: This component ONLY renders industry-specific fields.
 * - OCP: New industry = new definitions in backend registry. Zero changes here.
 * - ISP: Tight interface (industrySlug + values + onChange).
 */

import { useState, useEffect, useCallback } from 'react';
import { TextField, SelectField, DateField } from '@/components/creatio/FormField';
import api from '@/services/api';
import { unwrapItem } from '@/services/unwrap';

export interface CustomerFieldDef {
  key: string;
  label: string;
  type: 'string' | 'enum' | 'date' | 'boolean' | 'encrypted';
  options?: string[];
  required: boolean;
  placeholder?: string;
  hint?: string;
  appearance?: { section: string; order: number };
}

export interface CustomerFieldSection {
  section: string;
  fields: CustomerFieldDef[];
}

interface CustomerFieldsResponse {
  industrySlug: string;
  hasFields: boolean;
  fields: CustomerFieldDef[];
  sections: CustomerFieldSection[];
}

export interface IndustryCustomerFieldsProps {
  industrySlug: string | null | undefined;
  fieldValues: Record<string, string | boolean>;
  onFieldChange: (key: string, value: string | boolean) => void;
}

async function fetchFieldDefinitions(industrySlug: string): Promise<CustomerFieldsResponse | null> {
  try {
    const res = await api.get(`/industries/${encodeURIComponent(industrySlug)}/customer-fields`);
    return unwrapItem(res) as CustomerFieldsResponse;
  } catch {
    return null;
  }
}

function renderField(
  def: CustomerFieldDef,
  value: string | boolean | undefined,
  onChange: (key: string, value: string | boolean) => void,
) {
  const currentValue = value ?? '';

  switch (def.type) {
    case 'boolean':
      return (
        <SelectField
          key={def.key}
          label={def.label}
          required={def.required}
          hint={def.hint}
          value={currentValue === true ? 'true' : currentValue === false ? 'false' : ''}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'true') onChange(def.key, true);
            else if (v === 'false') onChange(def.key, false);
          }}
        >
          <option value="">— Select —</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </SelectField>
      );

    case 'enum':
      return (
        <SelectField
          key={def.key}
          label={def.label}
          required={def.required}
          hint={def.hint}
          value={String(currentValue)}
          onChange={(e) => onChange(def.key, e.target.value)}
        >
          <option value="">— {def.required ? 'Select' : 'None'} —</option>
          {def.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </SelectField>
      );

    case 'date':
      return (
        <DateField
          key={def.key}
          label={def.label}
          required={def.required}
          hint={def.hint}
          value={String(currentValue)}
          onChange={(e) => onChange(def.key, e.target.value)}
        />
      );

    case 'encrypted':
      return (
        <TextField
          key={def.key}
          label={`${def.label} (Encrypted)`}
          required={def.required}
          placeholder={def.placeholder}
          hint={def.hint}
          type="password"
          value={String(currentValue)}
          onChange={(e) => onChange(def.key, e.target.value)}
        />
      );

    case 'string':
    default:
      return (
        <TextField
          key={def.key}
          label={def.label}
          required={def.required}
          placeholder={def.placeholder}
          hint={def.hint}
          value={String(currentValue)}
          onChange={(e) => onChange(def.key, e.target.value)}
        />
      );
  }
}

export function IndustryCustomerFields({
  industrySlug,
  fieldValues,
  onFieldChange,
}: IndustryCustomerFieldsProps) {
  const [sections, setSections] = useState<CustomerFieldSection[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFields = useCallback(async () => {
    if (!industrySlug) {
      setSections([]);
      return;
    }
    setLoading(true);
    const data = await fetchFieldDefinitions(industrySlug);
    setSections(data?.sections ?? []);
    setLoading(false);
  }, [industrySlug]);

  useEffect(() => {
    void loadFields();
  }, [loadFields]);

  if (!industrySlug || (!loading && sections.length === 0)) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-4 mt-4">
        <p className="text-xs text-zinc-500">Loading industry-specific fields...</p>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 w-24 bg-surface-muted rounded mb-2" />
              <div className="h-9 w-full bg-surface-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-surface-border pt-4">
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">
        Industry-Specific Fields
      </h3>
      <p className="text-xs text-zinc-500 mb-4">
        Fields configured for {industrySlug}
      </p>

      {sections.map((section) => (
        <div key={section.section} className="mb-5">
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
            {section.section}
          </h4>
          <div className="space-y-3">
            {section.fields.map((def) =>
              renderField(def, fieldValues[def.key], onFieldChange),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
