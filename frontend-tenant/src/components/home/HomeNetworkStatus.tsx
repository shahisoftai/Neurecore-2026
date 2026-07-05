'use client';

// HomeNetworkStatus — Top-of-page error banner for offline / API-down state.
//
// Mirrors the Creatio reference image where a "Network Error" pill appears
// above the department panel with a Retry button on the right. We surface
// this when ANY of the critical-data fetches fail (rather than blocking
// the entire render). The banner is theme-aware via semantic tokens.

import { RefreshCw, AlertOctagon, CheckCircle2 } from 'lucide-react';

export interface NetworkErrorDescriptor {
  key: string;
  message: string;
}

export interface HomeNetworkStatusProps {
  errors: NetworkErrorDescriptor[];
  onRetry?: () => void;
  busy?: boolean;
}

export function HomeNetworkStatus({ errors, onRetry, busy = false }: HomeNetworkStatusProps) {
  if (!errors || errors.length === 0) {
    return (
      <section
        aria-label="System status"
        className="card-surface flex items-center justify-between gap-3 px-4 py-3 border-l-4 border-state-success"
      >
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <CheckCircle2 className="w-4 h-4 text-state-success" aria-hidden />
          <span className="font-medium">All systems operational</span>
        </div>
        <span className="text-xs text-zinc-500">Live</span>
      </section>
    );
  }

  return (
    <section
      role="alert"
      aria-label="Network error"
      className="card-surface flex items-center justify-between gap-3 px-4 py-3 border-l-4 border-state-danger bg-state-danger/5"
    >
      <div className="flex items-center gap-3 min-w-0">
        <AlertOctagon className="w-5 h-5 text-state-danger shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-state-danger">Network Error</p>
          <p className="text-xs text-zinc-400 truncate" title={errors.map((e) => e.message).join(' · ')}>
            {errors.length === 1
              ? errors[0].message
              : `${errors.length} sources are unavailable — using cached data where possible`}
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-600 bg-surface-overlay hover:bg-surface-raised text-zinc-300 hover:text-zinc-100 text-xs font-medium px-4 py-1.5 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden />
          {busy ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </section>
  );
}
