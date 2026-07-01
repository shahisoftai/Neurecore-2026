/**
 * API Response Types
 * Following Interface Segregation - minimal contracts for API responses
 */

// Auth Types
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ValidatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string | null;
  isActive: boolean;
}

export interface AuthResult {
  user: ValidatedUser;
  tokens: TokenPair;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  tenantId?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

// User Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  tenantId?: string;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

// Tenant Types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: string;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'PENDING';

export interface CreateTenantInput {
  name: string;
  slug: string;
  plan?: string;
}

export interface UpdateTenantInput {
  name?: string;
  status?: TenantStatus;
  plan?: string;
}

// Agent Types
export interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: AgentStatus;
  tenantId: string;
  departmentId: string | null;
  templateId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'ERROR' | 'STOPPED';

export interface CreateAgentInput {
  name: string;
  description?: string;
  tenantId: string;
  departmentId?: string;
  templateId?: string;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  status?: AgentStatus;
}

// Agent Template Types
export interface AgentTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  version: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Department Types
export interface Department {
  id: string;
  name: string;
  tenantId: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Department Template Types
export interface DepartmentTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Analytics Types
export interface AnalyticsData {
  period: string;
  metrics: Record<string, number>;
}

export interface ForecastData {
  predictions: Array<{
    timestamp: string;
    value: number;
    confidence: number;
  }>;
}

// Finance Types
export interface Invoice {
  id: string;
  tenantId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: Date;
  createdAt: Date;
}

export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Expense {
  id: string;
  tenantId: string;
  amount: number;
  category: string;
  description: string;
  date: Date;
}

// Audit Types
export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

// Connector Types
export interface Connector {
  id: string;
  name: string;
  type: ConnectorType;
  status: ConnectorStatus;
  tenantId: string;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type ConnectorType = 'HUBSPOT' | 'PIPEDRIVE' | 'SALESFORCE';
export type ConnectorStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR';

// Governance Types
export interface Approval {
  id: string;
  type: string;
  status: ApprovalStatus;
  requestedBy: string;
  reviewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

// Common Types
export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Enums from Prisma
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}