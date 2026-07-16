"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/auth";
import type { AuthUser } from "@/types/auth.types";

/**
 * Roles allowed to access platform-level Brevo administration pages
 * (`/admin/brevo/*`).  Backend `@Roles(SUPER_ADMIN, PLATFORM_ADMIN)` is the
 * authoritative check; this hook provides defense-in-depth on the client and
 * redirects non-admin users to /login before they see any data.
 */
const PLATFORM_ADMIN_ROLES = ["SUPER_ADMIN", "PLATFORM_ADMIN"] as const;
type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

function isPlatformAdminRole(
  role: string,
): role is PlatformAdminRole {
  return (PLATFORM_ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Tighter variant of `useAdminAuth` that only allows
 * `SUPER_ADMIN` / `PLATFORM_ADMIN`. Useful for routes whose backend
 * endpoints are gated to those two roles.
 *
 * Returns `null` while the auth state is resolving OR when the user lacks
 * the role. The effect fires `router.replace("/login")` for the
 * unauthenticated case and `router.replace("/login?reason=insufficient")`
 * for an authenticated-but-not-platform-admin user.
 */
export function useRequirePlatformAdmin(): AuthUser | null {
  const { state } = useAuth();
  const router = useRouter();
  const user = state.status === "authenticated" ? state.user : null;

  useEffect(() => {
    if (state.status === "initializing") return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isPlatformAdminRole(user.role)) {
      router.replace("/login?reason=insufficient");
    }
  }, [state.status, user, router]);

  if (state.status === "initializing") return null;
  if (!user || !isPlatformAdminRole(user.role)) return null;
  return user;
}
