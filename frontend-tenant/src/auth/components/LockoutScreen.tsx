// ─── components/LockoutScreen.tsx ────────────────────────────────────────────

'use client';

import { Clock } from 'lucide-react';

export function LockoutScreen({ remainingSeconds }: { remainingSeconds: number }) {
  const minutes = Math.ceil(remainingSeconds / 60);
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#09090b',
        padding: 16,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          padding: 24,
          background: '#18181b',
          border: '1px solid #27272a',
          borderRadius: 16,
          textAlign: 'center',
          color: '#e4e4e7',
        }}
      >
        <Clock size={36} style={{ margin: '0 auto 16px', color: '#f97316' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Too many attempts</h1>
        <p style={{ color: '#a1a1aa', fontSize: 14 }}>
          Please try again in <strong>{minutes}</strong> minute{minutes === 1 ? '' : 's'}.
        </p>
      </div>
    </main>
  );
}
