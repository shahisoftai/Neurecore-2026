/**
 * ProjectMembers — Interfaces
 */

export type ActorType = 'HUMAN' | 'AI' | 'SYSTEM';

export type ProjectRole =
  | 'PROJECT_DIRECTOR'
  | 'PROJECT_MANAGER'
  | 'RESEARCH_LEAD'
  | 'QUALITY_LEAD'
  | 'REVIEWER'
  | 'COMPLIANCE_OFFICER'
  | 'CLIENT_LIAISON'
  | 'DOCUMENTATION_LEAD'
  | 'KNOWLEDGE_MANAGER'
  | 'CHIEF_OF_STAFF';

export interface ProjectMember {
  id: string;
  projectId: string;
  actorId: string;
  actorType: ActorType;
  role: ProjectRole;
  assignedAt: Date;
}

export interface AssignMemberInput {
  actorId: string;
  actorType: ActorType;
  role: ProjectRole;
}

export interface IProjectMemberRepository {
  listForProject(projectId: string): Promise<ProjectMember[]>;
  assign(projectId: string, dto: AssignMemberInput): Promise<ProjectMember>;
  remove(projectId: string, memberId: string): Promise<void>;
  reassignRole(
    projectId: string,
    memberId: string,
    newRole: ProjectRole,
  ): Promise<ProjectMember>;
  /**
   * Idempotent auto-assignment of CHIEF_OF_STAFF — returns the existing
   * row if one is already present, otherwise inserts. Safe under concurrent calls.
   */
  autoAssignChiefOfStaff(
    projectId: string,
    actorId: string,
  ): Promise<ProjectMember>;
}

export const PROJECT_MEMBER_REPOSITORY = 'PROJECT_MEMBER_REPOSITORY';
