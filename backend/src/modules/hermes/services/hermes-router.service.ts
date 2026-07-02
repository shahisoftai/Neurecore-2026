import { Injectable, Logger } from '@nestjs/common';
import { HermesRegistryService } from './hermes-registry.service';
import type { HermesAgentType } from '@prisma/client';

export interface RouterDecision {
  agentId: string;
  agentType: HermesAgentType;
  confidence: number;
  reasoning: string;
}

@Injectable()
export class HermesRouterService {
  private readonly logger = new Logger(HermesRouterService.name);

  constructor(private readonly registry: HermesRegistryService) {}

  async route(
    task: string,
    tenantId: string,
    preferredType?: HermesAgentType,
  ): Promise<RouterDecision> {
    if (preferredType) {
      const agents = await this.registry.findByType(preferredType, tenantId);
      const active = agents.find((a) => a.isActive);
      if (active) {
        return {
          agentId: active.id,
          agentType: preferredType,
          confidence: 1.0,
          reasoning: `Preferred agent type ${preferredType}`,
        };
      }
    }

    const type = this.classifyTask(task);

    if (type) {
      const agents = await this.registry.findByType(type, tenantId);
      const active = agents.find((a) => a.isActive);
      if (active) {
        return {
          agentId: active.id,
          agentType: type,
          confidence: 0.9,
          reasoning: `Auto-detected task type: ${type}`,
        };
      }
    }

    const defaultAgents = await this.registry.findAll(tenantId, {
      isActive: true,
    });
    if (defaultAgents.data.length > 0) {
      const first = defaultAgents.data[0];
      return {
        agentId: first.id,
        agentType: first.type,
        confidence: 0.5,
        reasoning: 'Fallback to first available agent',
      };
    }

    throw new Error(`No active Hermes agents found for tenant ${tenantId}`);
  }

  private classifyTask(task: string): HermesAgentType | null {
    const lower = task.toLowerCase();

    if (
      this.matches(lower, [
        'invoice',
        'expense',
        'budget',
        'payment',
        'financial',
        'revenue',
        'cost',
        'accounting',
        'payroll',
        'tax',
      ])
    ) {
      return 'FINANCE';
    }

    if (
      this.matches(lower, [
        'hire',
        'onboard',
        'offboard',
        'employee',
        'vacation',
        'leave',
        'hr',
        'recruit',
        'payroll',
        'performance review',
        'termination',
        'benefits',
        'compensation',
      ])
    ) {
      return 'HR';
    }

    if (
      this.matches(lower, [
        'sales',
        'lead',
        'prospect',
        'deal',
        'crm',
        'pipeline',
        'quota',
        'revenue forecast',
        'account',
      ])
    ) {
      return 'SALES';
    }

    if (
      this.matches(lower, [
        'marketing',
        'campaign',
        'content',
        'social media',
        'seo',
        'ads',
        'brand',
        'email marketing',
        'lead generation',
      ])
    ) {
      return 'MARKETING';
    }

    if (
      this.matches(lower, [
        'legal',
        'contract',
        'compliance',
        'nda',
        'agreement',
        'intellectual property',
        'privacy',
      ])
    ) {
      return 'LEGAL';
    }

    if (
      this.matches(lower, [
        'code',
        'debug',
        'deploy',
        'git',
        'api',
        'repository',
        'software',
        'engineering',
        'refactor',
      ])
    ) {
      return 'ENGINEERING';
    }

    if (
      this.matches(lower, [
        'security',
        'vulnerability',
        'pen test',
        'threat',
        'auth',
        'permission',
        'access control',
      ])
    ) {
      return 'SECURITY';
    }

    if (
      this.matches(lower, [
        'customer support',
        'ticket',
        'complaint',
        'refund',
        'return',
        'help desk',
        'issue',
      ])
    ) {
      return 'CUSTOMER_SUPPORT';
    }

    if (
      this.matches(lower, [
        'test',
        'qa',
        'bug',
        'regression',
        'coverage',
        'automation test',
      ])
    ) {
      return 'QA';
    }

    if (
      this.matches(lower, [
        'research',
        'analysis',
        'data',
        'report',
        'metrics',
        'benchmark',
      ])
    ) {
      return 'RESEARCH';
    }

    return null;
  }

  private matches(text: string, keywords: string[]): boolean {
    return keywords.some((kw) => text.includes(kw));
  }
}
