'use client';

/**
 * IconRail — Phase 3 collapsed icon rail sidebar
 *
 * Creatio-style vertical icon column that replaces the wide text sidebar.
 * 56px wide, expands to full nav on hover via tooltip + on click.
 *
 * Renders the primary nav icons vertically; clicking an icon navigates.
 * Hover shows a popover with the full nav list for quick switching.
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Users,
  Building2,
  GitBranch,
  ListTodo,
  Repeat,
  Target,
  Briefcase,
  DollarSign,
  BarChart3,
  Plug,
  Lightbulb,
  Activity,
  CheckSquare,
  Inbox,
  Wallet,
  Store,
  Headphones,
  Cog,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface RailItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const RAIL: RailItem[] = [
  { label: 'Home page',       href: '/home', icon: Home },
  { label: 'Agents',         href: '/marketplace?tab=agents', icon: Users },
  { label: 'Departments',    href: '/departments', icon: Building2 },
  { label: 'Tasks',          href: '/departments?tab=tasks', icon: ListTodo },
  { label: 'Workflows',      href: '/departments?tab=workflows', icon: GitBranch },
  { label: 'Routines',       href: '/departments?tab=routines', icon: Repeat },
  { label: 'Goals',          href: '/departments?tab=goals', icon: Target },
  { label: 'Projects',       href: '/departments?tab=projects', icon: Briefcase },
  { label: 'Finance',        href: '/finance', icon: DollarSign },
  { label: 'Intelligence',   href: '/intelligence', icon: BarChart3 },
  { label: 'Marketplace',    href: '/marketplace', icon: Store },
  { label: 'Service Desk',   href: '/service-desk?tab=inbox', icon: Headphones },
  { label: 'Inbox',          href: '/service-desk?tab=inbox', icon: Inbox },
  { label: 'Approvals',      href: '/service-desk?tab=approvals', icon: CheckSquare },
  { label: 'Activity',       href: '/service-desk?tab=activity', icon: Activity },
  { label: 'Connectors',     href: '/marketplace?tab=connectors', icon: Plug },
  { label: 'Settings',       href: '/intelligence?tab=settings', icon: Cog },
  { label: 'AI Skills',      href: '/marketplace?tab=spawn', icon: Lightbulb },
];

interface IconRailProps {
  className?: string;
}

export function IconRail({ className = '' }: IconRailProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  const isActive = (href: string) => {
    // For routes with query params, check pathname only
    const [path] = href.split('?');
    return pathname === path || pathname.startsWith(path + '/');
  };

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`shrink-0 border-r border-surface-border bg-surface-raised flex flex-col transition-[width] duration-200 ${
        expanded ? 'w-56' : 'w-14'
      } ${className}`}
      aria-label="Primary navigation"
    >
      {/* Brand */}
      <div className="h-14 flex items-center px-3 border-b border-surface-border shrink-0">
        <Link href="/home" className="flex items-center gap-2 min-w-0">
          <img src="/logo.png" alt="NeureCore" className="w-7 h-7 rounded-md object-contain shrink-0" />
          {expanded && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-bold tracking-wider text-zinc-100 uppercase whitespace-nowrap"
            >
              NeureCore
            </motion.span>
          )}
        </Link>
      </div>

      {/* Primary icons */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5">
        {RAIL.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              title={expanded ? undefined : item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-2.5 py-2 my-0.5 transition-colors group ${
                active
                  ? 'bg-accent-500/15 text-accent-500'
                  : 'text-zinc-400 hover:bg-surface-overlay hover:text-zinc-100'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {expanded ? (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm truncate"
                >
                  {item.label}
                </motion.span>
              ) : (
                <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-surface-overlay text-xs text-zinc-100 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-creatio-md z-50 border border-surface-border">
                  {item.label}
                </span>
              )}
              {item.badge !== undefined && item.badge > 0 && !expanded && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-state-warn" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse/Expand toggle */}
      <div className="border-t border-surface-border p-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full h-8 rounded-md flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-100 hover:bg-surface-overlay transition"
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {expanded ? (
            <ChevronsLeft className="w-4 h-4" />
          ) : (
            <ChevronsRight className="w-4 h-4" />
          )}
          {expanded && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}