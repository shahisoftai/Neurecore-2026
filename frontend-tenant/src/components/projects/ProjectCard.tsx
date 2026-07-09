'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Briefcase,
  Calendar,
  DollarSign,
  ArrowUp,
  User,
} from 'lucide-react';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import type { Project, Priority } from '@/services/projects.service';

interface ProjectCardProps {
  project: Project;
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'text-state-success bg-state-success/10 border-state-success/20',
  MEDIUM: 'text-state-warning bg-state-warning/10 border-state-warning/20',
  HIGH: 'text-state-danger bg-state-danger/10 border-state-danger/20',
  URGENT: 'text-state-danger bg-state-danger/20 border-state-danger/40',
};

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

function PriorityBadge({ priority }: { priority?: Priority | null }) {
  if (!priority) return null;
  const cls = PRIORITY_COLOR[priority] ?? PRIORITY_COLOR.MEDIUM;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      <ArrowUp className="w-3 h-3" />
      {PRIORITY_LABEL[priority] ?? priority}
    </span>
  );
}

function formatCurrency(amount?: number | null, currency?: string | null): string | null {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency ?? 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency ?? '$'}${amount.toLocaleString()}`;
  }
}

export function ProjectCard({ project }: ProjectCardProps) {
  const budget = useMemo(
    () => formatCurrency(project.budgetAmount, project.budgetCurrency),
    [project.budgetAmount, project.budgetCurrency],
  );

  return (
    <Link href={`/departments?tab=projects&projectId=${project.id}`}>
      <motion.div
        className="bg-surface border border-surface-border rounded-lg p-4 hover:bg-surface-overlay hover:border-surface-border/70 transition-colors cursor-pointer flex flex-col gap-3"
        whileHover={{ y: -1 }}
        transition={{ duration: 0.15 }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Briefcase className="w-4 h-4 text-zinc-500 shrink-0" />
            <span className="text-sm font-medium text-zinc-100 truncate">
              {project.name}
            </span>
          </div>
          <StatusBadge status={project.status} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {project.priority && <PriorityBadge priority={project.priority} />}
          {project.customer && (
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
              <User className="w-3 h-3" />
              {project.customer.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-zinc-500">
          {budget && (
            <span className="inline-flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {budget}
            </span>
          )}
          {project.targetDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(project.targetDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
