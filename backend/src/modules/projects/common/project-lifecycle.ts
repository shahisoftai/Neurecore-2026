/**
 * Projects Module — Lifecycle (state machine)
 *
 * Single authoritative source for valid Project status transitions.
 * Used by ProjectsService.transitionStatus to gate writes to Project.status,
 * satisfying the rule "Never direct write Project.status — always use transition()".
 */

export type ProjectStatus =
  | 'LEAD'
  | 'PROPOSAL_SENT'
  | 'WON'
  | 'LOST'
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'REVIEW'
  | 'COMPLETED'
  | 'ARCHIVED';

export const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  LEAD: ['PROPOSAL_SENT'],
  PROPOSAL_SENT: ['WON', 'LOST'],
  WON: ['ACTIVE'],
  LOST: ['ARCHIVED'],
  ACTIVE: ['ON_HOLD', 'REVIEW', 'COMPLETED'],
  ON_HOLD: ['ACTIVE'],
  REVIEW: ['ACTIVE', 'COMPLETED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return PROJECT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function requiresLostReason(to: ProjectStatus): boolean {
  return to === 'LOST';
}
