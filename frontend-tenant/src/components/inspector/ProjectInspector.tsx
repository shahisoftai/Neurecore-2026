'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ExternalLink, Trash2, Workflow, Target, Package, CheckSquare, BookOpen } from 'lucide-react';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { HealthBadge, HealthScoreBar, SignalRow } from '@/components/creatio/HealthBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { projectsService } from '@/services/projects.service';
import type {
  Project,
  ProjectStage,
  ProjectMember,
  ProjectStatus,
} from '@/services/projects.service';
import { customersService } from '@/services/customers.service';
import type { Customer } from '@/types/customers.types';
import { goalsService, type Goal } from '@/services/goals.service';
import { deliverablesService, type Deliverable } from '@/services/deliverables.service';
import type { ApprovalWorkflow } from '@/services/approval-chains.service';
import { projectMemoryService, type ProjectMemory } from '@/services/project-memory.service';
import { projectDecisionsService, type ProjectDecision } from '@/services/project-decisions.service';
import { projectHealthService, type ProjectHealth } from '@/services/project-health.service';
import { PROJECT_STATUS_TRANSITIONS } from '@/components/projects/constants';

import { TransitionModal } from '@/components/projects/TransitionModal';
import { StagesModal } from '@/components/projects/StagesModal';
import { TeamModal } from '@/components/projects/TeamModal';
import { GoalsModal } from '@/components/projects/GoalsModal';
import { DeliverablesModal } from '@/components/projects/DeliverablesModal';
import { ApprovalsModal } from '@/components/projects/ApprovalsModal';
import { KnowledgeModal } from '@/components/projects/KnowledgeModal';

export function ProjectInspector({ id }: { id: string }) {
  const [p, setP] = useState<Project | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [stagesOpen, setStagesOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [deliverablesOpen, setDeliverablesOpen] = useState(false);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalWorkflow[]>([]);
  const [memories, setMemories] = useState<ProjectMemory[]>([]);
  const [decisions, setDecisions] = useState<ProjectDecision[]>([]);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [health, setHealth] = useState<ProjectHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const project = await projectsService.get(id);
      setP(project);
      if (project?.customerId) {
        const c = await customersService.get(project.customerId);
        setCustomer(c);
      } else {
        setCustomer(null);
      }
      const [s, m, g, d, mem, dec] = await Promise.all([
        projectsService.listStages(id),
        projectsService.listMembers(id),
        goalsService.getByProject(id),
        deliverablesService.getByProject(id),
        projectMemoryService.list({ projectId: id }),
        projectDecisionsService.list({ projectId: id }),
      ]);
      setStages(s);
      setMembers(m);
      setGoals(g);
      setDeliverables(d);
      setMemories(mem.items);
      setDecisions(dec.items);
    } catch {
      setP(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setHealthLoading(true);
    projectHealthService
      .getHealth(id)
      .then((h) => { if (h && Array.isArray(h.signals)) setHealth(h); })
      .catch(() => { /* health is optional */ })
      .finally(() => setHealthLoading(false));
  }, [id]);

  const remove = async () => {
    if (!confirm('Delete this project?')) return;
    await projectsService.delete(id);
    void load();
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-4 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-surface-muted rounded"
            style={{ width: `${55 + i * 8}%` }}
          />
        ))}
      </div>
    );
  }

  if (!p) return <div className="p-6 text-zinc-500 text-sm">Project not found.</div>;

  const allowedTransitions = PROJECT_STATUS_TRANSITIONS[p.status] ?? [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 flex flex-col gap-5"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-zinc-100 leading-tight flex-1">
            {p.name}
          </h2>
          <Link
            href={`/departments?tab=projects&projectId=${p.id}`}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-muted text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Open full page"
            aria-label="Open full page"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StatusBadge status={p.status} />
          {p.priority && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-zinc-400 border border-surface-border uppercase tracking-wide">
              {p.priority}
            </span>
          )}
          {p.targetDate && (
            <span className="text-xs text-zinc-500">
              Due: {new Date(p.targetDate).toLocaleDateString()}
            </span>
          )}
        </div>
        {p.description && (
          <p className="text-xs text-zinc-400 mt-2">{p.description}</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-zinc-500">Health</p>
          <button
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            onClick={async () => {
              const h = await projectHealthService.recalculateHealth(id);
              setHealth(h);
            }}
            title="Recalculate health score"
          >
            Refresh
          </button>
        </div>
        <div className="space-y-2">
          <HealthBadge
            health={health}
            loading={healthLoading}
            onRecalculate={async () => {
              setHealthLoading(true);
              try {
                const h = await projectHealthService.recalculateHealth(id);
                if (h && Array.isArray(h.signals)) setHealth(h);
              } finally {
                setHealthLoading(false);
              }
            }}
          />
          {health && Array.isArray(health.signals) && (
            <>
              <HealthScoreBar health={health} />
              <div className="space-y-1">
                {health.signals.map((s) => (
                  <SignalRow key={s.name} signal={s} />
                ))}
              </div>
              {health.atRiskReasons.length > 0 && (
                <div className="space-y-1">
                  {health.atRiskReasons.map((reason, i) => (
                    <p key={i} className="text-[10px] text-state-danger/70 italic">
                      • {reason}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {customer && (
        <div>
          <p className="text-xs text-zinc-500 mb-1">Customer</p>
          <Link
            href={`/customers/${customer.id}`}
            className="text-sm font-medium text-zinc-200 hover:text-primary"
          >
            {customer.name}
          </Link>
        </div>
      )}

      {(p.budgetType || p.budgetAmount != null) && (
        <div>
          <p className="text-xs text-zinc-500 mb-1">Budget</p>
          <p className="text-sm text-zinc-200">
            {p.budgetType ? prettyBudgetType(p.budgetType) : '—'}
            {p.budgetAmount != null && (
              <span className="ml-2 text-zinc-400">
                {p.budgetAmount.toLocaleString()} {p.budgetCurrency ?? 'USD'}
              </span>
            )}
          </p>
        </div>
      )}

      {p.goalIds && p.goalIds.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">Linked Goals</p>
          <div className="flex flex-wrap gap-1.5">
            {p.goalIds.map((g) => (
              <Link
                key={g}
                href={`/departments?tab=goals&goalId=${g}`}
                className="text-xs px-2 py-1 rounded bg-surface text-zinc-300 border border-surface-border hover:bg-surface-overlay"
              >
                {g.slice(0, 8)}…
              </Link>
            ))}
          </div>
        </div>
      )}

      <Row label="Created" value={new Date(p.createdAt).toLocaleString()} />

      {stages.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-1.5">Stages</p>
          <div className="space-y-1">
            {stages.slice(0, 4).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-zinc-300 truncate flex-1">{s.name}</span>
                <StatusBadge status={s.status} />
              </div>
            ))}
            {stages.length > 4 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setStagesOpen(true)}
              >
                Show all {stages.length} stages
              </button>
            )}
          </div>
        </div>
      )}

      {members.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-1.5">Team</p>
          <div className="space-y-1">
            {members.slice(0, 3).map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-zinc-300">
                  {m.role.replace(/_/g, ' ')}
                </span>
                <span className="text-zinc-500 text-[10px]">
                  {m.actorType} · {m.actorId.slice(0, 6)}
                </span>
              </div>
            ))}
            {members.length > 3 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setTeamOpen(true)}
              >
                Show all {members.length} members
              </button>
            )}
          </div>
        </div>
      )}

      {goals.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-1.5">Goals</p>
          <div className="space-y-2">
            {goals.slice(0, 3).map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-zinc-300 truncate flex-1">{g.title}</span>
                <span className="text-zinc-500 font-mono w-10 text-right">
                  {g.progress ?? 0}%
                </span>
              </div>
            ))}
            {goals.length > 3 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setGoalsOpen(true)}
              >
                Show all {goals.length} goals
              </button>
            )}
          </div>
        </div>
      )}

      {deliverables.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-1.5">Deliverables</p>
          <div className="space-y-1">
            {deliverables.slice(0, 3).map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-zinc-300 truncate flex-1">{d.name}</span>
                <StatusBadge status={d.status} />
              </div>
            ))}
            {deliverables.length > 3 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setDeliverablesOpen(true)}
              >
                Show all {deliverables.length} deliverables
              </button>
            )}
          </div>
        </div>
      )}

      {memories.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-1.5">Memory</p>
          <div className="space-y-1">
            {memories.slice(0, 2).map((m) => (
              <div key={m.id} className="flex items-start gap-2 text-xs">
                <span className="text-[10px] px-1 py-0.5 rounded bg-surface-muted text-zinc-400 uppercase shrink-0 mt-0.5">
                  {m.category}
                </span>
                <span className="text-zinc-300 line-clamp-1">{m.content}</span>
              </div>
            ))}
            {memories.length > 2 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setKnowledgeOpen(true)}
              >
                +{memories.length - 2} more
              </button>
            )}
          </div>
        </div>
      )}

      {decisions.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-1.5">Decisions</p>
          <div className="space-y-1">
            {decisions.slice(0, 2).map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-zinc-300 truncate flex-1">{d.title}</span>
                <StatusBadge status={d.status} />
              </div>
            ))}
            {decisions.length > 2 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setKnowledgeOpen(true)}
              >
                +{decisions.length - 2} more
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2 border-t border-surface-border">
        {allowedTransitions.length > 0 && (
          <ActionButton
            variant="secondary"
            size="md"
            onClick={() => setTransitionOpen(true)}
            icon={<Workflow className="w-3.5 h-3.5" />}
          >
            Transition Status
          </ActionButton>
        )}
        <ActionButton
          variant="ghost"
          size="md"
          onClick={() => setStagesOpen(true)}
        >
          Manage Stages ({stages.length})
        </ActionButton>
        <ActionButton
          variant="ghost"
          size="md"
          onClick={() => setTeamOpen(true)}
        >
          Manage Team ({members.length})
        </ActionButton>
        <ActionButton
          variant="ghost"
          size="md"
          onClick={() => setGoalsOpen(true)}
          icon={<Target className="w-3.5 h-3.5" />}
        >
          Goals ({goals.length})
        </ActionButton>
        <ActionButton
          variant="ghost"
          size="md"
          onClick={() => setDeliverablesOpen(true)}
          icon={<Package className="w-3.5 h-3.5" />}
        >
          Deliverables ({deliverables.length})
        </ActionButton>
        <ActionButton
          variant="ghost"
          size="md"
          onClick={() => setApprovalsOpen(true)}
          icon={<CheckSquare className="w-3.5 h-3.5" />}
        >
          Approvals
        </ActionButton>
        <ActionButton
          variant="ghost"
          size="md"
          onClick={() => setKnowledgeOpen(true)}
          icon={<BookOpen className="w-3.5 h-3.5" />}
        >
          Knowledge ({memories.length + decisions.length})
        </ActionButton>
        <ActionButton
          variant="danger"
          size="md"
          icon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={remove}
        >
          Delete
        </ActionButton>
      </div>

      <TransitionModal
        open={transitionOpen}
        onClose={() => setTransitionOpen(false)}
        currentStatus={p.status}
        allowed={allowedTransitions}
        onConfirm={async (next, reason) => {
          await projectsService.transitionStatus(id, next, reason);
          setTransitionOpen(false);
          await load();
        }}
      />

      <StagesModal
        open={stagesOpen}
        onClose={() => setStagesOpen(false)}
        projectId={id}
        stages={stages}
        onChanged={async () => {
          const s = await projectsService.listStages(id);
          setStages(s);
        }}
      />

      <TeamModal
        open={teamOpen}
        onClose={() => setTeamOpen(false)}
        projectId={id}
        members={members}
        onChanged={async () => {
          const m = await projectsService.listMembers(id);
          setMembers(m);
        }}
      />

      <GoalsModal
        open={goalsOpen}
        onClose={() => setGoalsOpen(false)}
        projectId={id}
        goals={goals}
        onChanged={async () => {
          const g = await goalsService.getByProject(id);
          setGoals(g);
        }}
      />

      <DeliverablesModal
        open={deliverablesOpen}
        onClose={() => setDeliverablesOpen(false)}
        projectId={id}
        deliverables={deliverables}
        onChanged={async () => {
          const d = await deliverablesService.getByProject(id);
          setDeliverables(d);
        }}
      />

      <ApprovalsModal
        open={approvalsOpen}
        onClose={() => setApprovalsOpen(false)}
        projectId={id}
        deliverables={deliverables}
        approvals={approvals}
        onApprovalsLoaded={setApprovals}
      />

      <KnowledgeModal
        open={knowledgeOpen}
        onClose={() => setKnowledgeOpen(false)}
        projectId={id}
        memories={memories}
        decisions={decisions}
        onMemoriesChanged={async () => {
          const m = await projectMemoryService.list({ projectId: id });
          setMemories(m.items);
        }}
        onDecisionsChanged={async () => {
          const d = await projectDecisionsService.list({ projectId: id });
          setDecisions(d.items);
        }}
      />
    </motion.div>
  );
}

function prettyBudgetType(t: string): string {
  return t === 'FIXED_FEE'
    ? 'Fixed Fee'
    : t === 'HOURLY'
      ? 'Hourly'
      : t === 'RETAINER'
        ? 'Retainer'
        : t;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-300 font-medium">{value}</span>
    </div>
  );
}
