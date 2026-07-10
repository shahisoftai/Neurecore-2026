import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  PROJECT_AUTOMATION_REPOSITORY,
  type IProjectAutomationRepository,
  type CreateAutomationLogInput,
  type ProjectAutomationLog,
} from './project-automation.interface';
import { AutomationEventType, AutomationStatus } from '@prisma/client';

@Injectable()
export class PrismaProjectAutomationRepository implements IProjectAutomationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAutomationLogInput): Promise<ProjectAutomationLog> {
    return this.prisma.projectAutomationLog.create({
      data: {
        projectId: input.projectId,
        event: input.event as AutomationEventType,
        triggeredBy: input.triggeredBy ?? null,
        status: 'PENDING',
      },
    }) as unknown as ProjectAutomationLog;
  }

  async updateResult(
    id: string,
    result: Record<string, unknown>,
  ): Promise<ProjectAutomationLog> {
    return this.prisma.projectAutomationLog.update({
      where: { id },
      data: { status: 'COMPLETED' as AutomationStatus, result: result as never },
    }) as unknown as ProjectAutomationLog;
  }

  async updateError(id: string, error: string): Promise<ProjectAutomationLog> {
    return this.prisma.projectAutomationLog.update({
      where: { id },
      data: { status: 'FAILED' as AutomationStatus, error },
    }) as unknown as ProjectAutomationLog;
  }

  async findByProjectId(projectId: string): Promise<ProjectAutomationLog[]> {
    return this.prisma.projectAutomationLog.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    }) as unknown as ProjectAutomationLog[];
  }

  async findLatest(projectId: string): Promise<ProjectAutomationLog | null> {
    const row = await this.prisma.projectAutomationLog.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return row as ProjectAutomationLog | null;
  }
}
