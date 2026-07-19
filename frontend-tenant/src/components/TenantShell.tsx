'use client';

/**
 * TenantShell — Canonical portal shell.
 *
 * Layout:
 *   ┌─ IconRail (56px collapsed / 240px expanded) ─┬─ Content ───────────┐
 *   │  NeureCore brand                              │  TopBar (56px)      │
 *   │  Sectioned primary nav                        │  ──────────────     │
 *   │  Workspace tree (collapsible)                 │                     │
 *   │  Pin/collapse toggle                          │  Page content       │
 *   └───────────────────────────────────────────────┴─────────────────────┘
 *
 * On mobile (<md): IconRail is hidden; hamburger in TopBar opens MobileNav
 * which renders the same IconRail as a slide-out drawer.
 *
 * Floating overlays (Phase 7):
 *   - ThingsToDoPanel (top-right, lg+)
 *   - InspectorPanel, CommandPalette, UnifiedChatPanel
 *
 * Single source of truth for navigation: the IconRail defined in
 * components/layout/IconRail.tsx. There is intentionally no legacy sidebar.
 */

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/auth';
import type { AuthUser } from '@/types/auth.types';
import { TopBar } from '@/components/layout/TopBar';
import { IconRail } from '@/components/layout/IconRail';
import { ActivityStream } from '@/components/layout/ActivityStream';
import { InspectorPanel } from '@/components/layout/InspectorPanel';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { UnifiedChatPanel } from '@/shared/components/chat/UnifiedChatPanel';
import { chatService, slashCommands, jsonExtractor, tenantChatConfig } from '@/core/services/chat/chat.factory';
import { ThingsToDoPanel } from '@/components/checklist/ThingsToDoPanel';
import { MobileNav } from '@/components/layout/MobileNav';
import { useActivityStream } from '@/hooks/useActivityStream';
import { registerTenantCommands } from '@/services/register-commands';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function TenantShell({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useActivityStream();

  useEffect(() => {
    return registerTenantCommands(router);
  }, [router]);

  // Close mobile drawer on route change.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  // Derive current dept name from URL if on workspace
  const deptMatch = pathname.match(/^\/departments\/([^/]+)\/workspace/);
  const departmentName = deptMatch ? decodeURIComponent(deptMatch[1]) : undefined;

  // Derive page title from pathname
  const pageTitle = getPageTitle(pathname);

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden bg-surface text-zinc-100">
        {/* Desktop: persistent IconRail. h-full lets the rail stretch the
            full viewport height so the inner <nav> can scroll independently. */}
        <div className="hidden md:block shrink-0 h-full">
          <IconRail />
        </div>

        {/* Mobile: drawer with the same IconRail. */}
        <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
          <IconRail />
        </MobileNav>

        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar
            title={pageTitle}
            departmentName={departmentName}
            user={user}
            onMobileNavToggle={() => setMobileNavOpen(!mobileNavOpen)}
            onLogout={handleLogout}
          />

          <main className="flex-1 overflow-auto px-3 py-4 md:p-6">
            {children}
          </main>

          <ActivityStream />
        </div>

        {/* Floating panels */}
        <div className="hidden lg:fixed lg:top-20 lg:right-6 z-30 w-full lg:max-w-md lg:pointer-events-none">
          <div className="lg:pointer-events-auto">
            <ThingsToDoPanel />
          </div>
        </div>

        <InspectorPanel />
        <CommandPalette />
        <UnifiedChatPanel
          chatService={chatService}
          slashCommands={slashCommands}
          jsonExtractor={jsonExtractor}
          config={tenantChatConfig}
        />
      </div>
    </ErrorBoundary>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function getPageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '/command-center' || pathname === '/home') return 'Home';
  if (pathname.startsWith('/marketplace')) return 'Marketplace';
  if (pathname.startsWith('/departments') && pathname.includes('/workspace')) return 'Workspace';
  if (pathname.startsWith('/departments')) return 'Departments';
  if (pathname.startsWith('/finance')) return 'Finance';
  if (pathname.startsWith('/service-desk')) return 'Service Desk';
  if (pathname.startsWith('/intelligence')) return 'Intelligence';
  if (pathname.startsWith('/login')) return 'Login';
  return 'NeureCore';
}