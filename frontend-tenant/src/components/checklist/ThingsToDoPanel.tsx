'use client';

// components/checklist/ThingsToDoPanel.tsx — Floating card on the Home page
// and as a topbar dropdown, listing pending progressive onboarding wizards.
// PR-1 ships the empty + loading states only; item rendering lands in PR-3
// once the wizard definitions are populated.

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOnboardingChecklist } from '@/hooks/useOnboardingChecklist';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';

export function ThingsToDoPanel() {
  const {
    isHydrated,
    isLoading,
    lastError,
    visiblePending,
    progress,
    globalDismissed,
  } = useOnboardingChecklist();
  const dismissAll = useOnboardingChecklistStore((s) => s.dismissAll);

  // Don't render anything while loading or when globally dismissed and no pending items
  if (!isHydrated || isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (lastError) {
    return (
      <Card className="w-full max-w-md border-destructive/40">
        <CardHeader>
          <CardTitle className="text-sm">Things to do</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-destructive">
            Couldn't load your setup checklist: {lastError}
          </p>
        </CardContent>
      </Card>
    );
  }

  // All done or all dismissed
  if (visiblePending.length === 0) {
    return (
      <Card className="w-full max-w-md border-green-500/30 bg-green-500/5">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <span>✅</span> All caught up
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Your portal is fully configured. Revisit later from{' '}
            <Link href="/settings/wizard" className="underline">
              Settings → Setup
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Things to do</CardTitle>
          <span className="text-xs text-muted-foreground">
            {progress.done} of {progress.total}
          </span>
        </div>
        <Progress value={progress.percent} className="h-1.5 mt-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {visiblePending.slice(0, 3).map((entry) => (
          <Link
            key={entry.slug}
            href={`/settings/wizard/${entry.slug}`}
            className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2 hover:border-primary/40 hover:bg-background/60 transition"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{entry.config.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {entry.config.estimatedValue} · ~{entry.config.estimatedMinutes}m
              </p>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0">
              Open
            </Button>
          </Link>
        ))}
        {visiblePending.length > 3 && (
          <Link
            href="/settings/wizard"
            className="block text-center text-xs text-primary hover:underline pt-1"
          >
            View all {visiblePending.length} items →
          </Link>
        )}
        {!globalDismissed && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => void dismissAll(true)}
          >
            Hide this panel
          </Button>
        )}
      </CardContent>
    </Card>
  );
}