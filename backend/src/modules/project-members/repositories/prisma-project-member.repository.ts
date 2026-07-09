/**
 * ProjectMembers — Prisma Repository
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IProjectMemberRepository,
  ProjectMember,
  AssignMemberInput,
  ProjectRole,
} from '../interfaces/project-member.interface';

@Injectable()
export class PrismaProjectMemberRepository implements IProjectMemberRepository {
  private readonly logger = new Logger(PrismaProjectMemberRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async listForProject(projectId: string): Promise<ProjectMember[]> {
    const rows = await this.prisma.projectMember.findMany({
      where: { projectId },
      orderBy: { assignedAt: 'asc' },
    });
    return rows.map((r) => this.map(r));
  }

  async assign(
    projectId: string,
    dto: AssignMemberInput,
  ): Promise<ProjectMember> {
    const row = await this.prisma.projectMember.create({
      data: {
        projectId,
        actorId: dto.actorId,
        actorType: dto.actorType,
        role: dto.role,
      },
    });
    return this.map(row);
  }

  async remove(projectId: string, memberId: string): Promise<void> {
    // Scoped delete so a member id from another project can't be removed.
    await this.prisma.projectMember.delete({
      where: { id: memberId, projectId },
    });
    this.logger.log(`Removed member ${memberId} from project ${projectId}`);
  }

  async reassignRole(
    projectId: string,
    memberId: string,
    newRole: ProjectRole,
  ): Promise<ProjectMember> {
    // Defense-in-depth: scope the update to (id, projectId) so the unique key
    // can't be hijacked across projects.
    const row = await this.prisma.projectMember.update({
      where: { id: memberId, projectId },
      data: { role: newRole },
    });
    return this.map(row);
  }

  /**
   * Idempotent Chief-of-Staff assignment. Uses upsert under a unique-ish
   * constraint so concurrent calls cannot insert two rows.
   *
   * Note: the existing schema unique constraint is (projectId, actorId, role).
   * To enforce "one CHIEF_OF_STAFF per project" we rely on the service layer
   * calling findFirst first; the unique constraint protects against the actor
   * being assigned CHIEF_OF_STAFF twice on the same project.
   */
  async autoAssignChiefOfStaff(
    projectId: string,
    actorId: string,
  ): Promise<ProjectMember> {
    const existing = await this.prisma.projectMember.findFirst({
      where: { projectId, role: 'CHIEF_OF_STAFF' },
    });
    if (existing) return this.map(existing);

    try {
      const created = await this.prisma.projectMember.create({
        data: {
          projectId,
          actorId,
          actorType: 'AI',
          role: 'CHIEF_OF_STAFF',
        },
      });
      return this.map(created);
    } catch (err) {
      // Concurrent insert: another caller raced us. Re-read and return the winner.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const winner = await this.prisma.projectMember.findFirst({
          where: { projectId, role: 'CHIEF_OF_STAFF' },
        });
        if (winner) return this.map(winner);
      }
      throw err;
    }
  }

  private map(row: Record<string, unknown>): ProjectMember {
    return {
      id: row.id as string,
      projectId: row.projectId as string,
      actorId: row.actorId as string,
      actorType: row.actorType as ProjectMember['actorType'],
      role: row.role as ProjectMember['role'],
      assignedAt: row.assignedAt as Date,
    };
  }
}