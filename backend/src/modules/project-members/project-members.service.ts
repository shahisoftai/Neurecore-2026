/**
 * ProjectMembers — Service
 */

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  IProjectMemberRepository,
  ProjectMember,
  AssignMemberInput,
  ProjectRole,
} from './interfaces/project-member.interface';
import { PROJECT_MEMBER_REPOSITORY } from './interfaces/project-member.interface';

@Injectable()
export class ProjectMembersService {
  constructor(
    @Inject(PROJECT_MEMBER_REPOSITORY)
    private readonly repository: IProjectMemberRepository,
    private readonly prisma: PrismaService,
  ) {}

  private async ensureProject(
    projectId: string,
    tenantId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }
  }

  async list(projectId: string, tenantId: string): Promise<ProjectMember[]> {
    await this.ensureProject(projectId, tenantId);
    return this.repository.listForProject(projectId);
  }

  async assign(
    projectId: string,
    tenantId: string,
    dto: AssignMemberInput,
  ): Promise<ProjectMember> {
    if (!dto.actorId || dto.actorId.trim().length === 0) {
      throw new BadRequestException('actorId is required');
    }
    await this.ensureProject(projectId, tenantId);
    try {
      return await this.repository.assign(projectId, {
        ...dto,
        actorId: dto.actorId.trim(),
      });
    } catch (err) {
      // Unique (projectId, actorId, role) violation → user tried to assign
      // the same actor to the same role twice.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `Member with actorId ${dto.actorId} is already assigned to this role on this project`,
        );
      }
      throw err;
    }
  }

  async remove(
    projectId: string,
    tenantId: string,
    memberId: string,
  ): Promise<void> {
    await this.ensureProject(projectId, tenantId);
    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });
    if (!member) throw new NotFoundException(`Member ${memberId} not found`);
    return this.repository.remove(projectId, memberId);
  }

  async reassignRole(
    projectId: string,
    tenantId: string,
    memberId: string,
    newRole: ProjectRole,
  ): Promise<ProjectMember> {
    await this.ensureProject(projectId, tenantId);
    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });
    if (!member) throw new NotFoundException(`Member ${memberId} not found`);
    return this.repository.reassignRole(projectId, memberId, newRole);
  }

  async autoAssignChiefOfStaff(
    projectId: string,
    tenantId: string,
    actorId: string,
  ): Promise<ProjectMember> {
    if (!actorId || actorId.trim().length === 0) {
      throw new BadRequestException('actorId is required');
    }
    await this.ensureProject(projectId, tenantId);
    return this.repository.autoAssignChiefOfStaff(projectId, actorId.trim());
  }
}