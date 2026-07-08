// ─── components/LockoutScreen.tsx ────────────────────────────────────────────

'use client';

function ClockIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block' }}>
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  );
}

export function LockoutScreen({ remainingSeconds }: { remainingSeconds: number }) {
  const minutes = Math.ceil(remainingSeconds / 60);
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#030712',
        padding: 16,
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          padding: 24,
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 16,
          textAlign: 'center',
          color: '#e5e7eb',
        }}
      >
        <ClockIcon />
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Too many attempts</h1>
        <p style={{ color: '#9ca3af', fontSize: 14 }}>
          Please try again in <strong>{minutes}</strong> minute{minutes === 1 ? '' : 's'}.
        </p>
      </div>
    </main>
  );
}
