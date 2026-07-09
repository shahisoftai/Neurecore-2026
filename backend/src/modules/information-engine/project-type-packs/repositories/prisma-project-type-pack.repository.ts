/**
 * ProjectTypePack — Prisma Repository (Phase 2B)
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import type {
  IProjectTypePackRepository,
  ProjectTypePackWithPack,
} from '../interfaces/project-type-pack.interface';

@Injectable()
export class PrismaProjectTypePackRepository implements IProjectTypePackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForProjectType(
    projectTypeId: string,
  ): Promise<ProjectTypePackWithPack[]> {
    const links = await this.prisma.projectTypePack.findMany({
      where: { projectTypeId },
      orderBy: [{ sortOrder: 'asc' }],
      include: {
        questionPack: {
          select: {
            id: true,
            key: true,
            name: true,
            description: true,
            questions: true,
            version: true,
            isSystem: true,
          },
        },
      },
    });
    return links.map((l) => ({
      projectTypeId: l.projectTypeId,
      questionPackId: l.questionPackId,
      sortOrder: l.sortOrder,
      questionPack: {
        id: l.questionPack.id,
        key: l.questionPack.key,
        name: l.questionPack.name,
        description: l.questionPack.description,
        questions: Array.isArray(l.questionPack.questions)
          ? l.questionPack.questions
          : [],
        version: l.questionPack.version,
        isSystem: l.questionPack.isSystem,
      },
    }));
  }

  async replaceForProjectType(
    projectTypeId: string,
    links: Array<{ questionPackId: string; sortOrder: number }>,
  ): Promise<ProjectTypePackWithPack[]> {
    await this.prisma.$transaction(async (tx) => {
      await tx.projectTypePack.deleteMany({ where: { projectTypeId } });
      if (links.length === 0) return;
      await tx.projectTypePack.createMany({
        data: links.map((l) => ({
          projectTypeId,
          questionPackId: l.questionPackId,
          sortOrder: l.sortOrder,
        })),
      });
    });
    return this.listForProjectType(projectTypeId);
  }
}
