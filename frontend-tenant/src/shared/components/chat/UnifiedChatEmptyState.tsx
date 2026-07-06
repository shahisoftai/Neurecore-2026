// ─── UnifiedChatEmptyState.tsx ──────────────────────────────────────────────────
// SRP: Renders the empty state with starter prompts. Clicking a prompt sends it.

'use client';

interface UnifiedChatEmptyStateProps {
  starterPrompts: string[];
  homeHeroChips?: string[];
  onPromptClick: (prompt: string) => void;
  disabled: boolean;
}

export function UnifiedChatEmptyState({
  starterPrompts,
  homeHeroChips,
  onPromptClick,
  disabled,
}: UnifiedChatEmptyStateProps) {
  const allPrompts = [...starterPrompts, ...(homeHeroChips ?? [])];

  return (
    <div className="text-center text-zinc-600 text-xs py-8">
      <div className="text-3xl mb-2 opacity-60">✦</div>
      <p className="mb-3 text-zinc-500">How can I help?</p>
      <div className="flex flex-col gap-1.5">
        {allPrompts.map((s) => (
          <button
            key={s}
            onClick={() => onPromptClick(s)}
            disabled={disabled}
            className="text-xs rounded-lg border border-surface-border bg-surface-overlay hover:bg-surface-overlay/80 text-zinc-400 px-3 py-1.5 transition text-left disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
