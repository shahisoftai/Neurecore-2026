'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface RoutineTriggerFieldProps {
  value: string;
  onChange: (value: string) => void;
}

const TRIGGER_PRESETS = [
  { label: 'Daily at 9 AM', value: 'time: 9:00 AM daily' },
  { label: 'Daily at 8 AM', value: 'time: 8:00 AM daily' },
  { label: 'Monday 8 AM', value: 'time: Monday 8:00 AM' },
  { label: '1st of month 9 AM', value: 'time: 1st of month 9:00 AM' },
  { label: 'On project created', value: 'event: project.created' },
  { label: 'On task completed', value: 'event: task.completed' },
  { label: 'On KYC expiring', value: 'event: kyc.expiring' },
];

export function RoutineTriggerField({
  value,
  onChange,
}: RoutineTriggerFieldProps) {
  return (
    <div className="space-y-3">
      <Label>Trigger</Label>
      <div className="flex flex-wrap gap-2">
        {TRIGGER_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => onChange(preset.value)}
            className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
              value === preset.value
                ? 'bg-accent/10 border-accent text-accent'
                : 'border-border text-muted-foreground hover:border-input hover:text-foreground'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange('custom:')}
          className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
            value.startsWith('custom:')
              ? 'bg-accent/10 border-accent text-accent'
              : 'border-border text-muted-foreground hover:border-input hover:text-foreground'
          }`}
        >
          Custom
        </button>
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="time: 9:00 AM daily | event: project.created | custom:..."
      />
      <p className="text-xs text-muted-foreground">
        Use &ldquo;time: HH:MM AM/PM daily/weekly&rdquo; for scheduled triggers or &ldquo;event: name&rdquo; for event-based triggers.
      </p>
    </div>
  );
}
