/**
 * industry-groups.service.ts
 *
 * INDUSTRY-GROUPS-CONCEPT.md §3 — 8 Industry Groups.
 *
 * Industry Groups are static metadata (no DB table needed for v1).
 * If a 9th Group is ever needed, add to GROUPS constant + update
 * tier-industry-matrix.ts.
 *
 * SRP: this service is the single source of truth for industry-group
 * metadata AND for resolving an industry slug to its group slug.
 * All write paths that touch Tenant.industry MUST call
 * resolveIndustryGroup() here to keep Tenant.industryGroup in sync —
 * see TenantsService and OnboardingService.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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

  /**
   * Canonical industry-slug → group-slug resolver.
   *
   * INDUSTRY-GROUPS-CONCEPT.md §5: Tenant.industryGroup is a denormalised
   * column kept in sync with Tenant.industry so the IconRail and Marketplace
   * filters can branch without joining the Industry table on every render.
   *
   * Contract:
   * - `null` / `''` / non-string input → returns `null` (clear the group).
   * - Unknown slug → returns `null` (admin should remap; legacy entries get
   *   logged via the standard prisma not-found path so callers can surface
   *   a "industry needs remapping" banner).
   * - Known slug → returns its `industryGroup` column verbatim.
   *
   * This is the ONLY place that should query Industry.industryGroup for the
   * purpose of syncing Tenant.industryGroup. Centralising it here removes the
   * duplication that previously lived inline in OnboardingService.updateState
   * (and was missing entirely in TenantsService.{create,update,updateMine}).
   */
  async resolveIndustryGroup(
    industry: string | null | undefined,
  ): Promise<string | null> {
    if (typeof industry !== 'string' || industry.trim().length === 0) {
      return null;
    }
    const row = await this.prisma.industry.findUnique({
      where: { slug: industry },
      select: { industryGroup: true },
    });
    return row?.industryGroup ?? null;
  }
}
