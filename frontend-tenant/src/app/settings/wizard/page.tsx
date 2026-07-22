'use client';

// app/settings/wizard/page.tsx — Settings index page for all 13 progressive
// onboarding wizards grouped by setup phase with weighted progress.

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, CheckCircle2 } from 'lucide-react';
import { useOnboardingChecklist } from '@/hooks/useOnboardingChecklist';
import { PHASE_LABELS, PHASE_DESCRIPTIONS, WIZARD_PHASES } from '@/lib/wizard/types';
import type { WizardPhase } from '@/lib/wizard/types';

export default function WizardIndexPage() {
  const { entries, isHydrated, isLoading, phaseProgress, progress, doneSlugs } = useOnboardingChecklist();

  if (!isHydrated || isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const entriesByPhase = (phase: WizardPhase) =>
    entries.filter((e) => e.config.phase === phase);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Setup Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Complete these steps to fully configure NeureCore for your organization.
          Weighted progress: {progress.doneWeight}/{progress.totalWeight} ({progress.percent}%)
        </p>
        <Progress value={progress.percent} className="h-2 mt-3" />
      </header>

      {WIZARD_PHASES.map((phase) => {
        const phaseEntries = entriesByPhase(phase);
        if (phaseEntries.length === 0) return null;
        const pp = phaseProgress[phase];
        const allDone = phaseEntries.every(
          (e) => e.state === 'DONE' || e.state === 'SKIPPED',
        );

        return (
          <section key={phase}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  {allDone && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  Phase {phase}: {PHASE_LABELS[phase]}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {PHASE_DESCRIPTIONS[phase]}
                </p>
              </div>
              <span className="text-sm text-muted-foreground shrink-0 ml-4">
                {pp.doneWeight}/{pp.totalWeight}
              </span>
            </div>
            <Progress value={pp.percent} className="h-1.5 mb-3" />
            <div className="space-y-2">
              {phaseEntries.map((entry) => {
                const deps: string[] = entry.config.dependsOn ?? [];
                const locked = deps.length > 0 && !deps.every((d) => doneSlugs.has(d));
                return (
                  <Link
                    key={entry.slug}
                    href={locked ? '#' : `/settings/wizard/${entry.slug}`}
                    onClick={(e) => { if (locked) e.preventDefault(); }}
                    className="block"
                  >
                    <Card className={`transition ${
                      locked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-primary/40'
                    } ${
                      entry.state === 'DONE'
                        ? 'border-green-500/30 bg-green-500/5'
                        : entry.state === 'SKIPPED'
                          ? 'border-muted bg-muted/20'
                          : ''
                    }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            {locked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
                            {entry.config.title}
                            {entry.state === 'DONE' && (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            )}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                entry.state === 'DONE'
                                  ? 'default'
                                  : entry.state === 'SKIPPED'
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {entry.state === 'DONE'
                                ? 'Done'
                                : entry.state === 'SKIPPED'
                                  ? 'Skipped'
                                  : locked
                                    ? 'Locked'
                                    : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {entry.config.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {entry.config.estimatedValue} · ~{entry.config.estimatedMinutes}m
                          {deps.length > 0 && locked && (
                            <span className="ml-2 text-destructive">
                              Requires: {deps.join(', ')}
                            </span>
                          )}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
