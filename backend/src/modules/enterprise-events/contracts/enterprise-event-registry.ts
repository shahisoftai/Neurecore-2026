/**
 * Enterprise Event Registry (ADR-001 §9, ADR-011–014)
 *
 * The single source of truth for approved enterprise event types and their
 * current contract version. Publishing an unregistered type, or a version the
 * registry does not know, is rejected before the event enters the outbox
 * (ADR-001 §14 contract validation).
 *
 * Payload keys are documented for producers/consumers. The registry does NOT
 * deep-validate payload shape at runtime beyond required-envelope + presence of
 * declared required keys (kept lightweight; typed contracts live in the ADRs).
 *
 * COGNITIVE-LAYER EVENTS (enterprise.input.received … enterprise.action.decided)
 * are REGISTERED here as frozen contracts per ADR-011–014, but NO Phase-5
 * cognition logic is implemented in Phase 2. They have no producers yet and
 * must NOT be emitted by fake producers to pass tests.
 */

export interface EventContract {
  version: number;
  /** Keys that must be present in payload (lightweight validation). */
  requiredPayloadKeys: string[];
  /** true = frozen contract reserved for a later phase; no producer in Phase 2. */
  reservedForFuturePhase?: boolean;
  description: string;
}

export const ENTERPRISE_EVENT_REGISTRY: Record<string, EventContract> = {
  // ── Projects (Phase 2 producers) ─────────────────────────────────────────
  'enterprise.project.created': {
    version: 1,
    requiredPayloadKeys: ['projectId', 'name'],
    description: 'A project was created.',
  },
  'enterprise.project.status.changed': {
    version: 1,
    requiredPayloadKeys: ['projectId', 'fromStatus', 'toStatus'],
    description: 'A project status transition occurred.',
  },
  'enterprise.project.budget.changed': {
    version: 1,
    requiredPayloadKeys: ['projectId', 'previousAmount', 'newAmount', 'currency'],
    description: 'A project budget amount changed (triggered by ProjectsService.update).',
  },
  'enterprise.project.timeline.changed': {
    version: 1,
    requiredPayloadKeys: ['projectId'],
    description: 'A project timeline (start/target date) changed.',
  },

  // ── EIE (Phase 2 producers) ──────────────────────────────────────────────
  'enterprise.eie.response.recorded': {
    version: 1,
    requiredPayloadKeys: ['entityType', 'entityId', 'questionId'],
    description: 'An information response was recorded/updated/superseded.',
  },
  'enterprise.eie.completeness.changed': {
    version: 1,
    requiredPayloadKeys: ['entityType', 'entityId', 'score'],
    description: 'Entity completeness was recomputed.',
  },

  // ── Orchestration / tasks (Phase 2 producer where operational) ───────────
  'enterprise.task.completed': {
    version: 1,
    requiredPayloadKeys: ['taskId', 'status'],
    description: 'A task reached a terminal status.',
  },

  // ── Approvals (contracts; producers only where currently functional) ─────
  'enterprise.approval.requested': {
    version: 1,
    requiredPayloadKeys: ['approvalId', 'resourceType', 'resourceId'],
    description: 'An approval was requested.',
  },
  'enterprise.approval.granted': {
    version: 1,
    requiredPayloadKeys: ['approvalId', 'resourceType', 'resourceId'],
    description: 'An approval was granted.',
  },
  'enterprise.approval.rejected': {
    version: 1,
    requiredPayloadKeys: ['approvalId', 'resourceType', 'resourceId'],
    description: 'An approval was rejected or returned for revision.',
  },

  // ── Finance (Phase 8 — Project-Finance Integration, ADR-007) ───────────────
  'enterprise.finance.threshold.exceeded': {
    version: 1,
    requiredPayloadKeys: [
      'policyId',
      'projectId',
      'threshold',
      'currentSpendCents',
      'limitCents',
    ],
    description:
      'A project-scoped or tenant-scoped budget threshold was breached. ' +
      'Emitted by CostsService.checkBudgetThresholds when utilization crosses ' +
      'an alert threshold defined on a BudgetPolicy. ProjectId may be null for ' +
      'tenant-level policies.',
  },

  // ── Workspace / Calendar (contracts; producers OUT OF PHASE) ─────────────
  'enterprise.customer.communication.received': {
    version: 1,
    requiredPayloadKeys: ['communicationId', 'channel'],
    reservedForFuturePhase: true,
    description: 'Inbound customer communication (Google WS / Comms — Phase 10).',
  },
  'enterprise.workspace.document.created': {
    version: 1,
    requiredPayloadKeys: ['documentId', 'mimeType'],
    reservedForFuturePhase: true,
    description: 'A workspace document was created (Google WS — Phase 10).',
  },
  'enterprise.calendar.event.scheduled': {
    version: 1,
    requiredPayloadKeys: ['eventId', 'startTime'],
    reservedForFuturePhase: true,
    description: 'A calendar event was scheduled (Google WS — Phase 10).',
  },

  // ── Work Runtime (contracts; producers Phase 4/6) ────────────────────────
  'enterprise.work.requested': {
    version: 1,
    requiredPayloadKeys: ['workId', 'workType'],
    reservedForFuturePhase: true,
    description: 'Work was requested (Work Runtime — Phase 4/6).',
  },
  'enterprise.work.response.delivered': {
    version: 1,
    requiredPayloadKeys: ['workId', 'responseType'],
    reservedForFuturePhase: true,
    description: 'A work response was delivered (Work Runtime — Phase 4/6).',
  },

  // ── Work Runtime (Phase 4 lifecycle events) ─────────────────────────────
  'enterprise.workrun.created': {
    version: 1,
    requiredPayloadKeys: ['runId'],
    description: 'A governed work run was created.',
  },
  'enterprise.workrun.planned': {
    version: 1,
    requiredPayloadKeys: ['runId'],
    description: 'A work run produced a validated plan.',
  },
  'enterprise.workrun.started': {
    version: 1,
    requiredPayloadKeys: ['runId'],
    description: 'A work run started execution.',
  },
  'enterprise.workrun.step.started': {
    version: 1,
    requiredPayloadKeys: ['runId', 'stepId'],
    description: 'A work run step started.',
  },
  'enterprise.workrun.step.succeeded': {
    version: 1,
    requiredPayloadKeys: ['runId', 'stepId'],
    description: 'A work run step succeeded.',
  },
  'enterprise.workrun.step.failed': {
    version: 1,
    requiredPayloadKeys: ['runId', 'stepId'],
    description: 'A work run step failed.',
  },
  'enterprise.workrun.approval.requested': {
    version: 1,
    requiredPayloadKeys: ['runId', 'stepId', 'approvalId'],
    description: 'A work run step requires approval.',
  },
  'enterprise.workrun.paused': {
    version: 1,
    requiredPayloadKeys: ['runId'],
    description: 'A work run paused (awaiting approval or retry).',
  },
  'enterprise.workrun.resumed': {
    version: 1,
    requiredPayloadKeys: ['runId'],
    description: 'A work run resumed.',
  },
  'enterprise.workrun.completed': {
    version: 1,
    requiredPayloadKeys: ['runId'],
    description: 'A work run completed.',
  },
  'enterprise.workrun.failed': {
    version: 1,
    requiredPayloadKeys: ['runId'],
    description: 'A work run failed.',
  },
  'enterprise.workrun.cancelled': {
    version: 1,
    requiredPayloadKeys: ['runId'],
    description: 'A work run was cancelled.',
  },

  // ── Enterprise Cognition (Phase 5 — reasoning/coordination; NOT execution) ──
  'enterprise.cognition.started': {
    version: 1,
    requiredPayloadKeys: ['requestId'],
    description: 'A cognitive reasoning request started.',
  },
  'enterprise.cognition.completed': {
    version: 1,
    requiredPayloadKeys: ['requestId'],
    description: 'A cognitive reasoning request completed (recommendations produced).',
  },
  'enterprise.cognition.failed': {
    version: 1,
    requiredPayloadKeys: ['requestId'],
    description: 'A cognitive reasoning request failed.',
  },
  'enterprise.recommendation.created': {
    version: 1,
    requiredPayloadKeys: ['requestId', 'recommendationId'],
    description: 'An enterprise recommendation was created (advisory; not executed).',
  },
  'enterprise.recommendation.accepted': {
    version: 1,
    requiredPayloadKeys: ['recommendationId'],
    description: 'A recommendation was accepted by an actor.',
  },
  'enterprise.recommendation.rejected': {
    version: 1,
    requiredPayloadKeys: ['recommendationId'],
    description: 'A recommendation was rejected by an actor.',
  },
  'enterprise.goal.decomposed': {
    version: 1,
    requiredPayloadKeys: ['requestId', 'objectiveId'],
    description: 'An objective was decomposed into goals.',
  },
  'enterprise.specialist.assigned': {
    version: 1,
    requiredPayloadKeys: ['requestId', 'role'],
    description: 'A specialist AI employee was convened for reasoning.',
  },

  // ── Enterprise Autonomous Operations (Phase 6 — governed autonomy) ──
  'enterprise.mission.created': {
    version: 1, requiredPayloadKeys: ['missionId'],
    description: 'A governed mission was created.',
  },
  'enterprise.mission.assigned': {
    version: 1, requiredPayloadKeys: ['missionId'],
    description: 'A mission was assigned/planned.',
  },
  'enterprise.mission.completed': {
    version: 1, requiredPayloadKeys: ['missionId'],
    description: 'A mission completed or was cancelled.',
  },
  'enterprise.observation.created': {
    version: 1, requiredPayloadKeys: ['watcher'],
    description: 'An autonomous watcher produced an observation (observes only; never executes).',
  },
  'enterprise.escalation.created': {
    version: 1, requiredPayloadKeys: ['missionId', 'fromLevel', 'toLevel'],
    description: 'A mission escalation was recorded.',
  },
  'enterprise.employee.created': {
    version: 1, requiredPayloadKeys: ['employeeId'],
    description: 'An AI employee was created.',
  },
  'enterprise.department.created': {
    version: 1, requiredPayloadKeys: ['departmentId'],
    description: 'An AI department was created.',
  },
  'enterprise.health.updated': {
    version: 1, requiredPayloadKeys: ['enterprise'],
    description: 'Enterprise health was computed.',
  },

  // ── Enterprise Operating System (Phase 7 — digital twin / simulation / optimization) ──
  'enterprise.digital_twin.updated': { version: 1, requiredPayloadKeys: ['snapshotId'], description: 'Digital twin snapshot was computed.' },
  'enterprise.simulation.completed': { version: 1, requiredPayloadKeys: ['scenarioId'], description: 'A deterministic simulation completed (never mutates production).' },
  'enterprise.forecast.generated': { version: 1, requiredPayloadKeys: [], description: 'Enterprise forecast was generated.' },
  'enterprise.optimization.completed': { version: 1, requiredPayloadKeys: [], description: 'Optimization recommendations were produced.' },
  'enterprise.strategy.updated': { version: 1, requiredPayloadKeys: [], description: 'Strategy monitor completed drift assessment.' },
  'enterprise.executive.summary.generated': { version: 1, requiredPayloadKeys: [], description: 'Executive advisor summary was generated.' },
  'enterprise.performance.updated': { version: 1, requiredPayloadKeys: [], description: 'Enterprise performance index was computed.' },
  'enterprise.resilience.updated': { version: 1, requiredPayloadKeys: [], description: 'Resilience assessment was completed.' },
  'enterprise.analytics.generated': { version: 1, requiredPayloadKeys: [], description: 'Enterprise analytics snapshot was produced.' },

  // ── Platform Operations (Phase 8 — operational events) ──────
  'platform.health.updated': { version: 1, requiredPayloadKeys: [], description: 'Platform health was assessed.' },
  'platform.audit.exported': { version: 1, requiredPayloadKeys: ['checksum'], description: 'An audit export was produced (tamper-evident).' },
  'platform.security.alert': { version: 1, requiredPayloadKeys: [], description: 'A security assessment finding was recorded.' },
  'platform.incident.resolved': { version: 1, requiredPayloadKeys: [], description: 'An operational incident was resolved.' },
  'platform.backup.completed': { version: 1, requiredPayloadKeys: [], description: 'A backup verification completed.' },
  'platform.deployment.completed': { version: 1, requiredPayloadKeys: [], description: 'A deployment completed.' },

  // ── Enterprise Intelligence Network (Phase 9 — knowledge graph events) ──
  'enterprise.knowledge.updated': { version: 1, requiredPayloadKeys: [], description: 'Knowledge graph was refreshed.' },
  'enterprise.graph.rebuilt': { version: 1, requiredPayloadKeys: [], description: 'Knowledge graph was rebuilt from Context Plane.' },
  'enterprise.relationship.created': { version: 1, requiredPayloadKeys: ['relationshipKind'], description: 'A new relationship was inferred in the knowledge graph.' },
  'enterprise.semantic.index.updated': { version: 1, requiredPayloadKeys: [], description: 'Semantic search index was updated.' },

  // ── Platform SDK (Phase 10 — extension lifecycle events) ──
  'platform.plugin.installed': { version: 1, requiredPayloadKeys: ['pluginId'], description: 'A plugin was installed.' },
  'platform.plugin.enabled': { version: 1, requiredPayloadKeys: ['pluginId'], description: 'A plugin was enabled.' },
  'platform.extension.validated': { version: 1, requiredPayloadKeys: ['pluginId'], description: 'An extension passed validation.' },

  // ── Cloud Platform (Phase 11 — global federation events) ──
  'cloud.region.available': { version: 1, requiredPayloadKeys: ['region'], description: 'A cloud region became available.' },
  'cloud.region.unavailable': { version: 1, requiredPayloadKeys: ['region'], description: 'A cloud region went offline.' },
  'cloud.failover.completed': { version: 1, requiredPayloadKeys: ['from', 'to'], description: 'A regional failover completed.' },
  'cloud.tenant.migrated': { version: 1, requiredPayloadKeys: ['tenantId'], description: 'A tenant was migrated to a new region.' },
  'cloud.routing.updated': { version: 1, requiredPayloadKeys: [], description: 'Global routing table was updated.' },

  // ── Application Framework (Phase 12 — application lifecycle) ──
  'application.installed': { version: 1, requiredPayloadKeys: ['appId'], description: 'An enterprise application was installed.' },
  'application.activated': { version: 1, requiredPayloadKeys: ['appId'], description: 'An enterprise application was activated.' },
  'application.catalog.updated': { version: 1, requiredPayloadKeys: [], description: 'The application catalog was updated.' },

  // ── AI Governance (Phase 13 — trust, hallucination, policy events) ──
  'ai.trust.evaluated': { version: 1, requiredPayloadKeys: ['sourceType'], description: 'An AI trust evaluation was performed.' },
  'ai.hallucination.detected': { version: 1, requiredPayloadKeys: ['sourceType'], description: 'A potential hallucination was flagged.' },
  'ai.bias.detected': { version: 1, requiredPayloadKeys: ['category'], description: 'A bias finding was recorded.' },
  'ai.policy.updated': { version: 1, requiredPayloadKeys: ['policyId'], description: 'An AI policy was created or updated.' },
  'ai.review.requested': { version: 1, requiredPayloadKeys: ['reviewId'], description: 'A human review was requested.' },
  'ai.review.completed': { version: 1, requiredPayloadKeys: ['reviewId'], description: 'A human review was completed.' },

  // ── Platform Evolution (Phase 14 — technology evolution events) ──
  'evolution.model.registered': { version: 1, requiredPayloadKeys: ['modelName'], description: 'A model was registered in the evolution registry.' },
  'evolution.benchmark.completed': { version: 1, requiredPayloadKeys: ['task'], description: 'A benchmark was recorded.' },
  'evolution.experiment.completed': { version: 1, requiredPayloadKeys: ['experimentId'], description: 'An experiment completed.' },
  'evolution.feature.lifecycle.updated': { version: 1, requiredPayloadKeys: ['featureId'], description: 'A feature lifecycle state changed.' },
  'evolution.migration.generated': { version: 1, requiredPayloadKeys: ['planId'], description: 'A migration plan was generated.' },

  // ── Enterprise Cognitive Layer (frozen contracts; NO Phase-2 logic) ──────
  'enterprise.input.received': {
    version: 1,
    requiredPayloadKeys: ['inputId', 'channel'],
    reservedForFuturePhase: true,
    description: 'ADR-011: an enterprise input was received (future intake phase).',
  },
  'enterprise.understanding.formed': {
    version: 1,
    requiredPayloadKeys: ['understandingId'],
    reservedForFuturePhase: true,
    description: 'ADR-011: enterprise understanding formed (Phase 5).',
  },
  'enterprise.recommendation.proposed': {
    version: 1,
    requiredPayloadKeys: ['understandingId'],
    reservedForFuturePhase: true,
    description: 'ADR-013: recommendations proposed (Phase 5).',
  },
  'enterprise.decision.planned': {
    version: 1,
    requiredPayloadKeys: ['planId', 'understandingId'],
    reservedForFuturePhase: true,
    description: 'ADR-014: a decision plan was formed (Phase 5).',
  },
  'enterprise.plan.decided': {
    version: 1,
    requiredPayloadKeys: ['planId'],
    reservedForFuturePhase: true,
    description: 'ADR-014: a plan decision was recorded (Phase 5).',
  },
  'enterprise.action.decided': {
    version: 1,
    requiredPayloadKeys: ['actionId'],
    reservedForFuturePhase: true,
    description: 'ADR-013: an action decision was recorded (Phase 5).',
  },
};

export function getEventContract(eventType: string): EventContract | undefined {
  return ENTERPRISE_EVENT_REGISTRY[eventType];
}

export function isRegisteredEventType(eventType: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    ENTERPRISE_EVENT_REGISTRY,
    eventType,
  );
}
