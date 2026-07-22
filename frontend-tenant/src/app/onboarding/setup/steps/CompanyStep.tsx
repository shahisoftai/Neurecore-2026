'use client';

// steps/CompanyStep.tsx — Tier-1 onboarding step 1.
// Captures company name + industry via INDUSTRY-GROUPS-CONCEPT.md IndustryGroupPicker.
// Persists via PATCH /tenants/me so the fields land in the additive nullable columns.

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { onboardingService } from '@/services/onboarding.service';
import api from '@/services/api';
import {
  IndustryGroupPicker,
  type IndustryOption,
} from '@/components/onboarding/IndustryGroupPicker';

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
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the canonical industry list (already grouped server-side).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // /api/v1/industries/groups returns each group + its nested industries.
        const res = await api.get('/industries/groups');
        const groups = (res.data?.data ?? []) as Array<{
          slug: string;
          industries: IndustryOption[];
        }>;
        if (cancelled) return;
        const all: IndustryOption[] = [];
        for (const g of groups) {
          for (const ind of g.industries ?? []) {
            all.push({
              ...ind,
              industryGroup: g.slug,
              groupSortOrder: 0,
            });
          }
        }
        setIndustries(all);
      } catch {
        // Non-fatal — picker will just be empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleContinue = async () => {
    setError(null);
    setSubmitting(true);
    try {
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
        <Label>Industry</Label>
        <IndustryGroupPicker
          industries={industries}
          value={industry}
          onChange={setIndustry}
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
