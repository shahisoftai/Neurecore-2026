'use client';

// app/settings/wizard/page.tsx — Settings index page for all 11 progressive
// onboarding wizards. PR-1 ships a placeholder list using the same checklist
// data the ThingsToDoPanel uses. PR-3 wires up the per-wizard routes.

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useOnboardingChecklist } from '@/hooks/useOnboardingChecklist';

export default function WizardIndexPage() {
  const { entries, isHydrated, isLoading } = useOnboardingChecklist();

  if (!isHydrated || isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Setup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Finish configuring your portal. Each step is optional — you can
          revisit any time.
        </p>
      </header>
      <div className="space-y-2">
        {entries.map((entry) => (
          <Link
            key={entry.slug}
            href={`/settings/wizard/${entry.slug}`}
            className="block"
          >
            <Card className="hover:border-primary/40 transition">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{entry.config.title}</CardTitle>
                  <Badge
                    variant={
                      entry.state === 'DONE'
                        ? 'default'
                        : entry.state === 'SKIPPED'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {entry.state}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {entry.config.description}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {entry.config.estimatedValue} · ~{entry.config.estimatedMinutes}m
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}