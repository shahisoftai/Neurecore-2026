/**
 * industries.ts
 *
 * Canonical 16-industry list (15 majors + accounting-audit-services).
 * INDUSTRY-GROUPS-CONCEPT.md — Industry Group info now in `./industryGroups.ts`.
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
  'accounting-audit-services', // Major #16 (added 2026-07-05)
] as const;

export type IndustrySlug = (typeof INDUSTRIES)[number];
