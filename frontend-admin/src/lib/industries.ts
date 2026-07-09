/**
 * Canonical 15-industry list (admin).
 *
 * Mirrored from frontend-tenant/src/lib/industries.ts.
 * Kept in sync via `npm run test:industries-sync` (backend).
 * CI MUST fail if these diverge.
 */

export const INDUSTRIES = [
  'agriculture-food-systems',
  'construction-engineering-infrastructure',
  'education-research',
  'energy-utilities-natural-resources',
  'financial-services',
  'government-public-sector',
  'healthcare-life-sciences',
  'logistics-transportation-supply-chain',
  'manufacturing-industrial',
  'media-communications-creative',
  'nonprofit-international',
  'professional-business-services',
  'retail-commerce-consumer',
  'special-purpose-organizations',
  'technology-digital-services',
] as const;

export type IndustrySlug = (typeof INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<IndustrySlug, string> = {
  'agriculture-food-systems': 'Agriculture & Food Systems',
  'construction-engineering-infrastructure': 'Construction, Engineering & Infrastructure',
  'education-research': 'Education & Research',
  'energy-utilities-natural-resources': 'Energy, Utilities & Natural Resources',
  'financial-services': 'Financial Services',
  'government-public-sector': 'Government & Public Sector',
  'healthcare-life-sciences': 'Healthcare & Life Sciences',
  'logistics-transportation-supply-chain': 'Logistics, Transportation & Supply Chain',
  'manufacturing-industrial': 'Manufacturing & Industrial',
  'media-communications-creative': 'Media, Communications & Creative',
  'nonprofit-international': 'Nonprofit & International Development',
  'professional-business-services': 'Professional & Business Services',
  'retail-commerce-consumer': 'Retail, Commerce & Consumer',
  'special-purpose-organizations': 'Special Purpose Organizations',
  'technology-digital-services': 'Technology & Digital Services',
};

export const INDUSTRY_FILTERS = [
  { label: 'All Industries', value: '' },
  ...INDUSTRIES.map((slug) => ({
    label: INDUSTRY_LABELS[slug],
    value: slug,
  })),
];

export const CLASSIFICATION_FILTERS = [
  { label: 'All Classifications', value: '' },
  { label: 'Client Engagement', value: 'CLIENT_ENGAGEMENT' },
  { label: 'Internal Initiative', value: 'INTERNAL_INITIATIVE' },
  { label: 'Operational Program', value: 'OPERATIONAL_PROGRAM' },
];

export function isIndustrySlug(value: unknown): value is IndustrySlug {
  return typeof value === 'string' && (INDUSTRIES as readonly string[]).includes(value);
}