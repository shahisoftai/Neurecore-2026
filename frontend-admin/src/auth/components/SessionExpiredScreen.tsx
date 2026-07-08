// ─── components/SessionExpiredScreen.tsx ──────────────────────────────────────

'use client';

import Link from 'next/link';

function AlertIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block' }}>
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  );
}

export function SessionExpiredScreen({ from }: { from?: string }) {
  const target = from ? `/login?from=${encodeURIComponent(from)}` : '/login';
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
        <AlertIcon />
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Your session expired</h1>
        <p style={{ color: '#9ca3af', marginBottom: 24, fontSize: 14 }}>
          For your security, we signed you out. Please sign in again to continue.
        </p>
        <Link
          href={target}
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            background: '#4f46e5',
            color: 'white',
            borderRadius: 8,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Sign in again
        </Link>
      </div>
    </main>
  );
}
