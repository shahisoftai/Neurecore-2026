import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { GovernanceActionType, ApprovalStatus } from '@prisma/client';

// ─── Interfaces (ISP) ─────────────────────────────────────────────────────────

export interface IGovernanceRuleService {
  findAll(tenantId: string): Promise<unknown[]>;
  create(tenantId: string, data: CreateRuleInput): Promise<unknown>;
  update(
    id: string,
    tenantId: string,
    data: Partial<CreateRuleInput>,
  ): Promise<unknown>;
  remove(id: string, tenantId: string): Promise<void>;
  evaluate(
    tenantId: string,
    context: Record<string, unknown>,
  ): Promise<GovernanceDecision>;
}

export interface CreateRuleInput {
  name: string;
  description?: string;
  trigger: string;
  actionType?: GovernanceActionType;
  actionConfig?: Record<string, unknown>;
  isActive?: boolean;
  priority?: number;
}

export interface GovernanceDecision {
  allowed: boolean;
  requiresApproval: boolean;
  triggeredRules: string[];
  actions: string[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class GovernanceRulesService implements IGovernanceRuleService {
  private readonly logger = new Logger(GovernanceRulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.governanceRule.findMany({
      where: { OR: [{ tenantId }, { tenantId: null }] },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: {
        tenant: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string, tenantId: string) {
    const rule = await this.prisma.governanceRule.findFirst({
      where: { id, tenantId },
    });
    if (!rule) throw new NotFoundException(`Rule ${id} not found`);
    return rule;
  }

  async create(tenantId: string, data: CreateRuleInput) {
    return this.prisma.governanceRule.create({
      data: {
        name: data.name,
        description: data.description,
        trigger: data.trigger,
        actionType: data.actionType ?? 'LOG_ONLY',
        actionConfig: (data.actionConfig ?? {}) as never,
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
        tenantId,
      },
    });
  }

  async update(id: string, tenantId: string, data: Partial<CreateRuleInput>) {
    await this.findOne(id, tenantId);
    return this.prisma.governanceRule.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.trigger && { trigger: data.trigger }),
        ...(data.actionType && { actionType: data.actionType }),
        ...(data.actionConfig && { actionConfig: data.actionConfig as never }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.priority !== undefined && { priority: data.priority }),
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    await this.prisma.governanceRule.delete({ where: { id } });
  }

  /**
   * Evaluate a context object against active rules — returns governance decision.
   * Implements a simple expression engine: rules trigger based on string matching.
   * SRP: Only evaluates; does not persist results.
   */
  async evaluate(
    tenantId: string,
    context: Record<string, unknown>,
  ): Promise<GovernanceDecision> {
    const rules = await this.prisma.governanceRule.findMany({
      where: { isActive: true, OR: [{ tenantId }, { tenantId: null }] },
      orderBy: { priority: 'desc' },
    });

    const triggered: string[] = [];
    const actions: string[] = [];
    let blocked = false;
    let requiresApproval = false;

    for (const rule of rules) {
      if (this.evaluateTrigger(rule.trigger, context)) {
        triggered.push(rule.name);
        actions.push(rule.actionType);
        this.logger.log(
          `[Governance] Rule "${rule.name}" triggered for tenant ${tenantId}`,
        );

        if (rule.actionType === 'BLOCK') blocked = true;
        if (rule.actionType === 'REQUIRE_APPROVAL') requiresApproval = true;
      }
    }

    return {
      allowed: !blocked,
      requiresApproval,
      triggeredRules: triggered,
      actions,
    };
  }

  /** Simple expression evaluator: supports "key op value" syntax */
  private evaluateTrigger(
    trigger: string,
    context: Record<string, unknown>,
  ): boolean {
    try {
      // Example trigger: "task.cost > 10" or "agent.action == 'email'"
      const match = trigger.match(
        /^(\S+)\s*(==|!=|>|>=|<|<=|contains)\s*(.+)$/,
      );
      if (!match) return false;

      const [, keyPath, op, rawVal] = match;
      const actual = this.getNestedValue(context, keyPath);
      const expected = rawVal.replace(/['"]/g, '').trim();

      switch (op) {
        case '==':
          return String(actual) === expected;
        case '!=':
          return String(actual) !== expected;
        case '>':
          return Number(actual) > Number(expected);
        case '>=':
          return Number(actual) >= Number(expected);
        case '<':
          return Number(actual) < Number(expected);
        case '<=':
          return Number(actual) <= Number(expected);
        case 'contains':
          return String(actual).includes(expected);
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, key) => {
      if (acc && typeof acc === 'object')
        return (acc as Record<string, unknown>)[key];
      return undefined;
    }, obj);
  }

  /**
   * Return execution logs where the agent was involved in governance decisions.
   * Uses ExecutionLog records with step 'governance:evaluate'.
   * SRP: reads only; does not modify state.
   */
  async getAgentAudit(
    agentId: string,
    tenantId: string,
    opts: { page?: number; limit?: number } = {},
  ) {
    const { page = 1, limit = 20 } = opts;
    const skip = (page - 1) * limit;

    const where = {
      agentId,
      step: { startsWith: 'governance' },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.executionLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          agent: { select: { id: true, name: true, tenantId: true } },
        },
      }),
      this.prisma.executionLog.count({ where }),
    ]);

    // Enforce tenant isolation: only return logs belonging to this tenant's agents
    const filtered = data.filter((d) => d.agent?.tenantId === tenantId);

    return {
      data: filtered,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
