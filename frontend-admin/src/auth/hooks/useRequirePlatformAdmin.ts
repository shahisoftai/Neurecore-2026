"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/auth";
import type { AuthUser } from "@/types/auth.types";

/**
 * Enforces SUPER_ADMIN-only access for platform-level admin pages.
 * Per user-roles.md: Only SUPER_ADMIN may access Frontend Admin.
 * Backend @Roles(SUPER_ADMIN) is the authoritative check; this hook
 * provides defense-in-depth on the client and redirects non-admin users
 * to /login before they see any data.
 */
const PLATFORM_ADMIN_ROLES = ["SUPER_ADMIN"] as const;
type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

function isPlatformAdminRole(
  role: string,
): role is PlatformAdminRole {
  return (PLATFORM_ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * Strict variant that only allows SUPER_ADMIN.
 * Returns null while auth state is resolving OR when the user lacks
 * the role. Redirects to /login for unauthenticated and
 * /login?reason=insufficient for authenticated-but-not-admin users.
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
