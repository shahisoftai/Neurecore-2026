/**
 * Phase 5 — Industry package seeder integrity tests.
 *
 * Validates the seed-industry-packages.cjs + seed-financial-services-packages.cjs
 * definitions themselves, without touching the database. The hard
 * integration test (actually running the seeders) lives in the deploy
 * pipeline; this suite catches the easier class of bugs — duplicate
 * slugs within an industry/tier, missing tier slugs, malformed scopes.
 */

const fs = require('fs');
const path = require('path');

interface SeedEntry {
  slug?: string;
  name?: string;
  scope?: string;
  tierSlug?: string;
  industrySlug?: string;
}

interface ExtractResult {
  [arrayName: string]: SeedEntry[];
}

/**
 * Lightweight regex parser for the const arrays in the CJS seeders.
 * We don't try to evaluate the seeders (they connect to the DB on
 * import); instead we read the source, slice out the array literal,
 * and grep for the fields we care about. Adequate for the structured
 * shape every entry follows.
 */
function extractPackages(filePath: string, arrayNames: string[]): ExtractResult {
  const src = fs.readFileSync(filePath, 'utf8');
  const out: ExtractResult = {};
  for (const name of arrayNames) {
    const re = new RegExp(`const ${name} = \\[(.*?)\\n\\];`, 's');
    const m = src.match(re);
    if (!m) {
      throw new Error(`Could not find array ${name} in ${filePath}`);
    }
    const body = m[1];
    const entryRe = /\{[^{}]*?\}/gs;
    const entries: SeedEntry[] = [];
    let entryMatch: RegExpExecArray | null;
    while ((entryMatch = entryRe.exec(body)) !== null) {
      const entry = entryMatch[0];
      const field = (re_: RegExp): string | undefined => {
        const fm = entry.match(re_);
        return fm ? fm[1] : undefined;
      };
      entries.push({
        slug: field(/slug:\s*'([^']+)'/),
        name: field(/name:\s*'([^']+)'/),
        scope: field(/scope:\s*'([^']+)'/),
        tierSlug: field(/tierSlug:\s*'([^']+)'/),
        industrySlug: field(/industrySlug:\s*'([^']+)'/),
      });
    }
    out[name] = entries;
  }
  return out;
}

const SEEDER_FILES = {
  industry: path.join(__dirname, '..', '..', 'prisma', 'seed-industry-packages.cjs'),
  financialServices: path.join(
    __dirname,
    '..',
    '..',
    'prisma',
    'seed-financial-services-packages.cjs',
  ),
};

describe('Phase 5 — industry package seeders', () => {
  describe('seed-industry-packages.cjs', () => {
    const pkgs = extractPackages(SEEDER_FILES.industry, [
      'CONSUMER_COMMERCE_PACKAGES',
      'INDUSTRIAL_INFRA_PACKAGES',
      'BUSINESS_TECHNOLOGY_PACKAGES',
      'HEALTHCARE_PACKAGES',
      'PUBLIC_SOCIAL_PACKAGES',
      'AGRICULTURE_PACKAGES',
    ]);

    it('seeds at least one package per non-F&C industry group (Phase 5 P1-P4 coverage)', () => {
      const byIndustry: Record<string, number> = {};
      for (const list of Object.values(pkgs)) {
        for (const p of list) {
          if (p.industrySlug) {
            byIndustry[p.industrySlug] = (byIndustry[p.industrySlug] ?? 0) + 1;
          }
        }
      }
      const expectedGroups = [
        'retail-commerce-consumer',
        'media-communications-creative',
        'manufacturing-industrial',
        'construction-engineering-infrastructure',
        'energy-utilities-natural-resources',
        'logistics-transportation-supply-chain',
        'technology-digital-services',
        'professional-business-services',
        'healthcare-life-sciences',
        'government-public-sector',
        'nonprofit-international',
        'education-research',
        'agriculture-food-systems',
      ];
      const missing = expectedGroups.filter((g) => !byIndustry[g]);
      expect(missing).toEqual([]);
    });

    it('has no duplicate (slug, industrySlug) pairs within a single seeder', () => {
      for (const [name, list] of Object.entries(pkgs)) {
        const seen = new Set<string>();
        for (const p of list) {
          const key = `${p.industrySlug}|${p.slug}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
        expect(list.length).toBeGreaterThan(0);
      }
    });

    it('every package has a valid scope', () => {
      const validScopes = new Set(['FUNCTIONAL', 'INDUSTRY']);
      for (const list of Object.values(pkgs)) {
        for (const p of list) {
          expect(validScopes.has(p.scope)).toBe(true);
        }
      }
    });

    it('every package has a slug, name, tierSlug, industrySlug', () => {
      for (const list of Object.values(pkgs)) {
        for (const p of list) {
          expect(p.slug).toBeTruthy();
          expect(p.name).toBeTruthy();
          expect(p.tierSlug).toBeTruthy();
          expect(p.industrySlug).toBeTruthy();
        }
      }
    });
  });

  describe('seed-financial-services-packages.cjs', () => {
    const pkgs = extractPackages(SEEDER_FILES.financialServices, ['PACKAGES']);
    const list = pkgs.PACKAGES;

    it('seeds at least 8 F&C packages', () => {
      expect(list.length).toBeGreaterThanOrEqual(8);
    });

    it('targets the financial-services industry', () => {
      const src = fs.readFileSync(SEEDER_FILES.financialServices, 'utf8');
      expect(src).toContain("where: { slug: 'financial-services' }");
    });

    it('covers all four tiers (basic, business, professional, enterprise)', () => {
      const tiers = new Set(list.map((p) => p.tierSlug).filter(Boolean));
      expect(tiers.has('basic')).toBe(true);
      expect(tiers.has('business')).toBe(true);
      expect(tiers.has('professional')).toBe(true);
      expect(tiers.has('enterprise')).toBe(true);
    });

    it('has no duplicate slugs', () => {
      const seen = new Set<string>();
      for (const p of list) {
        expect(seen.has(p.slug ?? '')).toBe(false);
        seen.add(p.slug ?? '');
      }
    });

    it('embeds COMPOSE() markers in descriptions for readability', () => {
      const src = fs.readFileSync(SEEDER_FILES.financialServices, 'utf8');
      expect(src).toContain('Departments: ');
      expect(src).toContain('AI Agents: ');
      expect(src).toContain('Features: ');
    });
  });
});
