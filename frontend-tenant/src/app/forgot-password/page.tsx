"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { authService } from "@/services/auth.service";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-gray-200">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="NeureCore" className="h-10 w-auto object-contain" />
        </div>

        {sent ? (
          <>
            <h1 className="mb-2 text-xl font-semibold text-center">Check your email</h1>
            <p className="text-sm text-gray-600 text-center">
              If an account with that email exists, we&apos;ve sent a password reset link.
            </p>
            <p className="mt-6 text-center text-sm text-gray-500">
              <Link href="/login" className="text-blue-600 hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-semibold text-center">Forgot password</h1>
            <p className="mb-6 text-sm text-gray-500 text-center">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

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
              <button
                type="submit"
                disabled={loading}
                className="mt-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-gray-500">
              <Link href="/login" className="text-blue-600 hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
