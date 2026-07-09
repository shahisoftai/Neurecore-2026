/**
 * legacy-adapter.spec.ts — Phase 2B unit tests
 *
 * Covers §4.5: bidirectional conversion between legacy fieldSchema and
 * informationRequirements. Plus §15 #4: validateInformationRequirements.
 */

import {
  fieldSchemaToInformationRequirements,
  informationRequirementsToFieldSchema,
  validateInformationRequirements,
} from './legacy-adapter';

describe('legacy-adapter', () => {
  describe('fieldSchemaToInformationRequirements', () => {
    it('returns [] for null/empty input', () => {
      expect(fieldSchemaToInformationRequirements(null)).toEqual([]);
      expect(fieldSchemaToInformationRequirements([])).toEqual([]);
    });

    it('maps keys and labels and prefixes mapsTo with customFieldValues.', () => {
      const out = fieldSchemaToInformationRequirements([
        { key: 'taxYear', label: 'Tax Year', type: 'TEXT', required: true },
      ]);
      expect(out[0]).toMatchObject({
        id: 'taxYear',
        label: 'Tax Year',
        type: 'TEXT',
        required: true,
        mapsTo: { field: 'customFieldValues.taxYear' },
        askVia: ['form'],
      });
    });

    it('passes options through', () => {
      const out = fieldSchemaToInformationRequirements([
        {
          key: 'status',
          label: 'Status',
          type: 'SELECT',
          options: ['A', 'B'],
        },
      ]);
      expect(out[0].options).toEqual(['A', 'B']);
    });
  });

  describe('informationRequirementsToFieldSchema', () => {
    it('returns [] for null/empty input', () => {
      expect(informationRequirementsToFieldSchema(null)).toEqual([]);
      expect(informationRequirementsToFieldSchema([])).toEqual([]);
    });

    it('strips customFieldValues. prefix from mapsTo', () => {
      const out = informationRequirementsToFieldSchema([
        {
          id: 'taxYear',
          label: 'Tax Year',
          type: 'TEXT',
          required: true,
          mapsTo: { field: 'customFieldValues.taxYear' },
        },
      ]);
      expect(out[0].key).toBe('taxYear');
      expect(out[0].label).toBe('Tax Year');
      expect(out[0].type).toBe('TEXT');
    });

    it('maps BOOLEAN and CURRENCY correctly', () => {
      const out = informationRequirementsToFieldSchema([
        { id: 'flag', label: 'Flag', type: 'BOOLEAN', required: false },
        { id: 'amt', label: 'Amount', type: 'CURRENCY', required: false },
      ]);
      expect(out[0].type).toBe('TEXT'); // legacy schema doesn't have BOOLEAN
      expect(out[1].type).toBe('TEXT'); // nor CURRENCY — mapped to TEXT
    });
  });

  describe('validateInformationRequirements (§15 question #4)', () => {
    it('accepts a valid payload', () => {
      const errors = validateInformationRequirements([
        { id: 'a', label: 'A', type: 'TEXT', required: true },
      ]);
      expect(errors).toEqual([]);
    });

    it('rejects non-array', () => {
      expect(validateInformationRequirements({ id: 'a' })).toEqual([
        'informationRequirements must be an array',
      ]);
    });

    it('rejects missing id', () => {
      const errors = validateInformationRequirements([
        { label: 'A', type: 'TEXT', required: true },
      ]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toMatch(/id is required/);
    });

    it('rejects invalid type', () => {
      const errors = validateInformationRequirements([
        { id: 'a', label: 'A', type: 'INVALID', required: true },
      ]);
      expect(errors[0]).toMatch(/type must be one of/);
    });

    it('rejects duplicate ids', () => {
      const errors = validateInformationRequirements([
        { id: 'a', label: 'A', type: 'TEXT', required: true },
        { id: 'a', label: 'A again', type: 'TEXT', required: true },
      ]);
      expect(errors[0]).toMatch(/duplicated/);
    });
  });
});
