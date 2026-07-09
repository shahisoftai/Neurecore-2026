/**
 * ProjectMembers — DTOs
 */

import { IsString, IsIn, IsNotEmpty } from 'class-validator';

export const ACTOR_TYPES = ['HUMAN', 'AI', 'SYSTEM'] as const;
export const PROJECT_ROLES = [
  'PROJECT_DIRECTOR',
  'PROJECT_MANAGER',
  'RESEARCH_LEAD',
  'QUALITY_LEAD',
  'REVIEWER',
  'COMPLIANCE_OFFICER',
  'CLIENT_LIAISON',
  'DOCUMENTATION_LEAD',
  'KNOWLEDGE_MANAGER',
  'CHIEF_OF_STAFF',
] as const;

export class AssignMemberDto {
  @IsString()
  @IsNotEmpty()
  actorId!: string;

  @IsIn(ACTOR_TYPES as unknown as string[])
  actorType!: (typeof ACTOR_TYPES)[number];

  @IsIn(PROJECT_ROLES as unknown as string[])
  role!: (typeof PROJECT_ROLES)[number];
}

export class ReassignMemberDto {
  @IsIn(PROJECT_ROLES as unknown as string[])
  role!: (typeof PROJECT_ROLES)[number];
}

export class AutoAssignChiefOfStaffDto {
  @IsString()
  @IsNotEmpty()
  actorId!: string;
}
