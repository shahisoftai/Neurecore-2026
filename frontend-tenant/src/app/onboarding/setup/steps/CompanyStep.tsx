'use client';

// steps/CompanyStep.tsx — Tier-1 onboarding step 1.
// Captures company name + industry. Persists via PATCH /tenants/me so the
// fields land in the additive nullable columns added in PR-1.

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { onboardingService } from '@/services/onboarding.service';

export interface CompanyStepProps {
  initialName: string;
  initialIndustry: string;
  onNext: () => void;
}

export function CompanyStep({
  initialName,
  initialIndustry,
  onNext,
}: CompanyStepProps) {
  const [companyName, setCompanyName] = useState(initialName);
  const [industry, setIndustry] = useState(initialIndustry);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setError(null);
    setSubmitting(true);
    try {
      // Await persistence so the orchestrator's tenant state stays in sync
      // when the user resumes mid-flow.
      await onboardingService.saveCompanyAndLocale({
        name: companyName,
        industry,
      });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Tell us about your company</h2>
        <p className="text-sm text-muted-foreground mt-1">
          We will personalize your portal with these details.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="company-name">Company name</Label>
        <Input
          id="company-name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Acme Inc."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry">Industry (optional)</Label>
        <Input
          id="industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="SaaS, e-commerce, consulting..."
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          onClick={() => void handleContinue()}
          disabled={!companyName.trim() || submitting}
        >
          Continue <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}