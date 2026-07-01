"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureStorageKey = exports.SecurityEventSeverity = exports.SecurityEventType = exports.ROLE_PERMISSIONS = exports.UserRole = exports.Permission = void 0;
var Permission;
(function (Permission) {
    Permission["USER_CREATE"] = "user:create";
    Permission["USER_READ"] = "user:read";
    Permission["USER_UPDATE"] = "user:update";
    Permission["USER_DELETE"] = "user:delete";
    Permission["USER_LIST"] = "user:list";
    Permission["TENANT_CREATE"] = "tenant:create";
    Permission["TENANT_READ"] = "tenant:read";
    Permission["TENANT_UPDATE"] = "tenant:update";
    Permission["TENANT_DELETE"] = "tenant:delete";
    Permission["TENANT_LIST"] = "tenant:list";
    Permission["DEPARTMENT_CREATE"] = "department:create";
    Permission["DEPARTMENT_READ"] = "department:read";
    Permission["DEPARTMENT_UPDATE"] = "department:update";
    Permission["DEPARTMENT_DELETE"] = "department:delete";
    Permission["AGENT_CREATE"] = "agent:create";
    Permission["AGENT_READ"] = "agent:read";
    Permission["AGENT_UPDATE"] = "agent:update";
    Permission["AGENT_DELETE"] = "agent:delete";
    Permission["AGENT_EXECUTE"] = "agent:execute";
    Permission["TOOL_CREATE"] = "tool:create";
    Permission["TOOL_READ"] = "tool:read";
    Permission["TOOL_UPDATE"] = "tool:update";
    Permission["TOOL_DELETE"] = "tool:delete";
    Permission["TOOL_EXECUTE"] = "tool:execute";
    Permission["AUDIT_READ"] = "audit:read";
    Permission["AUDIT_EXPORT"] = "audit:export";
    Permission["SETTINGS_READ"] = "settings:read";
    Permission["SETTINGS_UPDATE"] = "settings:update";
    Permission["ANALYTICS_READ"] = "analytics:read";
    Permission["ANALYTICS_EXPORT"] = "analytics:export";
    Permission["BILLING_READ"] = "billing:read";
    Permission["BILLING_MANAGE"] = "billing:manage";
    Permission["FILE_UPLOAD"] = "file:upload";
    Permission["FILE_DELETE"] = "file:delete";
})(Permission || (exports.Permission = Permission = {}));
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    UserRole["OWNER"] = "OWNER";
    UserRole["ADMIN"] = "ADMIN";
    UserRole["MANAGER"] = "MANAGER";
    UserRole["USER"] = "USER";
    UserRole["GUEST"] = "GUEST";
})(UserRole || (exports.UserRole = UserRole = {}));
exports.ROLE_PERMISSIONS = {
    [UserRole.SUPER_ADMIN]: Object.values(Permission),
    [UserRole.OWNER]: [
        Permission.USER_CREATE,
        Permission.USER_READ,
        Permission.USER_UPDATE,
        Permission.USER_DELETE,
        Permission.USER_LIST,
        Permission.TENANT_READ,
        Permission.TENANT_UPDATE,
        Permission.DEPARTMENT_CREATE,
        Permission.DEPARTMENT_READ,
        Permission.DEPARTMENT_UPDATE,
        Permission.DEPARTMENT_DELETE,
        Permission.AGENT_CREATE,
        Permission.AGENT_READ,
        Permission.AGENT_UPDATE,
        Permission.AGENT_DELETE,
        Permission.AGENT_EXECUTE,
        Permission.TOOL_CREATE,
        Permission.TOOL_READ,
        Permission.TOOL_UPDATE,
        Permission.TOOL_DELETE,
        Permission.TOOL_EXECUTE,
        Permission.AUDIT_READ,
        Permission.AUDIT_EXPORT,
        Permission.SETTINGS_READ,
        Permission.SETTINGS_UPDATE,
        Permission.ANALYTICS_READ,
        Permission.ANALYTICS_EXPORT,
        Permission.BILLING_READ,
        Permission.BILLING_MANAGE,
        Permission.FILE_UPLOAD,
        Permission.FILE_DELETE,
    ],
    [UserRole.ADMIN]: [
        Permission.USER_CREATE,
        Permission.USER_READ,
        Permission.USER_UPDATE,
        Permission.USER_DELETE,
        Permission.USER_LIST,
        Permission.DEPARTMENT_CREATE,
        Permission.DEPARTMENT_READ,
        Permission.DEPARTMENT_UPDATE,
        Permission.DEPARTMENT_DELETE,
        Permission.AGENT_CREATE,
        Permission.AGENT_READ,
        Permission.AGENT_UPDATE,
        Permission.AGENT_DELETE,
        Permission.AGENT_EXECUTE,
        Permission.TOOL_CREATE,
        Permission.TOOL_READ,
        Permission.TOOL_UPDATE,
        Permission.TOOL_DELETE,
        Permission.TOOL_EXECUTE,
        Permission.AUDIT_READ,
        Permission.SETTINGS_READ,
        Permission.SETTINGS_UPDATE,
        Permission.ANALYTICS_READ,
        Permission.ANALYTICS_EXPORT,
        Permission.BILLING_READ,
        Permission.FILE_UPLOAD,
        Permission.FILE_DELETE,
    ],
    [UserRole.MANAGER]: [
        Permission.USER_READ,
        Permission.USER_LIST,
        Permission.DEPARTMENT_READ,
        Permission.AGENT_READ,
        Permission.AGENT_EXECUTE,
        Permission.TOOL_READ,
        Permission.TOOL_EXECUTE,
        Permission.AUDIT_READ,
        Permission.SETTINGS_READ,
        Permission.ANALYTICS_READ,
        Permission.FILE_UPLOAD,
    ],
    [UserRole.USER]: [
        Permission.USER_READ,
        Permission.AGENT_READ,
        Permission.AGENT_EXECUTE,
        Permission.TOOL_READ,
        Permission.TOOL_EXECUTE,
        Permission.ANALYTICS_READ,
        Permission.FILE_UPLOAD,
    ],
    [UserRole.GUEST]: [Permission.AGENT_READ, Permission.TOOL_READ],
};
var SecurityEventType;
(function (SecurityEventType) {
    SecurityEventType["LOGIN_SUCCESS"] = "auth:login:success";
    SecurityEventType["LOGIN_FAILED"] = "auth:login:failed";
    SecurityEventType["LOGOUT"] = "auth:logout";
    SecurityEventType["TOKEN_REFRESHED"] = "auth:token:refreshed";
    SecurityEventType["TOKEN_REFRESH_FAILED"] = "auth:token:refresh:failed";
    SecurityEventType["PASSWORD_CHANGED"] = "auth:password:changed";
    SecurityEventType["PASSWORD_RESET_REQUESTED"] = "auth:password:reset:requested";
    SecurityEventType["PASSWORD_RESET_COMPLETED"] = "auth:password:reset:completed";
    SecurityEventType["ACCESS_DENIED"] = "auth:access:denied";
    SecurityEventType["PERMISSION_DENIED"] = "auth:permission:denied";
    SecurityEventType["ROLE_CHANGED"] = "auth:role:changed";
    SecurityEventType["RATE_LIMIT_EXCEEDED"] = "security:rate-limit:exceeded";
    SecurityEventType["RATE_LIMIT_BLOCKED"] = "security:rate-limit:blocked";
    SecurityEventType["INPUT_VALIDATION_FAILED"] = "security:validation:failed";
    SecurityEventType["SQL_INJECTION_ATTEMPT"] = "security:sql-injection:attempt";
    SecurityEventType["XSS_ATTEMPT"] = "security:xss:attempt";
    SecurityEventType["CSRF_VIOLATION"] = "security:csrf:violation";
    SecurityEventType["SUSPICIOUS_REQUEST"] = "security:suspicious:request";
    SecurityEventType["INVALID_TOKEN"] = "security:token:invalid";
    SecurityEventType["TOKEN_EXPIRED"] = "security:token:expired";
    SecurityEventType["ACCOUNT_LOCKED"] = "security:account:locked";
    SecurityEventType["ACCOUNT_UNLOCKED"] = "security:account:unlocked";
    SecurityEventType["FILE_UPLOAD_BLOCKED"] = "security:file:blocked";
    SecurityEventType["MALICIOUS_FILE_DETECTED"] = "security:file:malicious";
    SecurityEventType["SESSION_CREATED"] = "security:session:created";
    SecurityEventType["SESSION_DESTROYED"] = "security:session:destroyed";
    SecurityEventType["CONCURRENT_SESSION_DETECTED"] = "security:session:concurrent";
})(SecurityEventType || (exports.SecurityEventType = SecurityEventType = {}));
var SecurityEventSeverity;
(function (SecurityEventSeverity) {
    SecurityEventSeverity["INFO"] = "info";
    SecurityEventSeverity["WARNING"] = "warning";
    SecurityEventSeverity["ERROR"] = "error";
    SecurityEventSeverity["CRITICAL"] = "critical";
})(SecurityEventSeverity || (exports.SecurityEventSeverity = SecurityEventSeverity = {}));
var SecureStorageKey;
(function (SecureStorageKey) {
    SecureStorageKey["ACCESS_TOKEN"] = "nc_at";
    SecureStorageKey["REFRESH_TOKEN"] = "nc_rt";
    SecureStorageKey["USER_DATA"] = "nc_ud";
    SecureStorageKey["CSRF_TOKEN"] = "nc_csrf";
})(SecureStorageKey || (exports.SecureStorageKey = SecureStorageKey = {}));
//# sourceMappingURL=security.types.js.map