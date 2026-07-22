'use client';

import { Plus, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Kpi {
  name: string;
  target?: string;
}

interface KpiListFieldProps {
  value: Kpi[];
  onChange: (kpis: Kpi[]) => void;
}

export function KpiListField({ value, onChange }: KpiListFieldProps) {
  const addKpi = () => {
    onChange([...value, { name: '', target: '' }]);
  };

  const removeKpi = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateKpi = (index: number, field: keyof Kpi, val: string) => {
    const updated = value.map((kpi, i) =>
      i === index ? { ...kpi, [field]: val } : kpi,
    );
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>KPIs</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addKpi}
          disabled={value.length >= 10}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="ml-1">Add KPI</span>
        </Button>
      </div>

      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No KPIs defined. Click &ldquo;Add KPI&rdquo; to define performance metrics for this role.
        </p>
      )}

      <div className="space-y-2">
        {value.map((kpi, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={kpi.name}
              onChange={(e) => updateKpi(i, 'name', e.target.value)}
              placeholder="KPI name"
              className="flex-1"
            />
            <Input
              value={kpi.target ?? ''}
              onChange={(e) => updateKpi(i, 'target', e.target.value)}
              placeholder="Target (optional)"
              className="w-40"
            />
            <button
              onClick={() => removeKpi(i)}
              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
