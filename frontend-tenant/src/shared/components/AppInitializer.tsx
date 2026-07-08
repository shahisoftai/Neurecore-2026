"use client";
// ─── AppInitializer.tsx ────────────────────────────────────────────────────────
// SRP: Boots cross-cutting client-side concerns once on mount. Renders nothing.
// • Wires EventBus → Zustand stores (real-time updates)
// • Registers global keyboard shortcuts (20 actions)
// • Disconnects/connects socket on auth transitions (driven by IAuthEventBus)
// • Subscribes to SESSION_KILLED for socket teardown
// The session RESTORE itself is now AuthProvider's job via authService.initialize().

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initStoreEventBridge } from "@/core/infrastructure/socket/storeEventBridge";
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts";
import { authService } from "@/auth";
import { connectSocket, disconnectSocket } from "@/services/socket";

const UNAUTHENTICATED_ROUTES = ["/login", "/register", "/forgot-password"];

export function AppInitializer() {
  const pathname = usePathname();

  // Register 20 keyboard shortcuts globally
  useKeyboardShortcuts();

  // Connect EventBus → Zustand stores; teardown on unmount
  useEffect(() => {
    const teardown = initStoreEventBridge();
    return teardown;
  }, []);

  // Socket lifecycle: connect when authenticated, disconnect when killed.
  useEffect(() => {
    if (UNAUTHENTICATED_ROUTES.includes(pathname)) return;

    // Connect immediately if already authenticated.
    if (authService.getState().status === 'authenticated') {
      connectSocket();
    }

    const unsubState = authService.subscribe((state) => {
      if (state.status === 'authenticated') {
        connectSocket();
      } else if (state.status === 'unauthenticated' || state.status === 'error') {
        disconnectSocket();
      }
    });

    return unsubState;
  }, [pathname]);

  // Accessible announce region (used by useAnnounce / AccessibilityService)
  return (
    <div
      id="hq-announce"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    />
  );
}
