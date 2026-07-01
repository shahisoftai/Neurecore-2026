'use client';

/**
 * TopBar — Phase 3 Creatio-style global header
 *
 * Layout: [Brand] [Department breadcrumb] ... [⌘K Search] [Theme]    [Inbox] [Marketplace] [Service Desk] [Intelligence] [Finance] [Notifications] [Help] [Settings] [Avatar]
 *
 * Replaces the minimal Phase 1 TopBar. Uses lucide icons throughout.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  Bell,
  Inbox,
  Store,
  Headphones,
  BarChart3,
  Wallet,
  HelpCircle,
  Settings,
  Sun,
  Moon,
  Contrast,
  Palette,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import { useCommandStore } from '@/stores/commandStore';
import { useActivityStore } from '@/stores/activityStore';
import { useAuthStore } from '@/stores/authStore';
import { useUIPreferencesStore } from '@/shared/stores/uiPreferencesStore';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';
import { authService } from '@/services/auth.service';

interface TopBarProps {
  title?: string;
  /** Optional current department name (shown as breadcrumb when on workspace). */
  departmentName?: string;
}

type ThemeName = 'dark' | 'light' | 'high-contrast';

const THEME_ICON: Record<ThemeName, React.ComponentType<{ className?: string }>> = {
  dark: Moon,
  light: Sun,
  'high-contrast': Contrast,
};

export function TopBar({ title, departmentName }: TopBarProps) {
  const { openPalette } = useCommandStore();
  const { events } = useActivityStore();
  const { theme, setTheme } = useUIPreferencesStore();
  const user = useAuthStore((s) => s.user);
  const clearUser = useAuthStore((s) => s.clearUser);
  const router = useRouter();
  const pathname = usePathname();

  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [unreadInbox, setUnreadInbox] = useState(0);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

  const errorCount = events.filter((e) => e.severity === 'error').length;

  // Live data fetch — approvals + inbox badges
  useEffect(() => {
    api
      .get('/approvals?status=PENDING&limit=1')
      .then((res) => {
        const { total } = unwrapList(res);
        setPendingApprovals(total ?? 0);
      })
      .catch(() => setPendingApprovals(0));

    api
      .get('/inbox/summary')
      .then((res) => {
        const data = res?.data?.data ?? res?.data ?? {};
        setUnreadInbox(data.unread ?? data.count ?? 0);
      })
      .catch(() => setUnreadInbox(0));
  }, []);

  const ThemeIcon = THEME_ICON[theme as ThemeName] ?? Moon;

  const cycleTheme = () => {
    const order: ThemeName[] = ['dark', 'light', 'high-contrast'];
    const idx = order.indexOf(theme as ThemeName);
    const next = order[(idx + 1) % order.length];
    setTheme(next);
  };

  const handleLogout = async () => {
    setAvatarMenuOpen(false);
    try {
      await authService.logout();
    } catch {
      /* ignore */
    }
    clearUser();
    router.push('/login');
  };

  return (
    <header className="topbar-surface h-14 flex items-center px-4 gap-2 flex-shrink-0 z-20">
      {/* ── Left: brand + breadcrumb ─────────────────────────── */}
      <Link href="/command-center" className="flex items-center gap-2 shrink-0">
        <img src="/logo.png" alt="NeureCore" className="h-6 w-auto object-contain" />
      </Link>

      {(departmentName || title) && (
        <>
          <span className="text-zinc-600 mx-1">/</span>
          <span className="text-sm font-medium text-zinc-300 truncate max-w-[200px]">
            {departmentName || title}
          </span>
        </>
      )}

      {/* ── Center: command palette trigger ──────────────────── */}
      <div className="flex-1 flex justify-center min-w-0">
        <button
          onClick={openPalette}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-border bg-surface text-zinc-500 text-xs hover:border-accent-500 hover:text-zinc-300 transition-colors min-w-[280px]"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Search or command…</span>
          <kbd className="text-[10px] bg-surface-muted px-1.5 py-0.5 rounded text-zinc-500 font-mono">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* ── Right: secondary icons ────────────────────────────── */}
      <nav className="flex items-center gap-1">
        <SecondaryIcon
          href="/service-desk?tab=inbox"
          icon={<Inbox className="w-4 h-4" />}
          label="Inbox"
          badge={unreadInbox}
          active={pathname.startsWith('/service-desk')}
        />
        <SecondaryIcon
          href="/marketplace"
          icon={<Store className="w-4 h-4" />}
          label="Marketplace"
          active={pathname.startsWith('/marketplace')}
        />
        <SecondaryIcon
          href="/service-desk?tab=approvals"
          icon={<Headphones className="w-4 h-4" />}
          label="Service Desk"
          badge={pendingApprovals}
          active={pathname.startsWith('/service-desk')}
        />
        <SecondaryIcon
          href="/intelligence"
          icon={<BarChart3 className="w-4 h-4" />}
          label="Intelligence"
          active={pathname.startsWith('/intelligence')}
        />
        <SecondaryIcon
          href="/finance"
          icon={<Wallet className="w-4 h-4" />}
          label="Finance"
          active={pathname.startsWith('/finance')}
        />
      </nav>

      {/* ── Theme toggle ──────────────────────────────────────── */}
      <button
        onClick={cycleTheme}
        className="ml-2 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay transition"
        title={`Theme: ${theme} (click to cycle)`}
        aria-label="Toggle theme"
      >
        <ThemeIcon className="w-4 h-4" />
      </button>

      {/* ── Notifications ─────────────────────────────────────── */}
      <button
        className="relative w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay transition"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {errorCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-state-danger text-[9px] font-bold text-white">
            {errorCount}
          </span>
        )}
      </button>

      {/* ── Help ──────────────────────────────────────────────── */}
      <Link
        href="/help"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay transition"
        title="Help"
        aria-label="Help"
      >
        <HelpCircle className="w-4 h-4" />
      </Link>

      {/* ── Settings ─────────────────────────────────────────── */}
      <Link
        href="/intelligence?tab=settings"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay transition"
        title="Settings"
        aria-label="Settings"
      >
        <Settings className="w-4 h-4" />
      </Link>

      {/* ── Avatar + dropdown ─────────────────────────────────── */}
      {user && (
        <div className="relative ml-1">
          <button
            onClick={() => setAvatarMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 pl-1 pr-2 h-8 rounded-lg hover:bg-surface-overlay transition"
            aria-label="User menu"
          >
            <div className="w-7 h-7 rounded-full bg-accent-500 flex items-center justify-center text-white text-xs font-semibold">
              {(user.firstName?.[0] ?? user.email[0]).toUpperCase()}
            </div>
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          </button>

          {avatarMenuOpen && (
            <>
              {/* Backdrop to close on click-outside */}
              <div
                className="fixed inset-0 z-30"
                onClick={() => setAvatarMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-56 card-surface border border-surface-border shadow-creatio-md py-1 z-40">
                <div className="px-3 py-2 border-b border-surface-border">
                  <p className="text-sm font-medium text-zinc-100 truncate">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                  <span className="inline-block mt-1.5 rounded-full bg-accent-500/15 text-accent-500 text-[10px] px-2 py-0.5 font-medium uppercase tracking-wide">
                    {user.role}
                  </span>
                </div>
                <Link
                  href="/intelligence?tab=settings"
                  onClick={() => setAvatarMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-surface-overlay hover:text-zinc-100"
                >
                  <Settings className="w-3.5 h-3.5" /> Settings
                </Link>
                <Link
                  href="/help"
                  onClick={() => setAvatarMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-surface-overlay hover:text-zinc-100"
                >
                  <HelpCircle className="w-3.5 h-3.5" /> Help
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-state-danger hover:bg-state-danger/10 border-t border-surface-border"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}

interface SecondaryIconProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  active?: boolean;
}

function SecondaryIcon({ href, icon, label, badge, active }: SecondaryIconProps) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition ${
        active
          ? 'bg-accent-500/15 text-accent-500'
          : 'text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay'
      }`}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-state-warn text-[9px] font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}