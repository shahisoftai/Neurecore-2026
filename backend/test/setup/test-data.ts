/**
 * Test Data Factory for NeureCore Backend
 *
 * Provides factory functions for creating test data following SOLID principles.
 * Single Responsibility: Each factory creates one type of test data.
 * Dependency Inversion: Factories can be injected/mocked as needed.
 *
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// User Factories
// ============================================================================

/**
 * Creates a mock user with default values
 */
export function createMockUser(
  overrides: Partial<{
    id: string;
    email: string;
    name: string;
    password: string;
    tenantId: string;
    role: 'admin' | 'user' | 'guest';
    isActive: boolean;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): Required<{
  id: string;
  email: string;
  name: string;
  password: string;
  tenantId: string;
  role: 'admin' | 'user' | 'guest';
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}> {
  return {
    id: overrides.id ?? uuidv4(),
    email: overrides.email ?? 'test@example.com',
    name: overrides.name ?? 'Test User',
    password: overrides.password ?? 'hashedPassword123',
    tenantId: overrides.tenantId ?? uuidv4(),
    role: overrides.role ?? 'user',
    isActive: overrides.isActive ?? true,
    emailVerified: overrides.emailVerified ?? true,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

/**
 * Creates an admin user
 */
export function createMockAdminUser(
  overrides = {},
): ReturnType<typeof createMockUser> {
  return createMockUser({ ...overrides, role: 'admin' });
}

// ============================================================================
// Tenant Factories
// ============================================================================

/**
 * Creates a mock tenant with default values
 */
export function createMockTenant(
  overrides: Partial<{
    id: string;
    name: string;
    slug: string;
    plan: 'free' | 'starter' | 'professional' | 'enterprise';
    status: 'active' | 'suspended' | 'pending';
    settings: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): Required<{
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'pending';
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}> {
  return {
    id: overrides.id ?? uuidv4(),
    name: overrides.name ?? 'Test Tenant',
    slug: overrides.slug ?? 'test-tenant',
    plan: overrides.plan ?? 'starter',
    status: overrides.status ?? 'active',
    settings: overrides.settings ?? {},
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

/**
 * Creates an enterprise tenant
 */
export function createMockEnterpriseTenant(
  overrides = {},
): ReturnType<typeof createMockTenant> {
  return createMockTenant({ ...overrides, plan: 'enterprise' });
}

// ============================================================================
// Analytics Factories
// ============================================================================

/**
 * Creates a mock analytics model
 */
export function createMockAnalyticsModel(
  overrides: Partial<{
    id: string;
    name: string;
    version: string;
    type: 'forecasting' | 'anomaly_detection' | 'classification' | 'regression';
    config: Record<string, unknown>;
    tenantId: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): Required<{
  id: string;
  name: string;
  version: string;
  type: 'forecasting' | 'anomaly_detection' | 'classification' | 'regression';
  config: Record<string, unknown>;
  tenantId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}> {
  return {
    id: overrides.id ?? uuidv4(),
    name: overrides.name ?? 'demo-model',
    version: overrides.version ?? 'v1',
    type: overrides.type ?? 'forecasting',
    config: overrides.config ?? {},
    tenantId: overrides.tenantId ?? uuidv4(),
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

/**
 * Creates mock feature store data
 */
export function createMockFeatureData(
  overrides: Partial<{
    tenantId: string;
    features: Record<string, number>;
    timestamp: string;
  }> = {},
): Required<{
  tenantId: string;
  features: Record<string, number>;
  timestamp: string;
}> {
  return {
    tenantId: overrides.tenantId ?? uuidv4(),
    features: overrides.features ?? { revenue: 1000, users: 50 },
    timestamp: overrides.timestamp ?? new Date().toISOString(),
  };
}

// ============================================================================
// Billing & Finance Factories
// ============================================================================

/**
 * Creates a mock invoice
 */
export function createMockInvoice(
  overrides: Partial<{
    id: string;
    tenantId: string;
    amount: number;
    currency: string;
    status: 'draft' | 'pending' | 'paid' | 'failed' | 'cancelled';
    dueDate: Date;
    paidAt: Date | null;
    lineItems: Array<{ description: string; amount: number; quantity: number }>;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): Required<{
  id: string;
  tenantId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'pending' | 'paid' | 'failed' | 'cancelled';
  dueDate: Date;
  paidAt: Date | null;
  lineItems: Array<{ description: string; amount: number; quantity: number }>;
  createdAt: Date;
  updatedAt: Date;
}> {
  return {
    id: overrides.id ?? uuidv4(),
    tenantId: overrides.tenantId ?? uuidv4(),
    amount: overrides.amount ?? 1000,
    currency: overrides.currency ?? 'USD',
    status: overrides.status ?? 'pending',
    dueDate: overrides.dueDate ?? new Date(),
    paidAt: overrides.paidAt ?? null,
    lineItems: overrides.lineItems ?? [
      { description: 'Service A', amount: 500, quantity: 1 },
      { description: 'Service B', amount: 500, quantity: 1 },
    ],
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

// ============================================================================
// Connector Factories
// ============================================================================

/**
 * Creates a mock CRM connector
 */
export function createMockConnector(
  overrides: Partial<{
    id: string;
    tenantId: string;
    type: 'salesforce' | 'hubspot' | 'zoho' | 'custom';
    name: string;
    config: Record<string, unknown>;
    isActive: boolean;
    lastSyncAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): Required<{
  id: string;
  tenantId: string;
  type: 'salesforce' | 'hubspot' | 'zoho' | 'custom';
  name: string;
  config: Record<string, unknown>;
  isActive: boolean;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> {
  return {
    id: overrides.id ?? uuidv4(),
    tenantId: overrides.tenantId ?? uuidv4(),
    type: overrides.type ?? 'salesforce',
    name: overrides.name ?? 'Test Connector',
    config: overrides.config ?? {},
    isActive: overrides.isActive ?? true,
    lastSyncAt: overrides.lastSyncAt ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

// ============================================================================
// Settings Factories
// ============================================================================

/**
 * Creates mock platform settings
 */
export function createMockPlatformSettings(
  overrides: Partial<{
    id: string;
    key: string;
    value: unknown;
    category: string;
    isPublic: boolean;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
): Required<{
  id: string;
  key: string;
  value: unknown;
  category: string;
  isPublic: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}> {
  return {
    id: overrides.id ?? uuidv4(),
    key: overrides.key ?? 'platform.name',
    value: overrides.value ?? 'NeureCore',
    category: overrides.category ?? 'platform',
    isPublic: overrides.isPublic ?? true,
    description: overrides.description ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

// ============================================================================
// API Response Factories
// ============================================================================

/**
 * Creates a paginated response wrapper
 */
export function createPaginatedResponse<T>(
  items: T[],
  options: {
    page?: number;
    limit?: number;
    total?: number;
  } = {},
): {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
} {
  const { page = 1, limit = 10, total = items.length } = options;
  const totalPages = Math.ceil(total / limit);

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}

/**
 * Creates an API error response
 */
export function createApiErrorResponse(
  message: string,
  statusCode: number = 400,
  errors?: Record<string, string[]>,
): {
  statusCode: number;
  message: string;
  errors?: Record<string, string[]>;
  timestamp: string;
  path?: string;
} {
  return {
    statusCode,
    message,
    errors,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates an API success response
 */
export function createApiSuccessResponse<T>(
  data: T,
  message?: string,
): {
  data: T;
  message?: string;
  timestamp: string;
} {
  return {
    data,
    message,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// JWT & Auth Factories
// ============================================================================

/**
 * Creates a mock JWT payload
 */
export function createMockJwtPayload(
  overrides: Partial<{
    sub: string;
    email: string;
    role: string;
    tenantId: string;
    iat: number;
    exp: number;
  }> = {},
): Required<{
  sub: string;
  email: string;
  role: string;
  tenantId: string;
  iat: number;
  exp: number;
}> {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: overrides.sub ?? uuidv4(),
    email: overrides.email ?? 'test@example.com',
    role: overrides.role ?? 'user',
    tenantId: overrides.tenantId ?? uuidv4(),
    iat: overrides.iat ?? now,
    exp: overrides.exp ?? now + 3600, // 1 hour from now
  };
}

// ============================================================================
// Factory Collections
// ============================================================================

/**
 * Creates an array of mock users
 */
export function createMockUsers(
  count: number,
  overrides = {},
): ReturnType<typeof createMockUser>[] {
  return Array.from({ length: count }, (_, i) =>
    createMockUser({ ...overrides, email: `user${i}@example.com` }),
  );
}

/**
 * Creates an array of mock tenants
 */
export function createMockTenants(
  count: number,
  overrides = {},
): ReturnType<typeof createMockTenant>[] {
  return Array.from({ length: count }, (_, i) =>
    createMockTenant({
      ...overrides,
      name: `Tenant ${i}`,
      slug: `tenant-${i}`,
    }),
  );
}

/**
 * Creates an array of mock invoices
 */
export function createMockInvoices(
  count: number,
  overrides = {},
): ReturnType<typeof createMockInvoice>[] {
  return Array.from({ length: count }, (_, i) =>
    createMockInvoice({
      ...overrides,
      amount: 1000 * (i + 1),
      createdAt: new Date(Date.now() - i * 86400000),
    }),
  );
}
