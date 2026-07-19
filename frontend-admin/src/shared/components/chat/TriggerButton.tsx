// ─── TriggerButton.tsx ─────────────────────────────────────────────────────────
// SRP: Floating action button that toggles the chat panel visibility.

'use client';

interface TriggerButtonProps {
  open: boolean;
  onToggle: () => void;
  triggerIcon: string;
}

export function TriggerButton({ open, onToggle, triggerIcon }: TriggerButtonProps) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle conversation panel"
      className="fixed bottom-16 right-20 z-50 w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-lg flex items-center justify-center text-white text-base transition-transform hover:scale-105"
    >
      {open ? '✕' : triggerIcon}
    </button>
  );
}
