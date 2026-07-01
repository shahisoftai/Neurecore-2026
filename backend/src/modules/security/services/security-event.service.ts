/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Security Event Service - Audit Logging for Security Events
 * ═══════════════════════════════════════════════════════════════════════════
 * Logs and tracks security events for monitoring and compliance.
 * Follows SOLID principles - Single Responsibility for security event logging.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import {
  SecurityEvent,
  SecurityEventType,
  SecurityEventSeverity,
} from '../../../shared/types/security.types';

/**
 * Security Event Log Entry
 */
interface SecurityEventLog {
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
  timestamp: string;
}

@Injectable()
export class SecurityEventService implements OnModuleInit {
  private readonly logger = new Logger(SecurityEventService.name);
  private readonly eventLogKey = 'security:events:log';
  private readonly maxEventsInMemory = 1000;
  private readonly memoryStore: SecurityEventLog[] = [];
  private useRedis = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Check if Redis is available
    if (this.redisService) {
      try {
        await this.redisService.get('health:check');
        this.useRedis = true;
        this.logger.log('Security events using Redis backend');
      } catch {
        this.logger.warn(
          'Redis unavailable, using in-memory security event store',
        );
        this.useRedis = false;
      }
    }
  }

  /**
   * Log a security event
   */
  async logEvent(
    event: Omit<SecurityEvent, 'id' | 'timestamp'>,
  ): Promise<void> {
    const logEntry: SecurityEventLog = {
      id: uuidv4(),
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Log to console/file in production
    this.logger.warn(
      `[SECURITY ${event.severity.toUpperCase()}] ${event.type}: ${event.message}`,
      {
        eventId: logEntry.id,
        userId: event.userId,
        tenantId: event.tenantId,
        ipAddress: event.ipAddress,
        endpoint: event.endpoint,
      },
    );

    // Store event
    if (this.useRedis) {
      await this.storeInRedis(logEntry);
    } else {
      this.storeInMemory(logEntry);
    }

    // Handle critical events
    if (event.severity === SecurityEventSeverity.CRITICAL) {
      await this.handleCriticalEvent(logEntry);
    }
  }

  /**
   * Get recent security events
   */
  async getRecentEvents(limit: number = 50): Promise<SecurityEventLog[]> {
    if (this.useRedis) {
      return this.getFromRedis(limit);
    }
    return this.getFromMemory(limit);
  }

  /**
   * Get events by type
   */
  async getEventsByType(
    type: SecurityEventType,
    limit: number = 50,
  ): Promise<SecurityEventLog[]> {
    const allEvents = await this.getRecentEvents(this.maxEventsInMemory);
    return allEvents.filter((e) => e.type === type).slice(0, limit);
  }

  /**
   * Get events by user
   */
  async getEventsByUser(
    userId: string,
    limit: number = 50,
  ): Promise<SecurityEventLog[]> {
    const allEvents = await this.getRecentEvents(this.maxEventsInMemory);
    return allEvents.filter((e) => e.userId === userId).slice(0, limit);
  }

  /**
   * Get events by tenant
   */
  async getEventsByTenant(
    tenantId: string,
    limit: number = 50,
  ): Promise<SecurityEventLog[]> {
    const allEvents = await this.getRecentEvents(this.maxEventsInMemory);
    return allEvents.filter((e) => e.tenantId === tenantId).slice(0, limit);
  }

  /**
   * Get security summary for dashboard
   */
  async getSecuritySummary(): Promise<{
    total: number;
    critical: number;
    warning: number;
    byType: Record<string, number>;
  }> {
    const events = await this.getRecentEvents(this.maxEventsInMemory);

    const summary = {
      total: events.length,
      critical: 0,
      warning: 0,
      byType: {} as Record<string, number>,
    };

    for (const event of events) {
      if (event.severity === SecurityEventSeverity.CRITICAL) {
        summary.critical++;
      } else if (event.severity === SecurityEventSeverity.WARNING) {
        summary.warning++;
      }

      summary.byType[event.type] = (summary.byType[event.type] || 0) + 1;
    }

    return summary;
  }

  /**
   * Clear old events (cleanup)
   */
  async clearOldEvents(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    if (this.useRedis) {
      // Redis cleanup would need to be done via keys scan
      this.logger.log('Redis event cleanup not implemented - use TTL');
      return 0;
    }

    const beforeCount = this.memoryStore.length;
    const cutoffStr = cutoffDate.toISOString();

    this.memoryStore.splice(
      0,
      this.memoryStore.filter((e) => e.timestamp < cutoffStr).length,
    );

    return beforeCount - this.memoryStore.length;
  }

  /**
   * Store event in Redis
   */
  private async storeInRedis(event: SecurityEventLog): Promise<void> {
    const key = `${this.eventLogKey}:${event.id}`;
    const ttlSeconds = 30 * 24 * 60 * 60; // 30 days

    await this.redisService.set(key, JSON.stringify(event), ttlSeconds);

    // Also add to recent list
    const listKey = `${this.eventLogKey}:recent`;
    const existing =
      await this.redisService.getJson<SecurityEventLog[]>(listKey);
    const events = existing || [];

    events.unshift(event);
    // Keep only last 1000 events
    if (events.length > 1000) {
      events.splice(1000);
    }

    await this.redisService.setJson(listKey, events, 86400); // 1 day TTL
  }

  /**
   * Store event in memory
   */
  private storeInMemory(event: SecurityEventLog): void {
    this.memoryStore.unshift(event);

    // Keep only last maxEventsInMemory
    if (this.memoryStore.length > this.maxEventsInMemory) {
      this.memoryStore.splice(this.maxEventsInMemory);
    }
  }

  /**
   * Get events from Redis
   */
  private async getFromRedis(limit: number): Promise<SecurityEventLog[]> {
    const listKey = `${this.eventLogKey}:recent`;
    const events = await this.redisService.getJson<SecurityEventLog[]>(listKey);
    return (events || []).slice(0, limit);
  }

  /**
   * Get events from memory
   */
  private getFromMemory(limit: number): SecurityEventLog[] {
    return this.memoryStore.slice(0, limit);
  }

  /**
   * Handle critical security events
   */
  private async handleCriticalEvent(event: SecurityEventLog): Promise<void> {
    // Could trigger alerts, notifications, etc.
    this.logger.error(`CRITICAL SECURITY EVENT DETECTED: ${event.type}`, {
      eventId: event.id,
      userId: event.userId,
      ipAddress: event.ipAddress,
      endpoint: event.endpoint,
      metadata: event.metadata,
    });

    // TODO: Add integrations for:
    // - Email/Slack notifications
    // - PagerDuty/Sentry alerts
    // - Auto-blocking IP
  }
}
