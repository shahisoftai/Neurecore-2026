// ─── components/SessionExpiredScreen.tsx ──────────────────────────────────────

'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export function SessionExpiredScreen({ from }: { from?: string }) {
  const target = from ? `/login?from=${encodeURIComponent(from)}` : '/login';
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
        <AlertCircle size={36} style={{ margin: '0 auto 16px', color: '#fbbf24' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Your session expired</h1>
        <p style={{ color: '#a1a1aa', marginBottom: 24, fontSize: 14 }}>
          For your security, we signed you out. Please sign in again to continue.
        </p>
        <Link
          href={target}
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            background: '#a855f7',
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
