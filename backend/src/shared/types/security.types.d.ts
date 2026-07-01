export declare enum Permission {
    USER_CREATE = "user:create",
    USER_READ = "user:read",
    USER_UPDATE = "user:update",
    USER_DELETE = "user:delete",
    USER_LIST = "user:list",
    TENANT_CREATE = "tenant:create",
    TENANT_READ = "tenant:read",
    TENANT_UPDATE = "tenant:update",
    TENANT_DELETE = "tenant:delete",
    TENANT_LIST = "tenant:list",
    DEPARTMENT_CREATE = "department:create",
    DEPARTMENT_READ = "department:read",
    DEPARTMENT_UPDATE = "department:update",
    DEPARTMENT_DELETE = "department:delete",
    AGENT_CREATE = "agent:create",
    AGENT_READ = "agent:read",
    AGENT_UPDATE = "agent:update",
    AGENT_DELETE = "agent:delete",
    AGENT_EXECUTE = "agent:execute",
    TOOL_CREATE = "tool:create",
    TOOL_READ = "tool:read",
    TOOL_UPDATE = "tool:update",
    TOOL_DELETE = "tool:delete",
    TOOL_EXECUTE = "tool:execute",
    AUDIT_READ = "audit:read",
    AUDIT_EXPORT = "audit:export",
    SETTINGS_READ = "settings:read",
    SETTINGS_UPDATE = "settings:update",
    ANALYTICS_READ = "analytics:read",
    ANALYTICS_EXPORT = "analytics:export",
    BILLING_READ = "billing:read",
    BILLING_MANAGE = "billing:manage",
    FILE_UPLOAD = "file:upload",
    FILE_DELETE = "file:delete"
}
export type PermissionKey = keyof typeof Permission;
export type PermissionValue = (typeof Permission)[PermissionKey];
export declare enum UserRole {
    SUPER_ADMIN = "SUPER_ADMIN",
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    MANAGER = "MANAGER",
    USER = "USER",
    GUEST = "GUEST"
}
export declare const ROLE_PERMISSIONS: Record<UserRole, Permission[]>;
export declare enum SecurityEventType {
    LOGIN_SUCCESS = "auth:login:success",
    LOGIN_FAILED = "auth:login:failed",
    LOGOUT = "auth:logout",
    TOKEN_REFRESHED = "auth:token:refreshed",
    TOKEN_REFRESH_FAILED = "auth:token:refresh:failed",
    PASSWORD_CHANGED = "auth:password:changed",
    PASSWORD_RESET_REQUESTED = "auth:password:reset:requested",
    PASSWORD_RESET_COMPLETED = "auth:password:reset:completed",
    ACCESS_DENIED = "auth:access:denied",
    PERMISSION_DENIED = "auth:permission:denied",
    ROLE_CHANGED = "auth:role:changed",
    RATE_LIMIT_EXCEEDED = "security:rate-limit:exceeded",
    RATE_LIMIT_BLOCKED = "security:rate-limit:blocked",
    INPUT_VALIDATION_FAILED = "security:validation:failed",
    SQL_INJECTION_ATTEMPT = "security:sql-injection:attempt",
    XSS_ATTEMPT = "security:xss:attempt",
    CSRF_VIOLATION = "security:csrf:violation",
    SUSPICIOUS_REQUEST = "security:suspicious:request",
    INVALID_TOKEN = "security:token:invalid",
    TOKEN_EXPIRED = "security:token:expired",
    ACCOUNT_LOCKED = "security:account:locked",
    ACCOUNT_UNLOCKED = "security:account:unlocked",
    FILE_UPLOAD_BLOCKED = "security:file:blocked",
    MALICIOUS_FILE_DETECTED = "security:file:malicious",
    SESSION_CREATED = "security:session:created",
    SESSION_DESTROYED = "security:session:destroyed",
    CONCURRENT_SESSION_DETECTED = "security:session:concurrent"
}
export declare enum SecurityEventSeverity {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error",
    CRITICAL = "critical"
}
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
export interface IJwtConfig {
    secret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
    algorithm: "HS256" | "HS384" | "HS512";
    issuer?: string;
    audience?: string;
}
export interface IRateLimitConfig {
    ttl: number;
    limit: number;
    authLimit: number;
    apiLimit: number;
    uploadLimit: number;
    storageType: "memory" | "redis";
}
export interface ICorsConfig {
    enabled: boolean;
    origins: string[];
    credentials: boolean;
    methods: string[];
    headers: string[];
    maxAge?: number;
}
export interface ISecurityHeadersConfig {
    contentSecurityPolicy: boolean;
    strictTransportSecurity: boolean;
    xContentTypeOptions: boolean;
    xFrameOptions: boolean;
    xXSSProtection: boolean;
    referrerPolicy: boolean;
    permissionsPolicy: boolean;
}
export interface ISessionConfig {
    secret: string;
    cookieName: string;
    secure: boolean;
    sameSite: "strict" | "lax" | "none";
    maxAge: number;
    httpOnly: boolean;
}
export interface ITokenPayload {
    sub: string;
    email: string;
    role: UserRole;
    tenantId?: string;
    permissions: Permission[];
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string;
}
export interface ITokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: "Bearer";
}
export interface IAuthResult {
    user: IUserSecurityInfo;
    tokens: ITokenPair;
}
export interface IUserSecurityInfo {
    id: string;
    email: string;
    role: UserRole;
    tenantId?: string;
    permissions: Permission[];
    isActive: boolean;
    lastLoginAt?: Date;
}
export interface IRateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}
export interface ISecurityValidationResult {
    valid: boolean;
    errors: string[];
    sanitized?: Record<string, unknown>;
}
export interface ISecurityContext {
    userId?: string;
    tenantId?: string;
    ipAddress: string;
    userAgent: string;
    endpoint: string;
    method: string;
    timestamp: Date;
}
export type MaskableField = "password" | "passwordHash" | "token" | "refreshToken" | "accessToken" | "secret" | "apiKey" | "creditCard" | "ssn" | "phone" | "email";
export interface IMaskedData {
    field: string;
    originalLength: number;
    maskedValue: string;
}
export declare enum SecureStorageKey {
    ACCESS_TOKEN = "nc_at",
    REFRESH_TOKEN = "nc_rt",
    USER_DATA = "nc_ud",
    CSRF_TOKEN = "nc_csrf"
}
export interface IApiClientSecurityOptions {
    includeAuthToken: boolean;
    includeCsrfToken: boolean;
    timeout: number;
    retryOnUnauthorized: boolean;
}
export interface IXssSanitizationOptions {
    allowAttributes: string[];
    allowTags: string[];
    stripIgnoreTag: boolean;
}
