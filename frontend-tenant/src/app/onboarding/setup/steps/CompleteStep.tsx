'use client';

// steps/CompleteStep.tsx — Tier-1 onboarding final step.
// Triggers POST /onboarding/complete (seeds checklist) and redirects to /home.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { onboardingService } from '@/services/onboarding.service';

export function CompleteStep() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFinish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onboardingService.complete();
      // Post-login redirect target moved from /command-center → /home in PR-6,
      // but the wizard also lands on /home here for consistency.
      router.push('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to finish.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-8 text-center space-y-4">
      <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
      <h2 className="text-xl font-semibold">You are all set!</h2>
      <p className="text-sm text-muted-foreground">
        Your workspace is ready. We will surface any optional setup steps on
        your home page.
      </p>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button onClick={() => void handleFinish()} disabled={submitting}>
        {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
        Open portal
      </Button>
    </Card>
  );
}