'use client';

import { Plus, X, GripVertical } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface LifecycleStage {
  key: string;
  label: string;
  order: number;
}

interface LifecycleStageEditorProps {
  value: LifecycleStage[];
  onChange: (stages: LifecycleStage[]) => void;
}

export function LifecycleStageEditor({
  value,
  onChange,
}: LifecycleStageEditorProps) {
  const addStage = () => {
    const maxOrder = value.reduce((max, s) => Math.max(max, s.order), 0);
    onChange([
      ...value,
      { key: '', label: '', order: maxOrder + 1 },
    ]);
  };

  const removeStage = (index: number) => {
    const filtered = value.filter((_, i) => i !== index);
    const reordered = filtered.map((s, i) => ({ ...s, order: i + 1 }));
    onChange(reordered);
  };

  const updateStage = (
    index: number,
    field: keyof LifecycleStage,
    val: string | number,
  ) => {
    const updated = value.map((stage, i) =>
      i === index ? { ...stage, [field]: val } : stage,
    );
    onChange(updated);
  };

  const moveStage = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === value.length - 1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...value];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    const reordered = updated.map((s, i) => ({ ...s, order: i + 1 }));
    onChange(reordered);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Lifecycle Stages</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStage}
          disabled={value.length >= 20}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="ml-1">Add Stage</span>
        </Button>
      </div>

      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No stages defined. Click &ldquo;Add Stage&rdquo; to define the customer lifecycle.
        </p>
      )}

      <div className="space-y-2">
        {value.map((stage, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 pr-1">
              <button
                onClick={() => moveStage(i, 'up')}
                disabled={i === 0}
                className="p-0.5 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground"
              >
                <GripVertical className="w-3.5 h-3.5 rotate-90" />
              </button>
            </div>
            <span className="text-xs text-muted-foreground w-5 text-center">
              {i + 1}
            </span>
            <Input
              value={stage.key}
              onChange={(e) => updateStage(i, 'key', e.target.value)}
              placeholder="Stage key (e.g. prospect)"
              className="w-40"
            />
            <Input
              value={stage.label}
              onChange={(e) => updateStage(i, 'label', e.target.value)}
              placeholder="Display label"
              className="flex-1"
            />
            <button
              onClick={() => removeStage(i)}
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
