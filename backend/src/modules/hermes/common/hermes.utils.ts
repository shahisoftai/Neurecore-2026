/**
 * hermes.utils.ts — Shared utility functions for the Hermes layer.
 *
 * SOLID — SRP: Pure stateless utility functions, no side effects.
 */

import type { HermesAgentType } from '@prisma/client';

/**
 * Build a short trace ID for Hermes execution spans.
 */
export function buildHermesTraceId(agentId: string, sessionId: string): string {
    return `hermes:${agentId.slice(0, 8)}:${sessionId.slice(0, 8)}:${Date.now()}`;
}

/**
 * Format a duration in milliseconds as a human-readable string.
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

/**
 * Truncate a string to a maximum length with ellipsis.
 */
export function truncate(str: string, maxLen = 200): string {
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen - 3) + '...';
}

/**
 * Sanitize an object for audit logging — redact sensitive fields.
 */
export function sanitizeForAudit(
    obj: Record<string, unknown>,
    sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey', 'authorization'],
): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        const lower = k.toLowerCase();
        if (sensitiveKeys.some((s) => lower.includes(s))) {
            result[k] = '[REDACTED]';
        } else if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
            result[k] = sanitizeForAudit(v as Record<string, unknown>, sensitiveKeys);
        } else {
            result[k] = v;
        }
    }
    return result;
}

/**
 * Returns the default security policy for a given Hermes agent type.
 */
export function getDefaultSecurityPolicy(type: HermesAgentType): {
    allowedTools: string[];
    blockedTools: string[];
    allowedPaths: string[];
    blockedPaths: string[];
    maxFileSizeBytes: number;
    promptInjectionDetection: boolean;
    commandValidation: boolean;
} {
    const blockedPaths = ['/etc', '/root', '/proc', '/sys', '/boot'];

    switch (type) {
        case 'HR':
            return {
                allowedTools: ['email', 'calendar', 'documents', 'tasks', 'hr_system'],
                blockedTools: ['finance_db', 'payroll_write', 'network_config'],
                allowedPaths: ['/documents/hr', '/documents/policies'],
                blockedPaths,
                maxFileSizeBytes: 50 * 1024 * 1024,
                promptInjectionDetection: true,
                commandValidation: false,
            };
        case 'FINANCE':
            return {
                allowedTools: ['erp', 'invoices', 'payments', 'reports', 'email'],
                blockedTools: ['hr_system', 'marketing_db', 'network_config'],
                allowedPaths: ['/documents/finance', '/documents/invoices'],
                blockedPaths,
                maxFileSizeBytes: 100 * 1024 * 1024,
                promptInjectionDetection: true,
                commandValidation: true,
            };
        case 'SALES':
            return {
                allowedTools: ['crm', 'email', 'calendar', 'quotes', 'documents'],
                blockedTools: ['hr_system', 'finance_db', 'network_config'],
                allowedPaths: ['/documents/sales', '/documents/proposals'],
                blockedPaths,
                maxFileSizeBytes: 50 * 1024 * 1024,
                promptInjectionDetection: true,
                commandValidation: false,
            };
        case 'LEGAL':
            return {
                allowedTools: ['documents', 'email', 'compliance_db', 'contracts'],
                blockedTools: ['finance_db', 'hr_system', 'network_config'],
                allowedPaths: ['/documents/legal', '/documents/contracts'],
                blockedPaths,
                maxFileSizeBytes: 100 * 1024 * 1024,
                promptInjectionDetection: true,
                commandValidation: false,
            };
        default:
            return {
                allowedTools: ['email', 'documents'],
                blockedTools: ['network_config', 'shell'],
                allowedPaths: ['/documents'],
                blockedPaths,
                maxFileSizeBytes: 10 * 1024 * 1024,
                promptInjectionDetection: true,
                commandValidation: false,
            };
    }
}

/**
 * Compute a simple importance score from content length and keywords.
 */
export function computeImportanceScore(content: string, keywords: string[] = []): number {
    let score = 0.3; // baseline
    const lower = content.toLowerCase();

    // Length bonus
    if (content.length > 500) score += 0.1;
    if (content.length > 2000) score += 0.1;

    // Keyword bonus
    for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) score += 0.05;
    }

    // High-importance signals
    const highSignals = ['critical', 'urgent', 'important', 'terminated', 'rejected', 'approved'];
    for (const sig of highSignals) {
        if (lower.includes(sig)) score += 0.1;
    }

    return Math.min(1.0, score);
}
