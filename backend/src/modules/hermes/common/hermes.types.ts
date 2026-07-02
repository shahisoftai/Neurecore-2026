import type {
  HermesAgentType,
  HermesAgentStatus,
  HermesMemoryType,
  ToolPermissionLevel,
} from '@prisma/client';

export {
  HermesAgentType,
  HermesAgentStatus,
  HermesMemoryType,
  ToolPermissionLevel,
};

export const HERMES_AGENT_TYPES = [
  'HR',
  'FINANCE',
  'SALES',
  'MARKETING',
  'LEGAL',
  'RESEARCH',
  'ENGINEERING',
  'QA',
  'SECURITY',
  'OPERATIONS',
  'CUSTOMER_SUPPORT',
  'CUSTOM',
] as const;

export const HERMES_MEMORY_TYPES = [
  'PERSONAL',
  'EPISODIC',
  'PROCEDURAL',
] as const;

export const TOOL_PERMISSION_LEVELS = [
  'ALLOW',
  'DENY',
  'READ_ONLY',
  'WRITE_ONLY',
  'APPROVAL_REQUIRED',
] as const;

export const SESSION_STATUSES = [
  'ACTIVE',
  'SUSPENDED',
  'COMPLETED',
  'EXPIRED',
] as const;

export const MESSAGE_ROLES = ['USER', 'HERMES', 'SYSTEM'] as const;

export const HERMES_EVENT_TYPES = [
  'hermes:start',
  'hermes:end',
  'hermes:tool:call',
  'hermes:tool:result',
  'hermes:tool:denied',
  'hermes:approval:requested',
  'hermes:approval:completed',
  'hermes:memory:stored',
  'hermes:error',
] as const;

export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const DEFAULT_HERMES_TIMEOUT_MS = 120_000; // 2 minutes
export const DEFAULT_MAX_ITERATIONS = 50;
