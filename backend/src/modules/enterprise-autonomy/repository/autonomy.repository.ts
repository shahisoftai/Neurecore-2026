/**
 * AutonomyRepository — durable persistence for AI employees, departments,
 * missions, observations (Phase 6). Tenant-scoped; optimistic concurrency on
 * mission.version. The ONLY autonomy file that touches Prisma (for its OWN
 * tables) — orchestration/watchers/managers-logic never import Prisma elsewhere.
 */

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  CreateEmployeeInput,
  CreateMissionInput,
  MissionStatus,
  Observation,
} from '../contracts/enterprise-autonomy.interface';

@Injectable()
export class AutonomyRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Departments ──
  createDepartment(tenantId: string, name: string, supervisorEmployeeId?: string) {
    return this.prisma.aiDepartment.create({
      data: { tenantId, name, supervisorEmployeeId: supervisorEmployeeId ?? null },
    });
  }
  listDepartments(tenantId: string) {
    return this.prisma.aiDepartment.findMany({
      where: { tenantId },
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
  }

  // ── Employees ──
  createEmployee(input: CreateEmployeeInput) {
    return this.prisma.aiEmployee.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        role: input.role,
        departmentId: input.departmentId ?? null,
        supervisorEmployeeId: input.supervisorEmployeeId ?? null,
        authorityCeiling: input.authorityCeiling ?? 50,
        allowedTools: input.allowedTools ?? [],
        knowledgeDomains: input.knowledgeDomains ?? [],
        responsibilities: input.responsibilities ?? [],
      },
    });
  }
  findEmployee(id: string, tenantId: string) {
    return this.prisma.aiEmployee.findFirst({ where: { id, tenantId } });
  }
  listEmployees(tenantId: string, departmentId?: string) {
    return this.prisma.aiEmployee.findMany({
      where: { tenantId, ...(departmentId ? { departmentId } : {}) },
      orderBy: { name: 'asc' },
    });
  }
  async adjustWorkload(id: string, tenantId: string, delta: number) {
    await this.prisma.aiEmployee.updateMany({
      where: { id, tenantId },
      data: { currentWorkload: { increment: delta }, availability: delta > 0 ? 'BUSY' : 'AVAILABLE' },
    });
  }

  // ── Missions ──
  createMission(input: CreateMissionInput) {
    return this.prisma.mission.create({
      data: {
        tenantId: input.tenantId,
        createdById: input.createdById,
        title: input.title,
        description: input.description ?? null,
        objective: input.objective,
        priority: input.priority ?? 'MEDIUM',
        departmentId: input.departmentId ?? null,
        status: 'CREATED',
      },
    });
  }
  findMission(id: string, tenantId: string) {
    return this.prisma.mission.findFirst({ where: { id, tenantId } });
  }
  listMissions(tenantId: string) {
    return this.prisma.mission.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
  /** Optimistic-concurrency mission update. */
  async updateMission(
    id: string, tenantId: string, expectedVersion: number,
    data: Partial<{ status: MissionStatus; priority: string; assignedEmployeeId: string | null; planJson: Record<string, unknown>; workRunIds: string[]; escalationLevel: number; failureReason: string; plannedAt: Date; assignedAt: Date; startedAt: Date; completedAt: Date; cancelledAt: Date }>,
  ): Promise<boolean> {
    const res = await this.prisma.mission.updateMany({
      where: { id, tenantId, version: expectedVersion },
      data: {
        ...data,
        planJson: data.planJson ? (data.planJson as Prisma.InputJsonValue) : undefined,
        version: { increment: 1 },
      } as Prisma.MissionUpdateManyMutationInput,
    });
    return res.count === 1;
  }

  // ── Observations ──
  createObservation(o: Observation, missionId?: string) {
    return this.prisma.missionObservation.create({
      data: {
        tenantId: o.tenantId,
        missionId: missionId ?? null,
        watcher: o.watcher,
        observation: o.observation,
        evidenceJson: o.evidence as unknown as Prisma.InputJsonValue,
        severity: o.severity,
        confidence: o.confidence,
        affectedDepartments: o.affectedDepartments,
        affectedProjects: o.affectedProjects,
        recommendedAction: o.recommendedAction,
        requiresRuntime: o.requiresRuntime,
        requiresApproval: o.requiresApproval,
      },
    });
  }
  countActiveMissions(tenantId: string) {
    return this.prisma.mission.count({ where: { tenantId, status: { in: ['CREATED', 'PLANNED', 'ASSIGNED', 'RUNNING', 'WAITING', 'ESCALATED'] } } });
  }
}
