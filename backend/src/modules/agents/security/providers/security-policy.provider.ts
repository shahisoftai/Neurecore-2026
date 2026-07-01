/**
 * Security Policy Provider
 *
 * SOLID: Single Responsibility — ONLY provides security policies
 * SOLID: Open/Closed — Extend via configuration or database
 * SOLID: Dependency Inversion — Uses interfaces, implementation swappable
 *
 * @module agents/security/providers
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  ISecurityPolicyProvider,
  ISecurityPolicy,
} from '../interfaces/security.interfaces';

/**
 * Agent type to policy mapping
 * In production, this would come from database or config service
 */
interface AgentPolicyConfig {
  allowedTools: string[];
  blockedTools: string[];
  allowedPaths: string[];
  blockedPaths: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  maxFileSizeBytes: number;
  promptInjectionDetection: boolean;
  commandValidation: boolean;
  resourceValidation: boolean;
}

/**
 * Agent type configurations
 * Maps agent types to their allowed/blocked tools and resources
 */
const AGENT_POLICY_CONFIGS: Record<
  string,
  Omit<AgentPolicyConfig, 'agentType' | 'tenantId'>
> = {
  /**
   * Finance Analyst Agent - see docs/POLICIES/FINANCE/finance-analyst.md
   */
  'finance-analyst': {
    allowedTools: [
      'budgets.read',
      'budgets.query',
      'budgets.summary',
      'costs.read',
      'costs.query',
      'costs.summarize',
      'inbox.read',
      'inbox.create',
    ],
    blockedTools: [
      'budgets.delete',
      'budgets.update',
      'costs.delete',
      'costs.update',
      'shell',
      'bash',
      'exec',
      'file.read',
      'file.write',
      'http.request',
    ],
    allowedPaths: ['/workspace/reports', '/workspace/exports'],
    blockedPaths: ['/etc', '/root', '/home', '/var/log'],
    allowedDomains: [],
    blockedDomains: ['*'],
    maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
    promptInjectionDetection: true,
    commandValidation: false,
    resourceValidation: true,
  },

  /**
   * Supply Chain Specialist Agent - see docs/POLICIES/OPERATIONS/supply-chain-specialist.md
   */
  'supply-chain-specialist': {
    allowedTools: [
      'routines.read',
      'routines.query',
      'routines.execute',
      'routines.trigger',
      'events.read',
      'events.query',
      'health.read',
      'health.query',
      'agents.query',
      'inbox.read',
      'inbox.create',
    ],
    blockedTools: [
      'routines.delete',
      'routines.modify',
      'shell',
      'bash',
      'exec',
      'file.read',
      'file.write',
      'http.request',
      'database.query',
      'database.modify',
    ],
    allowedPaths: ['/workspace/routines', '/workspace/logs'],
    blockedPaths: ['/etc', '/root', '/home', '/var/log', '/proc'],
    allowedDomains: [],
    blockedDomains: ['*'],
    maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
    promptInjectionDetection: true,
    commandValidation: true,
    resourceValidation: true,
  },

  /**
   * Audit & Compliance Officer Agent - see docs/POLICIES/RISK_COMPLIANCE/audit-compliance-officer.md
   */
  'audit-compliance-officer': {
    allowedTools: [
      'events.read',
      'events.query',
      'events.export',
      'users.read',
      'users.query',
      'users.export',
      'tenants.read',
      'tenants.query',
      'health.read',
      'health.full',
      'agents.query',
      'inbox.create',
    ],
    blockedTools: [
      'events.delete',
      'events.modify',
      'users.delete',
      'users.update',
      'users.activate',
      'tenants.update',
      'tenants.delete',
      'shell',
      'bash',
      'exec',
      'file.read',
      'file.write',
      'http.request',
      'database.query',
      'database.modify',
    ],
    allowedPaths: ['/workspace/audit-reports', '/workspace/exports'],
    blockedPaths: ['/etc', '/root', '/home', '/var/log', '/proc', '/sys'],
    allowedDomains: [],
    blockedDomains: ['*'],
    maxFileSizeBytes: 100 * 1024 * 1024, // 100MB
    promptInjectionDetection: true,
    commandValidation: false,
    resourceValidation: true,
  },

  /**
   * Default agent policy - restrictive baseline
   */
  default: {
    allowedTools: ['health.read', 'health.query'],
    blockedTools: [
      'shell',
      'bash',
      'exec',
      'file.read',
      'file.write',
      'file.delete',
      'http.request',
      'database.query',
      'database.modify',
      'routines.execute',
      'budgets.update',
      'budgets.delete',
      'users.update',
      'users.delete',
    ],
    allowedPaths: ['/workspace'],
    blockedPaths: ['/etc', '/root', '/home', '/var', '/proc', '/sys', '/boot'],
    allowedDomains: [],
    blockedDomains: ['*'],
    maxFileSizeBytes: 1 * 1024 * 1024, // 1MB
    promptInjectionDetection: true,
    commandValidation: true,
    resourceValidation: true,
  },
};

@Injectable()
export class SecurityPolicyProvider implements ISecurityPolicyProvider {
  private readonly logger = new Logger(SecurityPolicyProvider.name);

  /**
   * Get security policy for an agent type and tenant
   */
  async getPolicy(
    agentType: string,
    tenantId: string,
  ): Promise<ISecurityPolicy | null> {
    const normalizedAgentType = agentType.toLowerCase().trim();

    const config =
      AGENT_POLICY_CONFIGS[normalizedAgentType] ||
      AGENT_POLICY_CONFIGS['default'];

    const policy: ISecurityPolicy = {
      agentType: normalizedAgentType,
      tenantId,
      ...config,
    };

    this.logger.debug(
      `Security policy retrieved for agent=${normalizedAgentType}, tenant=${tenantId}`,
    );

    return policy;
  }

  /**
   * Check if a tool is allowed by the policy
   */
  isToolAllowed(toolName: string, policy: ISecurityPolicy): boolean {
    // Check blocked list first (deny takes precedence)
    if (policy.blockedTools.includes(toolName)) {
      this.logger.debug(`Tool ${toolName} blocked by policy`);
      return false;
    }

    // Check if tool is in allowed list
    if (policy.allowedTools.includes(toolName)) {
      this.logger.debug(`Tool ${toolName} allowed by policy`);
      return true;
    }

    // If allowedTools is '*', allow all non-blocked tools
    if (policy.allowedTools.includes('*')) {
      return true;
    }

    // Default deny
    this.logger.debug(`Tool ${toolName} not in allowed list, denying`);
    return false;
  }

  /**
   * Get the default/fallback security policy
   */
  getDefaultPolicy(): ISecurityPolicy {
    return {
      agentType: 'default',
      tenantId: 'default',
      ...AGENT_POLICY_CONFIGS['default'],
    };
  }

  /**
   * Get available agent types with policies
   */
  getAvailableAgentTypes(): string[] {
    return Object.keys(AGENT_POLICY_CONFIGS);
  }
}
