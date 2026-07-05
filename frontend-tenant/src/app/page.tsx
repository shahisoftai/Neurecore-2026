'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { Sparkles, ArrowRight } from 'lucide-react';

/**
 * Root page — redirects authed users to /home (Phase 5.5 stub).
 * Unauthed users see the marketing landing page.
 * Uses routeAfterAuth so we honour onboarding completion state.
 */
export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user) {
      void import('@/services/auth-redirect.service').then((m) =>
        m.routeAfterAuth(router),
      );
    }
  }, [user, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 hero-gradient">
      <div className="w-12 h-12 rounded-xl bg-accent-500 flex items-center justify-center text-white shadow-creatio-md">
        <Sparkles className="w-6 h-6" />
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-zinc-100">
        NeureCore
      </h1>
      <p className="text-zinc-400 text-lg">Your AI-powered workspace</p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="flex items-center gap-2 rounded-lg bg-accent-500 hover:bg-accent-600 px-6 py-3 text-white font-medium transition shadow-creatio-sm"
        >
          Sign In
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-surface-border hover:border-accent-500 px-6 py-3 text-zinc-300 hover:text-zinc-100 font-medium transition"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}