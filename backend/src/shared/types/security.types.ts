/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Security Types - Shared TypeScript Interfaces
 * ═══════════════════════════════════════════════════════════════════════════
 * Type-safe security interfaces used by the security module.
 *
 * NOTE (Phase 0, D-016): The previously-exported `UserRole` enum and `Permission`
 * enum have been removed. `UserRole` is sourced from `@prisma/client` (single
 * source of truth). The old `ROLE_PERMISSIONS` map and `PermissionsGuard` are
 * removed per `EAOS-rbac-model.md` §3.1; authorization is now via `@Roles(...)`
 * decorator (uses Prisma UserRole) and the new guards introduced in EAOS-1+.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { UserRole } from '@prisma/client';

export { UserRole };

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Security Event Types
 * ═══════════════════════════════════════════════════════════════════════════
 */

export enum SecurityEventType {
  // Authentication Events
  LOGIN_SUCCESS = 'auth:login:success',
  LOGIN_FAILED = 'auth:login:failed',
  LOGOUT = 'auth:logout',
  TOKEN_REFRESHED = 'auth:token:refreshed',
  TOKEN_REFRESH_FAILED = 'auth:token:refresh:failed',
  PASSWORD_CHANGED = 'auth:password:changed',
  PASSWORD_RESET_REQUESTED = 'auth:password:reset:requested',
  PASSWORD_RESET_COMPLETED = 'auth:password:reset:completed',

  // Authorization Events
  ACCESS_DENIED = 'auth:access:denied',
  PERMISSION_DENIED = 'auth:permission:denied',
  ROLE_CHANGED = 'auth:role:changed',

  // Rate Limiting Events
  RATE_LIMIT_EXCEEDED = 'security:rate-limit:exceeded',
  RATE_LIMIT_BLOCKED = 'security:rate-limit:blocked',

  // Input Validation Events
  INPUT_VALIDATION_FAILED = 'security:validation:failed',
  SQL_INJECTION_ATTEMPT = 'security:sql-injection:attempt',
  XSS_ATTEMPT = 'security:xss:attempt',
  CSRF_VIOLATION = 'security:csrf:violation',

  // Security Violations
  SUSPICIOUS_REQUEST = 'security:suspicious:request',
  INVALID_TOKEN = 'security:token:invalid',
  TOKEN_EXPIRED = 'security:token:expired',
  ACCOUNT_LOCKED = 'security:account:locked',
  ACCOUNT_UNLOCKED = 'security:account:unlocked',

  // File Upload Events
  FILE_UPLOAD_BLOCKED = 'security:file:blocked',
  MALICIOUS_FILE_DETECTED = 'security:file:malicious',

  // Session Events
  SESSION_CREATED = 'security:session:created',
  SESSION_DESTROYED = 'security:session:destroyed',
  CONCURRENT_SESSION_DETECTED = 'security:session:concurrent',
}

/**
 * Security Event Severity
 */
export enum SecurityEventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Security Event Interface
 */
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  message: string;
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Security Configuration Interfaces
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * JWT Configuration Interface
 */
export interface IJwtConfig {
  secret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  algorithm: 'HS256' | 'HS384' | 'HS512';
  issuer?: string;
  audience?: string;
}

/**
 * Rate Limiting Configuration Interface
 */
export interface IRateLimitConfig {
  ttl: number;
  limit: number;
  authLimit: number;
  apiLimit: number;
  uploadLimit: number;
  storageType: 'memory' | 'redis';
}

/**
 * CORS Configuration Interface
 */
export interface ICorsConfig {
  enabled: boolean;
  origins: string[];
  credentials: boolean;
  methods: string[];
  headers: string[];
  maxAge?: number;
}

/**
 * Security Headers Configuration Interface
 */
export interface ISecurityHeadersConfig {
  contentSecurityPolicy: boolean;
  strictTransportSecurity: boolean;
  xContentTypeOptions: boolean;
  xFrameOptions: boolean;
  xXSSProtection: boolean;
  referrerPolicy: boolean;
  permissionsPolicy: boolean;
}

/**
 * Session Configuration Interface
 */
export interface ISessionConfig {
  secret: string;
  cookieName: string;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  httpOnly: boolean;
}

/**
 * Token Payload Interface
 *
 * NOTE (Phase 0, D-016): `permissions: Permission[]` was removed because the
 * `Permission` enum is deleted. Permissions are now derived from `role` via the
 * `ROLE_PERMISSIONS` matrix in `EAOS-rbac-model.md` §3.3 (frontend mirror). The
 * JWT does NOT carry a permission list; the backend derives it from `role`.
 */
export interface ITokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

/**
 * Token Pair Interface
 */
export interface ITokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * Authentication Result Interface
 */
export interface IAuthResult {
  user: IUserSecurityInfo;
  tokens: ITokenPair;
}

/**
 * User Security Info Interface
 *
 * NOTE (Phase 0, D-016): `permissions: Permission[]` was removed; see ITokenPayload.
 */
export interface IUserSecurityInfo {
  id: string;
  email: string;
  role: UserRole;
  tenantId?: string;
  isActive: boolean;
  lastLoginAt?: Date;
}

/**
 * Rate Limit Result Interface
 */
export interface IRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Security Validation Result Interface
 */
export interface ISecurityValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: Record<string, unknown>;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Request Security Context
 * ═══════════════════════════════════════════════════════════════════════════
 */

export interface ISecurityContext {
  userId?: string;
  tenantId?: string;
  ipAddress: string;
  userAgent: string;
  endpoint: string;
  method: string;
  timestamp: Date;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Masked Data Types
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type MaskableField =
  | 'password'
  | 'passwordHash'
  | 'token'
  | 'refreshToken'
  | 'accessToken'
  | 'secret'
  | 'apiKey'
  | 'creditCard'
  | 'ssn'
  | 'phone'
  | 'email';

export interface IMaskedData {
  field: string;
  originalLength: number;
  maskedValue: string;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Frontend Security Types
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Secure Storage Keys
 */
export enum SecureStorageKey {
  ACCESS_TOKEN = 'nc_at',
  REFRESH_TOKEN = 'nc_rt',
  USER_DATA = 'nc_ud',
  CSRF_TOKEN = 'nc_csrf',
}

/**
 * API Client Security Options
 */
export interface IApiClientSecurityOptions {
  includeAuthToken: boolean;
  includeCsrfToken: boolean;
  timeout: number;
  retryOnUnauthorized: boolean;
}

/**
 * XSS Sanitization Options
 */
export interface IXssSanitizationOptions {
  allowAttributes: string[];
  allowTags: string[];
  stripIgnoreTag: boolean;
}
