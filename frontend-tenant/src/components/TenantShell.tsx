'use client';

/**
 * TenantShell — Phase 3 Creatio-style shell wrapper
 *
 * Layout:
 *   ┌─ IconRail (56px) ─┬─ Content ────────────────────────────┐
 *   │                  │  TopBar (56px, secondary icons, ...)   │
 *   │  N brand         │  ──────────────────────────────────── │
 *   │  ⌂ Command       │                                       │
 *   │  ◇ Agents        │  Page content                         │
 *   │  ...             │                                       │
 *   │                  │  ActivityStream (bottom)              │
 *   └──────────────────┴───────────────────────────────────────┘
 *
 * Replaces the Phase 1 wide sidebar + minimal TopBar with Creatio's
 * collapsed icon rail + secondary-icon topbar pattern.
 *
 * Feature-flag controlled: if NEXT_PUBLIC_REDESIGN_SHELL=true, uses
 * IconRail + new TopBar. Otherwise falls back to the original wide
 * sidebar (preserved below as LEGACY).
 */

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/authStore';
import type { AuthUser } from '@/types/auth.types';
import { TopBar } from '@/components/layout/TopBar';
import { IconRail } from '@/components/layout/IconRail';
import { ActivityStream } from '@/components/layout/ActivityStream';
import { InspectorPanel } from '@/components/layout/InspectorPanel';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { OrgTree } from '@/components/sidebar/OrgTree';
import { ConversationPanel } from '@/components/chat/ConversationPanel';
import { UnifiedChatPanel } from '@/shared/components/chat/UnifiedChatPanel';
import { chatService, slashCommands, tenantChatConfig } from '@/core/services/chat/chat.factory';
import { ThingsToDoPanel } from '@/components/checklist/ThingsToDoPanel';
import { MobileNav, MobileNavToggle } from '@/components/layout/MobileNav';
import { useActivityStream } from '@/hooks/useActivityStream';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
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
  const clearUser = useAuthStore((s) => s.clearUser);
  const newShellEnabled = useFeatureFlag('commandCenter'); // umbrella flag for the shell

  // Connect Socket.IO events → activity ring-buffer
  useActivityStream();

  // Register ⌘K command palette navigation commands
  useEffect(() => {
    return registerTenantCommands(router);
  }, [router]);

  async function handleLogout() {
    await authService.logout();
    clearUser();
    router.push('/login');
  }

  return (
    <ErrorBoundary>
      {newShellEnabled ? (
        <NewShell user={user} pathname={pathname} onLogout={handleLogout}>{children}</NewShell>
      ) : (
        <LegacyShell user={user} pathname={pathname} onLogout={handleLogout}>{children}</LegacyShell>
      )}
    </ErrorBoundary>
  );
}

// ─── New shell (Phase 3 + Phase 7 mobile responsiveness) ──────────────────
function NewShell({
  user,
  pathname,
  onLogout,
  children,
}: {
  user: AuthUser;
  pathname: string;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  // Phase 7: Mobile nav state
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Derive current dept name from URL if on workspace
  const deptMatch = pathname.match(/^\/departments\/([^/]+)\/workspace/);
  const departmentName = deptMatch ? decodeURIComponent(deptMatch[1]) : undefined;

  // Derive page title from pathname
  const pageTitle = getPageTitle(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-zinc-100">
      {/* Phase 7: IconRail hidden on mobile (<md), shown on desktop */}
      <div className="hidden md:block shrink-0">
        <IconRail />
      </div>

      {/* Phase 7: Mobile nav drawer */}
      <MobileNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      >
        <OrgTree />
      </MobileNav>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Phase 7: Pass mobile nav toggle to TopBar */}
        <TopBar
          title={pageTitle}
          departmentName={departmentName}
          onMobileNavToggle={() => setMobileNavOpen(!mobileNavOpen)}
        />

        {/* Phase 7: Responsive padding (reduced on mobile) */}
        <main className="flex-1 overflow-auto px-3 py-4 md:p-6">
          {children}
        </main>

        <ActivityStream />
      </div>

      {/* WS-2.1: Progressive onboarding — Things to do panel (PR-1: floating top-right). */}
      {/* Phase 7: Hidden on mobile to prevent clutter */}
      <div className="hidden lg:fixed lg:top-20 lg:right-6 z-30 w-full lg:max-w-md lg:pointer-events-none">
        <div className="lg:pointer-events-auto">
          <ThingsToDoPanel />
        </div>
      </div>

      <InspectorPanel />
      <CommandPalette />
      <ConversationPanel />
      <UnifiedChatPanel
        chatService={chatService}
        slashCommands={slashCommands}
        config={tenantChatConfig}
      />
    </div>
  );
}

// ─── Legacy shell (preserved for fallback) ──────────────────────────────────
function LegacyShell({
  user,
  pathname,
  onLogout,
  children,
}: {
  user: AuthUser;
  pathname: string;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const NAV = [
    { label: 'Dashboard', href: '/dashboard', icon: '⬡' },
    { label: 'Agents', href: '/agents', icon: '◈' },
    { label: 'Departments', href: '/departments', icon: '⬟' },
    { label: 'Org Chart', href: '/org-chart', icon: '◎' },
    { label: 'Tasks', href: '/tasks', icon: '◫' },
    { label: 'Delegate', href: '/tasks/delegate', icon: '⬡' },
    { label: 'Workflows', href: '/workflows', icon: '⬡' },
    { label: 'Routines', href: '/routines', icon: '⚡' },
    { label: 'Goals', href: '/goals', icon: '◎' },
    { label: 'Projects', href: '/projects', icon: '⬡' },
    { label: 'Costs', href: '/costs', icon: '$' },
    { label: 'Inbox', href: '/inbox', icon: '✉' },
    { label: 'Activity', href: '/activity', icon: '◉' },
    { label: 'Approvals', href: '/approvals', icon: '◻' },
    { label: 'Analytics', href: '/analytics', icon: '◈' },
    { label: 'Connectors', href: '/connectors', icon: '⬟' },
    { label: 'Billing', href: '/billing', icon: '⬡' },
    { label: 'Settings', href: '/settings', icon: '◌' },
  ];

  const pageTitle =
    NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'))
      ?.label ?? 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-zinc-100">
      <aside className="w-56 shrink-0 border-r border-surface-border flex flex-col bg-surface-raised">
        <div className="px-5 py-4 border-b border-surface-border">
          <span className="text-sm font-bold tracking-widest text-violet-400 uppercase">
            NeureCore
          </span>
          <div className="text-xs text-zinc-500 mt-0.5">Agent Portal</div>
        </div>
        <nav className="py-3 flex flex-col gap-0.5 px-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${active ? 'bg-violet-600 text-white font-medium' : 'text-zinc-400 hover:bg-surface-overlay hover:text-white'
                  }`}
              >
                <span className="text-xs opacity-70">{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="flex-1 overflow-y-auto border-t border-surface-border">
          <OrgTree />
        </div>
        <div className="px-4 py-4 border-t border-surface-border">
          <div className="text-xs text-zinc-400 font-medium truncate mb-0.5">
            {user.firstName} {user.lastName}
          </div>
          <div className="text-xs text-zinc-500 truncate mb-2">{user.email}</div>
          <span className="inline-block rounded-full bg-violet-900 text-violet-300 text-xs px-2 py-0.5 font-medium mb-3">
            {user.role}
          </span>
          <button
            onClick={onLogout}
            className="w-full rounded-lg border border-surface-border px-3 py-1.5 text-xs text-zinc-400 hover:bg-surface-overlay hover:text-white transition"
          >
            Sign Out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={pageTitle} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
        <ActivityStream />
      </div>

      {/* WS-2.1: Progressive onboarding — Things to do panel. */}
      <div className="fixed top-20 right-6 z-30 w-full max-w-md pointer-events-none">
        <div className="pointer-events-auto">
          <ThingsToDoPanel />
        </div>
      </div>
      <InspectorPanel />
      <CommandPalette />
      <ConversationPanel />
      <UnifiedChatPanel
        chatService={chatService}
        slashCommands={slashCommands}
        config={tenantChatConfig}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function getPageTitle(pathname: string): string {
  if (pathname === '/' || pathname === '/command-center') return 'Command Center';
  if (pathname.startsWith('/command-center')) return 'Command Center';
  if (pathname.startsWith('/marketplace')) return 'Marketplace';
  if (pathname.startsWith('/departments/') && pathname.includes('/workspace'))
    return 'Workspace';
  if (pathname.startsWith('/departments')) return 'Departments';
  if (pathname.startsWith('/finance')) return 'Finance';
  if (pathname.startsWith('/service-desk')) return 'Service Desk';
  if (pathname.startsWith('/intelligence')) return 'Intelligence';
  if (pathname.startsWith('/login')) return 'Login';
  return 'NeureCore';
}