// ─── components/AuthErrorScreen.tsx ───────────────────────────────────────────

'use client';

import { ShieldAlert } from 'lucide-react';

export function AuthErrorScreen({ message }: { message: string }) {
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
          maxWidth: 480,
          width: '100%',
          padding: 24,
          background: '#18181b',
          border: '1px solid #7f1d1d',
          borderRadius: 16,
          textAlign: 'center',
          color: '#e4e4e7',
        }}
      >
        <ShieldAlert size={36} style={{ margin: '0 auto 16px', color: '#ef4444' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Session ended for security</h1>
        <p style={{ color: '#a1a1aa', marginBottom: 24, fontSize: 14 }}>{message}</p>
        <a
          href="/login"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            background: '#7f1d1d',
            color: 'white',
            borderRadius: 8,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Sign in again
        </a>
      </div>
    </main>
  );
}
