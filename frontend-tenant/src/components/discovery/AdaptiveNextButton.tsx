/**
 * AdaptiveNextButton — picks the best channel for the next question.
 *
 * Reads `question.askVia` and renders a small button row:
 *   "Ask Hermes" (interview) · "Upload a doc" (document) · "Fill form"
 * Clicking a chip switches the active skin.
 */

'use client';

import type { AskChannel } from './types';

export interface AdaptiveNextButtonProps {
  askVia?: AskChannel[];
  onPick: (channel: AskChannel) => void;
  disabled?: boolean;
}

const ALL: Array<{ channel: AskChannel; label: string }> = [
  { channel: 'form', label: 'Fill form' },
  { channel: 'interview', label: 'Ask Hermes' },
  { channel: 'document', label: 'Upload a doc' },
];

export function AdaptiveNextButton({ askVia, onPick, disabled }: AdaptiveNextButtonProps) {
  const allowed = askVia && askVia.length > 0 ? askVia : (['form'] as AskChannel[]);
  const visible = ALL.filter((a) => allowed.includes(a.channel));
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="adaptive-next">
      {visible.map((a) => (
        <button
          key={a.channel}
          type="button"
          disabled={disabled}
          onClick={() => onPick(a.channel)}
          className="text-xs px-2 py-1 rounded border border-surface-border bg-surface-base text-zinc-300 hover:text-zinc-100 disabled:opacity-50"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}