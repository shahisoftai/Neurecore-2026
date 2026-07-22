/**
 * industry-groups.service.ts
 *
 * INDUSTRY-GROUPS-CONCEPT.md §3 — 8 Industry Groups.
 *
 * Industry Groups are static metadata (no DB table needed for v1).
 * If a 9th Group is ever needed, add to GROUPS constant + update
 * tier-industry-matrix.ts.
 */

import { Injectable } from '@nestjs/common';
import {
  INDUSTRY_GROUP_INDUSTRIES,
  IndustryGroupSlug,
} from './tier-industry-matrix';

export interface IndustryGroup {
  slug: IndustryGroupSlug;
  label: string;
  icon: string; // lucide-react icon name
  sortOrder: number;
  industrySlugs: string[];
  description: string;
}

const GROUPS: IndustryGroup[] = [
  {
    slug: 'healthcare',
    label: 'Healthcare',
    icon: 'HeartPulse',
    sortOrder: 10,
    industrySlugs: INDUSTRY_GROUP_INDUSTRIES['healthcare'],
    description: 'Patient care, clinical workflows, medical records',
  },
  {
    slug: 'public-social',
    label: 'Public & Social',
    icon: 'Landmark',
    sortOrder: 20,
    industrySlugs: INDUSTRY_GROUP_INDUSTRIES['public-social'],
    description:
      'Government, education, non-profit and humanitarian organisations',
  },
  {
    slug: 'financial-compliance',
    label: 'Financial & Compliance',
    icon: 'Building',
    sortOrder: 30,
    industrySlugs: INDUSTRY_GROUP_INDUSTRIES['financial-compliance'],
    description: 'Banking, insurance, accounting, audit and advisory',
  },
  {
    slug: 'business-technology',
    label: 'Business & Technology',
    icon: 'Briefcase',
    sortOrder: 40,
    industrySlugs: INDUSTRY_GROUP_INDUSTRIES['business-technology'],
    description: 'Consulting, agencies, software, IT services',
  },
  {
    slug: 'industrial-infrastructure',
    label: 'Industrial & Infrastructure',
    icon: 'Factory',
    sortOrder: 50,
    industrySlugs: INDUSTRY_GROUP_INDUSTRIES['industrial-infrastructure'],
    description: 'Manufacturing, construction, energy, logistics',
  },
  {
    slug: 'consumer-commerce',
    label: 'Consumer & Commerce',
    icon: 'ShoppingBag',
    sortOrder: 60,
    industrySlugs: INDUSTRY_GROUP_INDUSTRIES['consumer-commerce'],
    description: 'Retail, eCommerce, restaurants, media, creative',
  },
  {
    slug: 'agriculture-food',
    label: 'Agriculture & Food',
    icon: 'Wheat',
    sortOrder: 70,
    industrySlugs: INDUSTRY_GROUP_INDUSTRIES['agriculture-food'],
    description: 'Farms, livestock, fisheries, food production',
  },
  {
    slug: 'other',
    label: 'Other',
    icon: 'Layers',
    sortOrder: 80,
    industrySlugs: INDUSTRY_GROUP_INDUSTRIES['other'],
    description: 'Family offices, holding companies, conglomerates',
  },
];

@Injectable()
export class IndustryGroupsService {
  list(): IndustryGroup[] {
    return [...GROUPS].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  get(slug: IndustryGroupSlug): IndustryGroup | undefined {
    return GROUPS.find((g) => g.slug === slug);
  }

  /** All valid group slugs (TypeScript tuple type). */
  getAllSlugs(): IndustryGroupSlug[] {
    return GROUPS.map((g) => g.slug);
  }
}
