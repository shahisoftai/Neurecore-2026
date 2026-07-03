import type { HermesAgentType, ToolPermissionLevel } from '@prisma/client';

export const HERMES_DEFAULT_MODEL = 'gpt-4o-mini';

export const HERMES_DEFAULT_MAX_ITERATIONS = 10;
export const HERMES_DEFAULT_TEMPERATURE = 0.7;

export const HERMES_MEMORY_DEFAULT_LIMIT = 10;
export const HERMES_MEMORY_MAX_CONTEXT_TOKENS = 4000;

export const HERMES_SESSION_DEFAULT_EXPIRY_HOURS = 24;

export const HERMES_EVENT_HISTORY_MAX = 500;

export const HERMES_AGENT_DESCRIPTIONS: Record<HermesAgentType, string> = {
  HR: 'Human Resources specialist — onboarding, offboarding, policy, compliance, and employee records management.',
  FINANCE: 'Financial operations specialist — invoicing, payments, expense tracking, ERP sync, and budget monitoring.',
  SALES: 'Sales operations specialist — CRM management, deal tracking, quoting, proposals, and pipeline analytics.',
  MARKETING: 'Marketing specialist — campaign management, content creation, analytics, and external publishing.',
  LEGAL: 'Legal specialist — contract review, compliance checking, NDA generation, and document management.',
  RESEARCH: 'Research specialist — data gathering, analysis, knowledge base search, and report generation.',
  ENGINEERING: 'Engineering specialist — technical documentation, code review, task management, and API testing.',
  QA: 'Quality assurance specialist — test case management, bug tracking, QA documentation, and reporting.',
  SECURITY: 'Security operations specialist — audit log monitoring, security alerting, access management, and incident response.',
  OPERATIONS: 'Operations specialist — scheduling, task orchestration, documentation, and operational reporting.',
  CUSTOMER_SUPPORT: 'Customer support specialist — ticket management, knowledge base access, email support, and refund processing.',
  CUSTOM: 'Custom agent — can be configured with domain-specific tools and behaviors.',
};

export const HERMES_FEATURE_FLAGS = {
  HERMES_ENABLED: 'HERMES_ENABLED',
  HERMES_APPROVAL_WORKFLOWS_ENABLED: 'HERMES_APPROVAL_WORKFLOWS_ENABLED',
  HERMES_MEMORY_ENABLED: 'HERMES_MEMORY_ENABLED',
  HERMES_TOOL_EXECUTION_ENABLED: 'HERMES_TOOL_EXECUTION_ENABLED',
} as const;

export const APPROVAL_RISK_THRESHOLDS = {
  LOW_RISK_USD: 100,
  MEDIUM_RISK_USD: 1000,
  HIGH_RISK_USD: 5000,
} as const;

export const APPROVAL_TIMEOUT_HOURS = 72 as const;

export const HERMES_ERROR_CODES = {
  AGENT_NOT_FOUND: 'HERMES_AGENT_NOT_FOUND',
  AGENT_NOT_ACTIVE: 'HERMES_AGENT_NOT_ACTIVE',
  SESSION_NOT_FOUND: 'HERMES_SESSION_NOT_FOUND',
  TOOL_DENIED: 'HERMES_TOOL_DENIED',
  APPROVAL_REQUIRED: 'HERMES_APPROVAL_REQUIRED',
  EXECUTION_ERROR: 'HERMES_EXECUTION_ERROR',
  TENANT_ISOLATION_VIOLATION: 'HERMES_TENANT_ISOLATION_VIOLATION',
  MEMORY_STORE_ERROR: 'HERMES_MEMORY_STORE_ERROR',
  APPROVAL_TIMEOUT: 'HERMES_APPROVAL_TIMEOUT',
} as const;

export type HermesErrorCode =
  (typeof HERMES_ERROR_CODES)[keyof typeof HERMES_ERROR_CODES];

export const APPROVAL_WORKFLOW_STEPS: Record<
  string,
  Array<{ role: string; order: number }>
> = {
  HIRE: [
    { role: 'MANAGER', order: 0 },
    { role: 'ADMIN', order: 1 },
    { role: 'OWNER', order: 2 },
  ],
  FIRE: [
    { role: 'MANAGER', order: 0 },
    { role: 'ADMIN', order: 1 },
    { role: 'OWNER', order: 2 },
  ],
  REFUND: [
    { role: 'MANAGER', order: 0 },
    { role: 'ADMIN', order: 1 },
  ],
  BUDGET: [
    { role: 'MANAGER', order: 0 },
    { role: 'ADMIN', order: 1 },
    { role: 'OWNER', order: 2 },
  ],
  VENDOR_PAYMENT: [
    { role: 'ADMIN', order: 0 },
    { role: 'OWNER', order: 1 },
  ],
  CONTRACT: [
    { role: 'ADMIN', order: 0 },
    { role: 'OWNER', order: 1 },
  ],
  DATA_ACCESS: [
    { role: 'ADMIN', order: 0 },
    { role: 'OWNER', order: 1 },
  ],
  CUSTOM: [{ role: 'ADMIN', order: 0 }],
};
