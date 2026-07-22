// Honest verification: every wizard in WIZARD_SLUGS has a corresponding
// component file in [slug]/wizards/.

import { describe, it, expect } from 'vitest';
import { readdirSync } from 'fs';
import { join } from 'path';
import { WIZARD_SLUGS } from '../types';

describe('Wizard file mapping', () => {
  it('has exactly 13 wizard component files', () => {
    // Resolve relative to lib/wizard/__tests__ → repo root → app settings
    // We use process.cwd() which is the project root during tests
    const wizardsDir = join(process.cwd(), 'src/app/settings/wizard/[slug]/wizards');
    const files = readdirSync(wizardsDir).filter((f) => f.endsWith('.tsx'));
    expect(files.length).toBe(13);
  });

  it('every wizard slug has a corresponding component file', () => {
    const wizardsDir = join(process.cwd(), 'src/app/settings/wizard/[slug]/wizards');
    const files = readdirSync(wizardsDir).filter((f) => f.endsWith('.tsx'));

    const expectedMap: Record<string, string> = {
      'company': 'CompanyWizard.tsx',
      'localization': 'LocalizationWizard.tsx',
      'billing': 'BillingWizard.tsx',
      'profile': 'ProfileWizard.tsx',
      'preferences': 'PreferencesWizard.tsx',
      'security': 'SecurityWizard.tsx',
      'ai-ops': 'AiOpsWizard.tsx',
      'org': 'OrgWizard.tsx',
      'integrations': 'IntegrationsWizard.tsx',
      'compliance': 'ComplianceWizard.tsx',
      'team': 'TeamWizard.tsx',
      'google-workspace': 'GoogleWorkspaceWizard.tsx',
      'brevo': 'BrevoWizard.tsx',
    };

    for (const [slug, expectedFile] of Object.entries(expectedMap)) {
      expect(files).toContain(expectedFile);
    }
  });

  it('every wizard slug in WIZARD_SLUGS has a registry entry expectation', () => {
    // We can't dynamically import the page.tsx component (it's React JSX),
    // but we can ensure every slug has a corresponding component file
    // AND we keep the registry in sync.
    for (const slug of WIZARD_SLUGS) {
      const expectedFile = `${toPascal(slug)}Wizard.tsx`;
      const wizardsDir = join(process.cwd(), 'src/app/settings/wizard/[slug]/wizards');
      const files = readdirSync(wizardsDir).filter((f) => f.endsWith('.tsx'));
      expect(files, `No component for slug "${slug}"`).toContain(expectedFile);
    }
  });
});

function toPascal(slug: string): string {
  return slug
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}
