import type { HermesAgentType, HermesAgentStatus } from '@prisma/client';
import type { HermesEventType } from '../interfaces/hermes-event-bus.interface';

export interface HermesCostReport {
  agentId: string;
  agentName: string;
  agentType: HermesAgentType;
  totalCostUsd: number;
  totalTokens: number;
  totalRequests: number;
  periodStart: Date;
  periodEnd: Date;
}

export interface HermesUsageMetrics {
  agentId: string;
  activeSessions: number;
  completedTasks: number;
  failedTasks: number;
  avgDurationMs: number;
  avgTokensPerTask: number;
  toolCallsTotal: number;
  approvalsPending: number;
}

export interface HermesSystemHealth {
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  suspendedAgents: number;
  totalSessions: number;
  activeSessions: number;
  pendingApprovals: number;
  memoryEntries: number;
  errors24h: number;
}

export interface HermesAgentSummary {
  id: string;
  name: string;
  type: HermesAgentType;
  status: HermesAgentStatus;
  isActive: boolean;
  sessionCount: number;
  toolCount: number;
  capabilityCount: number;
  memoryCount: number;
  totalCostUsd: number;
}

export type HermesLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface HermesLogEntry {
  timestamp: Date;
  level: HermesLogLevel;
  agentId?: string;
  sessionId?: string;
  traceId?: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface HermesValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
