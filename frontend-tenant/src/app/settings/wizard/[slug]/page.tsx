'use client';

// app/settings/wizard/[slug]/page.tsx — Generic route for each of the 11
// progressive onboarding wizards. PR-1 ships a placeholder shell.
// PR-3 will swap the body for <WizardDefinitionRenderer slug={slug} />.

import { useParams } from 'next/navigation';
import { WizardShell } from '@/components/wizard/WizardShell';
import { WIZARD_SLUGS } from '@/lib/wizard/types';
import type { WizardSlug } from '@/lib/wizard/types';

export default function WizardPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as WizardSlug | undefined;

  if (!slug || !WIZARD_SLUGS.includes(slug)) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-sm text-destructive">Unknown wizard: {String(slug)}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <WizardShell
        title={slug
          .split('-')
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(' ')}
        description="This wizard will be implemented in PR-3."
      >
        <p className="text-sm text-muted-foreground">
          Placeholder. The wizard shell, step navigation, and persistence will
          land in PR-3.
        </p>
      </WizardShell>
    </div>
  );
}