'use client';

/**
 * IconRail — Canonical single-source-of-truth left navigation.
 *
 * Creatio-style sectioned icon rail that replaces BOTH the legacy wide sidebar
 * AND the /home page's decorative LeftPanel. The entire tenant portal uses
 * this rail as its primary navigation.
 *
 * Layout (expanded):
 *   ┌─ Brand ──────────┐
 *   │ NeureCore       │
 *   ├─ HOME ──────────┤
 *   │  🏠 Home         │
 *   ├─ WORKSPACE ─┬───┤  (clickable section header — collapses items)
 *   │  🏢 Depts    │
 *   │  🌳 OrgChart  │
 *   │  ✓ Tasks     │
 *   │  …            │
 *   ├─ MARKETPLACE ─┬─┤
 *   │  …            │
 *   └─ Workspace tree drawer (collapsible) ─┘
 *   ├─ Footer row: [⚙ Customize] [↔ Collapse/Expand] ─┤
 *
 * Behaviour:
 * - Hover the rail to expand from w-14 (icons only) to w-60 (icons + labels).
 * - Click the chevron at the bottom to pin the expanded state.
 * - Click "Workspace tree" to slide in the OrgTree (department → agent tree).
 * - Click the gear icon to open the Customize Rail modal — toggle sections and
 *   individual links on/off; choices persist in localStorage.
 * - Section headers in expanded mode are clickable to collapse the items
 *   beneath them (label only; section still navigates if clicked too).
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
  UserCircle,
  DollarSign,
  BarChart3,
  Plug,
  Lightbulb,
  Activity,
  CheckSquare,
  Inbox,
  Store,
  Headphones,
  Cog,
  ChevronsLeft,
  ChevronsRight,
  Network,
  PanelRightClose,
  PanelRightOpen,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { OrgTree } from '@/components/sidebar/OrgTree';
import { RailCustomizeModal } from '@/components/layout/RailCustomizeModal';
import { useRailPreferencesStore, type ItemId, type SectionId } from '@/stores/railPreferencesStore';

interface RailItem {
  /** Stable id used by rail preferences for show/hide. */
  id: ItemId;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface RailSection {
  /** Stable id used by rail preferences for show/hide. */
  id: SectionId;
  /** Optional section label (only shown when rail is expanded). */
  label?: string;
  items: RailItem[];
}

/**
 * Canonical rail definition. Re-exported so RailCustomizeModal can iterate
 * the same source. Hidden items / sections are filtered at render time based
 * on user preferences in railPreferencesStore.
 */
export const RAIL_SECTIONS: RailSection[] = [
    {
      id: 'home',
      items: [{ id: 'home', label: 'Home', href: '/home', icon: Home }],
    },
    {
      id: 'workspace',
      label: 'Workspace',
      items: [
        { id: 'departments', label: 'Departments', href: '/departments', icon: Building2 },
        { id: 'org-chart',    label: 'Org Chart',   href: '/departments?tab=org-chart', icon: Network },
        { id: 'tasks',        label: 'Tasks',       href: '/departments?tab=tasks', icon: ListTodo },
        { id: 'workflows',    label: 'Workflows',   href: '/departments?tab=workflows', icon: GitBranch },
        { id: 'routines',     label: 'Routines',    href: '/departments?tab=routines', icon: Repeat },
        { id: 'goals',        label: 'Goals',       href: '/departments?tab=goals', icon: Target },
        { id: 'projects',     label: 'Projects',    href: '/departments?tab=projects', icon: Briefcase },
        { id: 'customers',    label: 'Customers',   href: '/customers',                icon: UserCircle },
      ],
    },
    {
      id: 'marketplace',
      label: 'Marketplace',
      items: [
        { id: 'marketplace', label: 'Marketplace', href: '/marketplace', icon: Store },
        { id: 'agents',      label: 'Employees',      href: '/marketplace?tab=agents', icon: Users },
        { id: 'connectors',  label: 'Connectors',  href: '/marketplace?tab=connectors', icon: Plug },
        { id: 'ai-skills',   label: 'AI Skills',   href: '/marketplace?tab=templates', icon: Lightbulb },
      ],
    },
    {
      id: 'service-desk',
      label: 'Service Desk',
      items: [
        { id: 'service-desk', label: 'Service Desk', href: '/service-desk?tab=inbox', icon: Headphones },
        { id: 'inbox',        label: 'Inbox',        href: '/service-desk?tab=inbox', icon: Inbox },
        { id: 'approvals',    label: 'Approvals',    href: '/service-desk?tab=approvals', icon: CheckSquare },
        { id: 'activity',     label: 'Activity',     href: '/service-desk?tab=activity', icon: Activity },
      ],
    },
    {
      id: 'finance',
      items: [{ id: 'finance', label: 'Finance', href: '/finance', icon: DollarSign }],
    },
    {
      id: 'intelligence',
      label: 'Intelligence',
      items: [
        { id: 'intelligence', label: 'Intelligence', href: '/intelligence', icon: BarChart3 },
        { id: 'settings',     label: 'Settings',     href: '/intelligence?tab=settings', icon: Cog },
      ],
    },
  ];

interface IconRailProps {
  className?: string;
}

export function IconRail({ className = '' }: IconRailProps) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [orgTreeOpen, setOrgTreeOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const expanded = hovered || pinned;

  // Read raw state (primitives / array references) so Zustand triggers
  // re-renders when they change. Wrapping the function-selector pattern
  // (useStore((s) => s.isItemVisible)) would never re-render because the
  // function reference is stable across state changes — the change lives
  // inside hiddenItems, not inside the function itself.
  const hiddenSections = useRailPreferencesStore((s) => s.hiddenSections);
  const hiddenItems = useRailPreferencesStore((s) => s.hiddenItems);
  const collapsedSections = useRailPreferencesStore((s) => s.collapsedSections);
  const toggleSectionCollapsed = useRailPreferencesStore((s) => s.toggleSectionCollapsed);

  const visibleSections = RAIL_SECTIONS
    .filter((section) => !hiddenSections.includes(section.id))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !hiddenItems.includes(item.id)),
    }))
    .filter((section) => section.items.length > 0);

  const isActive = (href: string) => {
    const [path, query = ''] = href.split('?');
    if (pathname !== path) return false;
    const tabMatch = query.match(/tab=([^&]+)/);
    if (tabMatch) {
      if (typeof window === 'undefined') return pathname === path;
      const currentTab = new URLSearchParams(window.location.search).get('tab');
      return currentTab === tabMatch[1];
    }
    return pathname === path || pathname.startsWith(path + '/');
  };

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setOrgTreeOpen(false);
      }}
      className={`shrink-0 border-r border-surface-border bg-surface-raised flex flex-col transition-[width] duration-200 min-h-0 h-full ${
        expanded ? 'w-60' : 'w-14'
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

      {/* Primary nav: sectioned. min-h-0 lets this flex child actually
          shrink/scroll inside its flex parent (otherwise the rail header +
          workspace-tree + collapse buttons push it off-screen). */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-2 px-1.5 [scrollbar-width:thin]">
        {visibleSections.map((section, sectionIdx) => {
          const sectionIsCollapsed = expanded && collapsedSections.includes(section.id);
          return (
            <div key={section.id} className={sectionIdx > 0 ? 'mt-2' : ''}>
              {expanded && section.label && (
                <button
                  type="button"
                  onClick={() => toggleSectionCollapsed(section.id)}
                  className="w-full px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-300 flex items-center justify-between transition"
                  aria-expanded={!sectionIsCollapsed}
                  aria-controls={`rail-section-${section.id}`}
                >
                  <span>{section.label}</span>
                  {section.items.length > 1 && (
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${sectionIsCollapsed ? '-rotate-90' : ''}`}
                    />
                  )}
                </button>
              )}
              {!expanded && sectionIdx > 0 && (
                <div className="my-1 mx-3 border-t border-surface-border/60" aria-hidden="true" />
              )}
              <AnimatePresence initial={false}>
                {!sectionIsCollapsed && (
                  <motion.div
                    id={`rail-section-${section.id}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={`${section.id}-${item.id}`}
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {visibleSections.length === 0 && expanded && (
          <div className="px-3 py-6 text-center text-xs text-zinc-500">
            All sections hidden.{' '}
            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              className="text-accent-500 hover:underline"
            >
              Customize
            </button>{' '}
            to add links.
          </div>
        )}
      </nav>

      {/* OrgTree drawer — pinned workspace tree */}
      <div className="border-t border-surface-border">
        {expanded ? (
          <div className="p-2">
            <button
              onClick={() => setOrgTreeOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs text-zinc-400 hover:text-zinc-100 hover:bg-surface-overlay transition"
              aria-expanded={orgTreeOpen}
              aria-controls="rail-orgtree"
            >
              <span className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" />
                Workspace tree
              </span>
              {orgTreeOpen ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
            </button>
            <AnimatePresence>
              {orgTreeOpen && (
                <motion.div
                  id="rail-orgtree"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="max-h-72 overflow-y-auto pr-1">
                    <OrgTree />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="p-2">
            <button
              onClick={() => {
                setPinned(true);
                setOrgTreeOpen(true);
              }}
              className="w-full h-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-surface-overlay transition"
              aria-label="Open workspace tree"
              title="Workspace tree"
            >
              <Network className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Footer: Customize + Collapse/Expand */}
      <div className="border-t border-surface-border p-2 flex items-center gap-1">
        {expanded ? (
          <>
            <button
              onClick={() => setCustomizeOpen(true)}
              className="flex-1 h-8 rounded-md flex items-center justify-center gap-2 text-zinc-500 hover:text-zinc-100 hover:bg-surface-overlay transition text-xs"
              aria-label="Customize rail"
              title="Customize rail"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Customize</span>
            </button>
            <button
              onClick={() => setPinned((v) => !v)}
              className="h-8 px-2 rounded-md flex items-center justify-center gap-1 text-zinc-500 hover:text-zinc-100 hover:bg-surface-overlay transition"
              aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setCustomizeOpen(true)}
              className="flex-1 h-8 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-surface-overlay transition"
              aria-label="Customize rail"
              title="Customize rail"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPinned((v) => !v)}
              className="h-8 px-2 rounded-md flex items-center justify-center text-zinc-500 hover:text-zinc-100 hover:bg-surface-overlay transition"
              aria-label="Expand sidebar"
              title="Expand"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Customize modal — portals its own overlay */}
      <RailCustomizeModal open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
    </aside>
  );
}