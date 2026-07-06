"use client";

import { useState, FormEvent, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/stores/authStore";
import { routeAfterAuth } from "@/services/auth-redirect.service";
import { tokenManager } from "@/core/infrastructure/auth/TokenManager";
import { errorHandler } from "@/core/infrastructure/ErrorHandler";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: { theme?: string; size?: string; text?: string; shape?: string; width?: number }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function GoogleSignInButton({ onError }: { onError: (msg: string) => void }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const lastCredentialRef = useRef<string | null>(null);

  const completeSignIn = useCallback(async (credential: string, intent: 'signin' | 'link' = 'signin') => {
    setLoading(true);
    try {
      const result = await authService.googleSignIn(credential, intent);
      if (result.status === 'ok') {
        setUser(result.user);
        await routeAfterAuth(router);
      } else if (result.status === 'existing_unlinked') {
        lastCredentialRef.current = credential;
        const event = new CustomEvent('neurecore:google-account-exists', { detail: result });
        window.dispatchEvent(event);
      }
    } catch (err: unknown) {
      onError(errorHandler.normalise(err).message ?? "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }, [router, setUser, onError]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || initializedRef.current) return;
    initializedRef.current = true;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) {
        setTimeout(initGoogle, 100);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          await completeSignIn(response.credential);
        },
      });
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: 280,
        });
      }
    };

    if (!document.getElementById("google-identity-services-script")) {
      const script = document.createElement("script");
      script.id = "google-identity-services-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
    } else {
      initGoogle();
    }
  }, [completeSignIn]);

  // Listen for "link this account" trigger from the prompt modal
  useEffect(() => {
    const handler = () => {
      if (lastCredentialRef.current) {
        void completeSignIn(lastCredentialRef.current, 'link');
      }
    };
    window.addEventListener('neurecore:google-link-account', handler);
    return () => window.removeEventListener('neurecore:google-link-account', handler);
  }, [completeSignIn]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={buttonRef} className={loading ? "opacity-50 pointer-events-none" : ""} />
    </div>
  );
}

// Post-auth redirect logic moved to services/auth-redirect.service.ts so both
// /login and /register use the same code path.

function LoginForm() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (hasHydrated && user) {
      const token = tokenManager.getAccessToken();
      if (token && token.split(".").length === 3) {
        void routeAfterAuth(router);
      }
    }
  }, [hasHydrated, user, router]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkPrompt, setLinkPrompt] = useState<{ email: string; firstName?: string } | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ email: string; firstName?: string }>).detail;
      setLinkPrompt({ email: detail.email, firstName: detail.firstName });
    };
    window.addEventListener('neurecore:google-account-exists', handler);
    return () => window.removeEventListener('neurecore:google-account-exists', handler);
  }, []);

  const handleGoogleError = useCallback((msg: string) => {
    setError(msg);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authService.login({ email, password });
      setUser(result.user);
      await routeAfterAuth(router);
    } catch (err: unknown) {
      setError(errorHandler.normalise(err).message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-gray-200">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="NeureCore" className="h-10 w-auto object-contain" />
        </div>
        <h1 className="sr-only">Sign In to NeureCore</h1>
        <div className="flex justify-center mb-4">
          <GoogleSignInButton onError={handleGoogleError} />
        </div>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-400">Or continue with email</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Email
              <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Password
              <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          No account?{" "}
          <Link href="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-gray-400">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="text-gray-500 hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-gray-500 hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>

      {linkPrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-semibold">Account already exists</h2>
            <p className="mt-2 text-sm text-gray-600">
              An account with <strong>{linkPrompt.email}</strong> already exists
              but is not linked to Google sign-in. How would you like to proceed?
            </p>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setLinkPrompt(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
              >
                Use different Google account
              </button>
              <button
                onClick={() => {
                  setLinkPrompt(null);
                  window.dispatchEvent(new Event('neurecore:google-link-account'));
                }}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Link this Google account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <LoginForm />
    </main>
  );
}
