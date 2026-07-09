/**
 * Information Engine — Legacy Adapter
 *
 * Pure helpers that bridge the legacy `fieldSchema` JSONB shape and the new
 * `informationRequirements` shape (§4.5 of project-creation-imp-plan.md).
 *
 * Used ONLY at read time by the admin editor when a ProjectType was created
 * before Phase 2A and has no `informationRequirements`. Never invoked on the
 * create path; never mutates the database.
 */

import type {
  FieldSchemaItem,
  InformationRequirement,
} from '../../project-types/interfaces/project-type.interface';

/** Convert `informationRequirements` → `fieldSchema` (for legacy admin UI). */
export function informationRequirementsToFieldSchema(
  ir: InformationRequirement[] | null | undefined,
): FieldSchemaItem[] {
  if (!Array.isArray(ir) || ir.length === 0) return [];
  const out: FieldSchemaItem[] = [];
  for (const r of ir) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string') continue;
    const fieldType: FieldSchemaItem['type'] =
      r.type === 'NUMBER' || r.type === 'DATE'
        ? r.type
        : r.type === 'SELECT' || r.type === 'MULTI_SELECT'
          ? r.type
          : 'TEXT';
    out.push({
      key: r.mapsTo?.field ? stripCustomFieldPrefix(r.mapsTo.field) : r.id,
      label: r.label ?? r.id,
      type: fieldType,
      required: !!r.required,
      ...(r.options ? { options: r.options } : {}),
    });
  }
  return out;
}

/** Convert `fieldSchema` → `informationRequirements` (for new admin UI). */
export function fieldSchemaToInformationRequirements(
  fs: FieldSchemaItem[] | null | undefined,
): InformationRequirement[] {
  if (!Array.isArray(fs) || fs.length === 0) return [];
  return fs.map((f) => ({
    id: f.key,
    label: f.label,
    type: f.type as InformationRequirement['type'],
    required: !!f.required,
    ...(f.options ? { options: f.options } : {}),
    mapsTo: { field: `customFieldValues.${f.key}` },
    askVia: ['form'],
  }));
}

function stripCustomFieldPrefix(field: string): string {
  const prefix = 'customFieldValues.';
  return field.startsWith(prefix) ? field.slice(prefix.length) : field;
}

/**
 * Validate that an `informationRequirements` JSON is well-formed.
 * Returns an array of human-readable errors (empty = valid).
 *
 * Per §15 question #4: throw at resolve time, validate at write time
 * (seed scripts + admin UI).
 */
export function validateInformationRequirements(ir: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(ir)) {
    errors.push('informationRequirements must be an array');
    return errors;
  }
  const seenIds = new Set<string>();
  for (let i = 0; i < ir.length; i++) {
    const item = ir[i] as Partial<InformationRequirement> | null;
    const at = `informationRequirements[${i}]`;
    if (!item || typeof item !== 'object') {
      errors.push(`${at} is not an object`);
      continue;
    }
    if (typeof item.id !== 'string' || item.id.length === 0) {
      errors.push(`${at}.id is required`);
    } else if (seenIds.has(item.id)) {
      errors.push(`${at}.id "${item.id}" is duplicated`);
    } else {
      seenIds.add(item.id);
    }
    if (typeof item.label !== 'string' || item.label.length === 0) {
      errors.push(`${at}.label is required`);
    }
    const allowedTypes = [
      'TEXT',
      'NUMBER',
      'DATE',
      'SELECT',
      'MULTI_SELECT',
      'BOOLEAN',
      'CURRENCY',
    ];
    if (typeof item.type !== 'string' || !allowedTypes.includes(item.type)) {
      errors.push(`${at}.type must be one of ${allowedTypes.join(', ')}`);
    }
    if (typeof item.required !== 'boolean') {
      errors.push(`${at}.required must be a boolean`);
    }
  }
  return errors;
}
