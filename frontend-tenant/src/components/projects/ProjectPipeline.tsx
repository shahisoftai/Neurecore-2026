'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ProjectCard } from '@/components/projects/ProjectCard';
import type { Project, ProjectStatus } from '@/services/projects.service';

interface ProjectPipelineProps {
  projects: Project[];
}

const PIPELINE_COLUMNS: { status: ProjectStatus; label: string }[] = [
  { status: 'LEAD', label: 'Lead' },
  { status: 'PROPOSAL_SENT', label: 'Proposal' },
  { status: 'WON', label: 'Won' },
  { status: 'ACTIVE', label: 'Active' },
  { status: 'ON_HOLD', label: 'On Hold' },
  { status: 'REVIEW', label: 'Review' },
  { status: 'COMPLETED', label: 'Completed' },
];

export function ProjectPipeline({ projects }: ProjectPipelineProps) {
  const grouped = useMemo(() => {
    const map: Record<string, Project[]> = {};
    for (const col of PIPELINE_COLUMNS) {
      map[col.status] = [];
    }
    for (const p of projects) {
      if (map[p.status] !== undefined) {
        map[p.status].push(p);
      }
    }
    return map;
  }, [projects]);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-4 min-w-max">
        {PIPELINE_COLUMNS.map((col, idx) => {
          const colProjects = grouped[col.status] ?? [];
          return (
            <motion.div
              key={col.status}
              className="flex-shrink-0 w-72 flex flex-col gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.05 }}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  {col.label}
                </span>
                <span className="text-xs text-zinc-500 font-mono tabular-nums bg-surface-muted px-1.5 py-0.5 rounded">
                  {colProjects.length}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {colProjects.length === 0 ? (
                  <div className="h-20 flex items-center justify-center rounded-lg border border-dashed border-surface-border">
                    <span className="text-xs text-zinc-600">No projects</span>
                  </div>
                ) : (
                  colProjects.map((p) => <ProjectCard key={p.id} project={p} />)
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
