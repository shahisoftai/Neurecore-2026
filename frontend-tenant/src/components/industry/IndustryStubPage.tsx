'use client';

/**
 * IndustryStubPage — generic placeholder page for industry-specific workspace
 * routes (per INDUSTRY-GROUPS-CONCEPT.md §8.3).
 *
 * These stubs exist so the IconRail links don't 404. Real implementations
 * land in later phases.
 */

import { motion } from 'framer-motion';
import { Construction, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export interface IndustryStubPageProps {
  title: string;
  description: string;
  industryGroup: string;
  plannedPhase: string;
}

export function IndustryStubPage({
  title,
  description,
  industryGroup,
  plannedPhase,
}: IndustryStubPageProps) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href="/home"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Home
      </Link>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="rounded-xl border border-dashed border-surface-border bg-surface-raised/50 p-8 text-center space-y-4"
      >
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
            <Construction className="w-6 h-6 text-accent" />
          </div>
        </div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
        <div className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          <span>Industry Group: <strong className="text-foreground">{industryGroup}</strong></span>
          <span aria-hidden="true">·</span>
          <span>Planned: <strong className="text-foreground">{plannedPhase}</strong></span>
        </div>
      </motion.div>
    </div>
  );
}
