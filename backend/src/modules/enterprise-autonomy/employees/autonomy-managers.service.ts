/**
 * AI Employee/Department managers + Autonomy policy engine + Governor (Phase 6).
 * Employees/departments are first-class objects; managers hold no capability
 * business data. The governor gates every autonomous action against declarative
 * policy — fail-safe (DENY / REQUIRE_HUMAN). Autonomous approvals/governance are
 * forbidden; the governor may require human authority but never grants itself
 * capability execution.
 */

import { Injectable } from '@nestjs/common';
import { AutonomyRepository } from '../repository/autonomy.repository';
import type {
  AiDepartmentView,
  AiEmployeeView,
  AutonomyPolicy,
  CreateEmployeeInput,
  Grade,
  GovernorDecision,
  IAIDepartmentManager,
  IAIEmployeeManager,
  IAutonomyGovernor,
  IAutonomyPolicyEngine,
} from '../contracts/enterprise-autonomy.interface';

@Injectable()
export class AiEmployeeManager implements IAIEmployeeManager {
  constructor(private readonly repo: AutonomyRepository) {}
  async create(input: CreateEmployeeInput): Promise<AiEmployeeView> {
    return this.map(await this.repo.createEmployee(input));
  }
  async get(id: string, tenantId: string): Promise<AiEmployeeView | null> {
    const e = await this.repo.findEmployee(id, tenantId);
    return e ? this.map(e) : null;
  }
  async list(tenantId: string, departmentId?: string): Promise<AiEmployeeView[]> {
    return (await this.repo.listEmployees(tenantId, departmentId)).map((e) => this.map(e));
  }
  async adjustWorkload(id: string, tenantId: string, delta: number): Promise<void> {
    await this.repo.adjustWorkload(id, tenantId, delta);
  }
  private map(e: any): AiEmployeeView {
    return {
      id: e.id, tenantId: e.tenantId, name: e.name, role: e.role,
      departmentId: e.departmentId, supervisorEmployeeId: e.supervisorEmployeeId,
      authorityCeiling: e.authorityCeiling, allowedTools: e.allowedTools,
      knowledgeDomains: e.knowledgeDomains, responsibilities: e.responsibilities,
      currentWorkload: e.currentWorkload, availability: e.availability, healthStatus: e.healthStatus as Grade,
    };
  }
}

@Injectable()
export class AiDepartmentManager implements IAIDepartmentManager {
  constructor(private readonly repo: AutonomyRepository) {}
  async create(tenantId: string, name: string, supervisorEmployeeId?: string): Promise<AiDepartmentView> {
    const d = await this.repo.createDepartment(tenantId, name, supervisorEmployeeId);
    return { id: d.id, tenantId: d.tenantId, name: d.name, supervisorEmployeeId: d.supervisorEmployeeId, employeeCount: 0 };
  }
  async list(tenantId: string): Promise<AiDepartmentView[]> {
    return (await this.repo.listDepartments(tenantId)).map((d: any) => ({
      id: d.id, tenantId: d.tenantId, name: d.name, supervisorEmployeeId: d.supervisorEmployeeId,
      employeeCount: d._count?.employees ?? 0,
    }));
  }
}

@Injectable()
export class AutonomyPolicyEngine implements IAutonomyPolicyEngine {
  // Declarative defaults; a real tenant override store can back this later.
  policy(_tenantId: string): AutonomyPolicy {
    return {
      maxConcurrentMissions: 10,
      maxEmployeeWorkload: 5,
      maxEscalationDepth: 4, // EMPLOYEE→SUPERVISOR→DEPARTMENT_HEAD→EXECUTIVE_AI→HUMAN
      approvalTimeoutMs: 24 * 60 * 60 * 1000,
      missionTimeoutMs: 30 * 24 * 60 * 60 * 1000,
    };
  }
}

@Injectable()
export class AutonomyGovernor implements IAutonomyGovernor {
  constructor(private readonly policyEngine: AutonomyPolicyEngine) {}

  async authorize(params: {
    tenantId: string;
    action: 'CREATE_MISSION' | 'SCHEDULE_WORK' | 'ASSIGN_EMPLOYEE' | 'ESCALATE';
    concurrentMissions: number;
    employeeWorkload?: number;
    escalationDepth?: number;
  }): Promise<GovernorDecision> {
    const policy = this.policyEngine.policy(params.tenantId);
    const now = new Date().toISOString();
    const base = { decidedAt: now };

    if (params.action === 'CREATE_MISSION' && params.concurrentMissions >= policy.maxConcurrentMissions) {
      return { ...base, outcome: 'DENY', reason: `concurrent missions ${params.concurrentMissions} >= max ${policy.maxConcurrentMissions}`, policySource: 'autonomy-policy:maxConcurrentMissions' };
    }
    if (params.action === 'ASSIGN_EMPLOYEE' && (params.employeeWorkload ?? 0) >= policy.maxEmployeeWorkload) {
      return { ...base, outcome: 'DENY', reason: `employee workload ${params.employeeWorkload} >= max ${policy.maxEmployeeWorkload}`, policySource: 'autonomy-policy:maxEmployeeWorkload' };
    }
    if (params.action === 'ESCALATE' && (params.escalationDepth ?? 0) >= policy.maxEscalationDepth) {
      // Reached top of the chain → REQUIRE_HUMAN (never auto-resolve at the top).
      return { ...base, outcome: 'REQUIRE_HUMAN', reason: `escalation depth ${params.escalationDepth} reached max ${policy.maxEscalationDepth}`, policySource: 'autonomy-policy:maxEscalationDepth' };
    }
    return { ...base, outcome: 'ALLOW', reason: 'within policy', policySource: 'autonomy-policy:allow' };
  }
}
