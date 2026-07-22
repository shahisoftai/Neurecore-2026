'use client';

// steps/PlanStep.tsx — Tier-1 onboarding step 4.
// Unchanged logic from the legacy wizard, extracted for clarity.
// Phase 3 G15: wires the PlanImpactPanel so users see what each tier
// unlocks for their industry (capability matrix endpoint).

import { useEffect, useState } from 'react';
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { onboardingService } from '@/services/onboarding.service';
import { tiersService, type Tier } from '@/services/tiers.service';
import { tenantsService } from '@/services/tenants.service';
import { PlanImpactPanel } from '@/components/onboarding/PlanImpactPanel';

export interface PlanStepProps {
  initialTierId: string | null;
  onNext: () => void;
  onBack: () => void;
}

export function PlanStep({
  initialTierId,
  onNext,
  onBack,
}: PlanStepProps) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(
    initialTierId,
  );
  const [submitting, setSubmitting] = useState(false);
  // Phase 3 G15: tenant industry drives the capability panel.
  const [tenantIndustry, setTenantIndustry] = useState<string | null>(null);

  useEffect(() => {
    tenantsService
      .getCurrent()
      .then((t) => setTenantIndustry(t.industry ?? null))
      .catch(() => {
        /* non-fatal — panel will show its own empty-state */
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tiersService
      .list()
      .then((list) => {
        if (!cancelled) setTiers(list);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load plans.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConfirm = async () => {
    if (!selectedTierId) return;
    setSubmitting(true);
    setError(null);
    try {
      await onboardingService.selectTier(selectedTierId);
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select tier.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Choose your plan</h2>
        <p className="text-sm text-muted-foreground mt-1">
          You can upgrade anytime. Limits shown are hard caps.
        </p>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {tiers.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedTierId(t.id)}
              disabled={submitting}
              aria-pressed={selectedTierId === t.id}
              className={`text-left p-4 rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                selectedTierId === t.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t.name}</span>
                {t.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    Default
                  </Badge>
                )}
              </div>
              <div className="mt-2 text-2xl font-bold">
                ${Number(t.monthlyPrice).toFixed(0)}
                <span className="text-xs font-normal text-muted-foreground">
                  /mo
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>👥 {t.maxUsers} users</li>
                <li>🤖 {t.maxAgents} agents</li>
                <li>📁 {t.maxDepartments} departments</li>
                <li>💾 {t.maxStorageGB} GB storage</li>
              </ul>
            </button>
          ))}
        </div>
      )}

      {/* Phase 3 G15: Plan Impact panel — driven by GET /industries/:slug/capabilities?tier= */}
      {selectedTierId ? (
        <PlanImpactPanel
          tierSlug={
            tiers.find((t) => t.id === selectedTierId)?.slug ?? ''
          }
          industrySlug={tenantIndustry}
        />
      ) : null}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <Button
          onClick={() => void handleConfirm()}
          disabled={!selectedTierId || submitting}
        >
          {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          Continue <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}