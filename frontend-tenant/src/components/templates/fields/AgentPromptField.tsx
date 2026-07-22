'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface AgentPromptFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function AgentPromptField({ value, onChange }: AgentPromptFieldProps) {
  return (
    <div className="space-y-2">
      <Label>System Prompt</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter the agent system prompt..."
        rows={8}
        className="font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Define how this agent role behaves. Min 10 characters, max 10,000.
      </p>
    </div>
  );
}
