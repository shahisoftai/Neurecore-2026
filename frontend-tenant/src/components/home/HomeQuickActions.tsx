'use client';

// HomeQuickActions — Creatio-style 4-cell action grid (right side bar).
//
// Each action is a large icon + label tile navigating to the relevant page.
// Used on the home page next to "Your Departments". Sized to match the
// 2-column department grid when stacked on smaller viewports.

import {
  Sparkles,
  Users2,
  TrendingUp,
  Headphones,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

export interface QuickActionSpec {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: 'accent' | 'success' | 'warning' | 'info';
}

const ACTIONS: QuickActionSpec[] = [
  {
    label: 'Spawn Agent',
    description: 'Hire a new AI teammate from the library.',
    href: '/marketplace?tab=spawn',
    icon: Sparkles,
    tone: 'accent',
  },
  {
    label: 'Manage Teams',
    description: 'Departments, members, permissions.',
    href: '/departments',
    icon: Users2,
    tone: 'success',
  },
  {
    label: 'View Finance',
    description: 'Cost today / this month / per agent.',
    href: '/finance',
    icon: TrendingUp,
    tone: 'warning',
  },
  {
    label: 'Service Desk',
    description: 'Inbox, approvals, support tickets.',
    href: '/service-desk?tab=inbox',
    icon: Headphones,
    tone: 'info',
  },
];

const TONE_CLASS: Record<QuickActionSpec['tone'], string> = {
  accent: 'bg-accent-500/10 text-accent-500 group-hover:bg-accent-500/20',
  success: 'bg-state-success/10 text-state-success group-hover:bg-state-success/20',
  warning: 'bg-state-warning/10 text-state-warning group-hover:bg-state-warning/20',
  info: 'bg-state-info/10 text-state-info group-hover:bg-state-info/20',
};

interface HomeQuickActionsProps {
  onAction?: (action: QuickActionSpec) => void;
}

export function HomeQuickActions({ onAction }: HomeQuickActionsProps) {
  return (
    <section aria-label="Quick actions" className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Quick Actions
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              onClick={() => onAction?.(action)}
              className="group card-surface card-interactive p-4 flex items-start gap-3 text-left"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition ${TONE_CLASS[action.tone]}`}>
                <Icon className="w-5 h-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-100 truncate">{action.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{action.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export { ACTIONS as HOME_QUICK_ACTIONS };
