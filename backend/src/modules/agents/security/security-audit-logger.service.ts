/**
 * Security Audit Logger Service
 *
 * SOLID: Single Responsibility — ONLY handles security event logging
 * SOLID: Open/Closed — Add new log targets via configuration
 *
 * @module agents/security
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ISecurityAuditLogger,
  ISecurityAuditEvent,
} from './interfaces/security.interfaces';

/**
 * In-memory buffer for audit events (for batching)
 */
interface AuditBuffer {
  events: ISecurityAuditEvent[];
  lastFlush: Date;
}

@Injectable()
export class SecurityAuditLoggerService implements ISecurityAuditLogger {
  private readonly logger = new Logger(SecurityAuditLoggerService.name);
  private readonly auditBuffer: AuditBuffer = {
    events: [],
    lastFlush: new Date(),
  };

  // Configuration
  private readonly bufferSize: number;
  private readonly flushIntervalMs: number;
  private readonly logToConsole: boolean;
  private readonly logToFile: boolean;
  private readonly logFilePath: string;

  constructor(private readonly configService: ConfigService) {
    this.bufferSize = this.configService.get<number>(
      'security.audit.bufferSize',
      100,
    );
    this.flushIntervalMs = this.configService.get<number>(
      'security.audit.flushIntervalMs',
      5000,
    );
    this.logToConsole = this.configService.get<boolean>(
      'security.audit.logToConsole',
      true,
    );
    this.logToFile = this.configService.get<boolean>(
      'security.audit.logToFile',
      false,
    );
    this.logFilePath = this.configService.get<string>(
      'security.audit.logFilePath',
      '/var/log/neurecore/security-audit.log',
    );

    // Set up periodic flush
    setInterval(() => this.flush(), this.flushIntervalMs);
  }

  /**
   * Log a security event
   */
  log(event: ISecurityAuditEvent): void | Promise<void> {
    // Always log to console in development
    if (this.logToConsole || process.env.NODE_ENV !== 'production') {
      this.logToConsoleInternal(event);
    }

    // Add to buffer for batch processing
    this.auditBuffer.events.push(event);

    // Flush if buffer is full
    if (this.auditBuffer.events.length >= this.bufferSize) {
      this.flush();
    }
  }

  /**
   * Log blocked security events with higher severity
   */
  logBlocked(event: ISecurityAuditEvent): void | Promise<void> {
    const blockedEvent: ISecurityAuditEvent = {
      ...event,
      action: 'BLOCKED',
    };

    // Log with warning level for blocked events
    this.logger.warn(
      `SECURITY BLOCKED: tenant=${event.tenantId} agent=${event.agentType} tool=${event.toolName} reason=${event.blockReason}`,
    );

    this.log(blockedEvent);
  }

  /**
   * Flush the audit buffer
   */
  private flush(): void {
    if (this.auditBuffer.events.length === 0) {
      return;
    }

    const eventsToFlush = [...this.auditBuffer.events];
    this.auditBuffer.events = [];
    this.auditBuffer.lastFlush = new Date();

    // In production, this would send to a proper audit logging service
    // Examples: Elasticsearch, Splunk, custom audit service
    this.persistEvents(eventsToFlush);
  }

  /**
   * Persist events to configured storage
   */
  private persistEvents(events: ISecurityAuditEvent[]): void {
    if (this.logToFile) {
      this.writeToFile(events);
    }

    // TODO: In production, also send to:
    // - Audit log database table
    // - Elasticsearch/Splunk
    // - CloudWatch/GCP Logging
  }

  /**
   * Write events to file
   */
  private writeToFile(events: ISecurityAuditEvent[]): void {
    try {
      const lines = events.map((e) => JSON.stringify(e)).join('\n');
      // Note: In production, use proper file streaming
      // For now, this is a placeholder
      this.logger.debug(
        `Would write ${events.length} audit events to ${this.logFilePath}`,
      );
    } catch (error) {
      this.logger.error('Failed to write audit events to file', error);
    }
  }

  /**
   * Log to console with structured format
   */
  private logToConsoleInternal(event: ISecurityAuditEvent): void {
    const logEntry = {
      timestamp: event.timestamp.toISOString(),
      type: 'security_audit',
      tenantId: event.tenantId,
      agentType: event.agentType,
      userId: event.userId,
      toolName: event.toolName,
      action: event.action,
      blockReason: event.blockReason,
      details: event.details,
    };

    if (event.action === 'BLOCKED') {
      this.logger.warn(`[SECURITY] ${JSON.stringify(logEntry)}`);
    } else {
      this.logger.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
    }
  }

  /**
   * Get recent audit events (for debugging/admin)
   */
  getRecentEvents(count: number = 100): ISecurityAuditEvent[] {
    return this.auditBuffer.events.slice(-count);
  }

  /**
   * Query audit events (simplified implementation)
   */
  queryEvents(filters: {
    tenantId?: string;
    agentType?: string;
    action?: 'ALLOWED' | 'BLOCKED' | 'SANITIZED';
    startDate?: Date;
    endDate?: Date;
  }): ISecurityAuditEvent[] {
    // This would be replaced with proper database queries in production
    return this.auditBuffer.events.filter((event) => {
      if (filters.tenantId && event.tenantId !== filters.tenantId) return false;
      if (filters.agentType && event.agentType !== filters.agentType)
        return false;
      if (filters.action && event.action !== filters.action) return false;
      if (filters.startDate && event.timestamp < filters.startDate)
        return false;
      if (filters.endDate && event.timestamp > filters.endDate) return false;
      return true;
    });
  }
}
