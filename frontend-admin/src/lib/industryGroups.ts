/**
 * industryGroups.ts
 *
 * INDUSTRY-GROUPS-CONCEPT.md §3 — 8 Industry Groups (admin-side copy).
 */

export const INDUSTRY_GROUPS = [
  { slug: 'healthcare', label: 'Healthcare', icon: 'HeartPulse', sortOrder: 10, description: 'Patient care, clinical workflows, medical records' },
  { slug: 'public-social', label: 'Public & Social', icon: 'Landmark', sortOrder: 20, description: 'Government, education, non-profit and humanitarian organisations' },
  { slug: 'financial-compliance', label: 'Financial & Compliance', icon: 'Building', sortOrder: 30, description: 'Banking, insurance, accounting, audit and advisory' },
  { slug: 'business-technology', label: 'Business & Technology', icon: 'Briefcase', sortOrder: 40, description: 'Consulting, agencies, software, IT services' },
  { slug: 'industrial-infrastructure', label: 'Industrial & Infrastructure', icon: 'Factory', sortOrder: 50, description: 'Manufacturing, construction, energy, logistics' },
  { slug: 'consumer-commerce', label: 'Consumer & Commerce', icon: 'ShoppingBag', sortOrder: 60, description: 'Retail, eCommerce, restaurants, media, creative' },
  { slug: 'agriculture-food', label: 'Agriculture & Food', icon: 'Wheat', sortOrder: 70, description: 'Farms, livestock, fisheries, food production' },
  { slug: 'other', label: 'Other', icon: 'Layers', sortOrder: 80, description: 'Family offices, holding companies, conglomerates' },
] as const;

export type IndustryGroupSlug = (typeof INDUSTRY_GROUPS)[number]['slug'];
