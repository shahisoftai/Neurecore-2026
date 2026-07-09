'use client';
/**
 * CreateProjectForm — 3-host shell (Phase 2D).
 *
 * Layer 1 — Essentials (essentials fields + custom fields)
 * Layer 2 — Discovery  (Question Engine + CompletenessMeter)
 * Layer 3 — Review     (resolved answers + confirm)
 *
 * Public contract unchanged: same `CreateProjectFormProps` so existing
 * callers (`/projects/new`, `/customers/[id]/projects/new`) keep working.
 */

import { useState } from 'react';
import { projectsService } from '@/services/projects.service';
import { projectTypesService } from '@/services/projectTypes.service';
import { useProjectStore } from '@/stores/projectStore';
import { ProjectCreationEssentials } from './ProjectCreationEssentials';
import { ProjectCreationDiscovery } from './ProjectCreationDiscovery';
import { ProjectCreationReview } from './ProjectCreationReview';

export interface CreateProjectFormProps {
  departmentId?: string;
  customerId?: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

type Step = 'essentials' | 'discovery' | 'review';

export function CreateProjectForm({
  departmentId,
  customerId: initialCustomerId,
  onClose,
  onCreated,
}: CreateProjectFormProps) {
  const [step, setStep] = useState<Step>('essentials');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [projectTypeName, setProjectTypeName] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProject = useProjectStore((s) => s.createProject);
  const fetchCompleteness = useProjectStore((s) => s.fetchCompleteness);

  async function handleEssentialsSubmit(payload: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      // Backwards-compat: payload shape mirrors CreateProjectDto.
      const project = await projectsService.create(
        payload as Parameters<typeof projectsService.create>[0],
      );
      const id = project.id ?? '';
      setProjectId(id);
      setProjectName((project.name as string | undefined) ?? '');
      if (payload.projectTypeId) {
        const pt = await projectTypesService.get(payload.projectTypeId as string);
        setProjectTypeName(pt?.name);
      }
      await createProject(payload as Parameters<typeof projectsService.create>[0]);
      await fetchCompleteness(id);
      setStep('discovery');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="create-project-form" data-step={step}>
      <StepIndicator step={step} />
      {step === 'essentials' ? (
        <ProjectCreationEssentials
          departmentId={departmentId}
          customerId={initialCustomerId}
          onSubmit={handleEssentialsSubmit}
          onCancel={onClose}
          submitting={submitting}
          error={error}
        />
      ) : step === 'discovery' && projectId ? (
        <ProjectCreationDiscovery
          projectId={projectId}
          onSkip={() => setStep('review')}
          onComplete={() => setStep('review')}
          onBack={() => setStep('essentials')}
        />
      ) : projectId ? (
        <ProjectCreationReview
          projectId={projectId}
          projectName={projectName}
          projectTypeName={projectTypeName}
          onConfirm={() => {
            if (projectId) onCreated?.(projectId);
            onClose();
          }}
          onBack={() => setStep('discovery')}
          onEdit={() => setStep('essentials')}
        />
      ) : null}
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: 'essentials', label: '1 · Essentials' },
    { key: 'discovery', label: '2 · Discovery' },
    { key: 'review', label: '3 · Review' },
  ];
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500" data-testid="step-indicator">
      {steps.map((s, i) => (
        <span
          key={s.key}
          className={
            s.key === step ? 'text-indigo-300 font-medium' : 'text-zinc-500'
          }
        >
          {s.label}
          {i < steps.length - 1 ? <span className="mx-1 text-zinc-700">·</span> : null}
        </span>
      ))}
    </div>
  );
}