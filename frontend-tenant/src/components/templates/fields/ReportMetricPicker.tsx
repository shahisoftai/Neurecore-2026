'use client';

import { Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ReportMetricPickerProps {
  value: string[];
  onChange: (metrics: string[]) => void;
}

const COMMON_METRICS = [
  'totalClients',
  'activeClients',
  'kycComplianceRate',
  'pipelineValue',
  'auditsCompleted',
  'findingsIdentified',
  'findingsResolved',
  'averageCompletionDays',
  'claimsFiled',
  'claimsApproved',
  'claimsDenied',
  'totalPayoutAmount',
  'averageProcessingDays',
  'revenueTotal',
  'revenueGrowth',
  'customerSatisfaction',
  'retentionRate',
  'employeeCount',
  'projectCount',
  'taskCompletionRate',
];

export function ReportMetricPicker({
  value,
  onChange,
}: ReportMetricPickerProps) {
  const toggleMetric = (metric: string) => {
    if (value.includes(metric)) {
      onChange(value.filter((m) => m !== metric));
    } else {
      onChange([...value, metric]);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Metrics</Label>
      <div className="flex flex-wrap gap-1.5">
        {COMMON_METRICS.map((metric) => (
          <button
            key={metric}
            type="button"
            onClick={() => toggleMetric(metric)}
            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
              value.includes(metric)
                ? 'bg-accent/10 border-accent text-accent'
                : 'border-border text-muted-foreground hover:border-input hover:text-foreground'
            }`}
          >
            {metric}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Custom Metric</Label>
        <div className="flex items-center gap-2">
          <Input
            id="custom-metric"
            placeholder="Add custom metric..."
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const input = e.currentTarget;
                const val = input.value.trim();
                if (val && !value.includes(val)) {
                  onChange([...value, val]);
                  input.value = '';
                }
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.getElementById('custom-metric') as HTMLInputElement;
              const val = input?.value?.trim();
              if (val && !value.includes(val)) {
                onChange([...value, val]);
                if (input) input.value = '';
              }
            }}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
          {value.map((metric) => (
            <span
              key={metric}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-muted text-foreground"
            >
              {metric}
              <button
                onClick={() => onChange(value.filter((m) => m !== metric))}
                className="hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
