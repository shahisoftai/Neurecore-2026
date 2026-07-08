// ─── components/AuthErrorScreen.tsx ───────────────────────────────────────────

'use client';

function ShieldIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', display: 'block' }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  );
}

export function AuthErrorScreen({ message }: { message: string }) {
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
          maxWidth: 480,
          width: '100%',
          padding: 24,
          background: '#111827',
          border: '1px solid #7f1d1d',
          borderRadius: 16,
          textAlign: 'center',
          color: '#e5e7eb',
        }}
      >
        <ShieldIcon />
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Session ended for security</h1>
        <p style={{ color: '#9ca3af', marginBottom: 24, fontSize: 14 }}>{message}</p>
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
