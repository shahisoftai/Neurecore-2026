/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Rate Limit Service - Token Bucket Implementation
 * ═══════════════════════════════════════════════════════════════════════════
 * Provides rate limiting using Redis for distributed applications.
 * Follows SOLID principles - Single Responsibility for rate limiting.
 */

import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { SecurityEventService } from './security-event.service';
import {
  SecurityEventType,
  SecurityEventSeverity,
  IRateLimitResult,
} from '../../../shared/types/security.types';

/**
 * Rate limit bucket entry
 */
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  ttl: number;
  limit: number;
}

@Injectable()
export class RateLimitService implements OnModuleInit {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly defaultConfig: RateLimitConfig = {
    ttl: 60000, // 1 minute
    limit: 60,
  };
  private readonly memoryStore = new Map<string, RateLimitBucket>();
  private useRedis = false;
  private readonly redisKeyPrefix = 'ratelimit:';

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly securityEventService?: SecurityEventService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Check if Redis is available
    if (this.redisService) {
      try {
        await this.redisService.get('health:check');
        this.useRedis = true;
        this.logger.log('Rate limiting using Redis backend');
      } catch {
        this.logger.warn('Redis unavailable, using in-memory rate limiting');
        this.useRedis = false;
      }
    }
  }

  /**
   * Check if request is allowed under rate limit
   */
  async checkRateLimit(
    identifier: string,
    limit: number = this.defaultConfig.limit,
    ttl: number = this.defaultConfig.ttl,
  ): Promise<IRateLimitResult> {
    const key = `${this.redisKeyPrefix}${identifier}`;
    const now = Date.now();

    let current: RateLimitBucket;

    if (this.useRedis && this.redisService) {
      current = await this.getFromRedis(key, ttl, now);
    } else {
      current = this.getFromMemory(identifier, ttl, now);
    }

    const remaining = Math.floor(current.tokens);
    const resetTime = current.lastRefill + ttl;

    if (remaining <= 0) {
      // Log rate limit exceeded event
      if (this.securityEventService) {
        await this.securityEventService.logEvent({
          type: SecurityEventType.RATE_LIMIT_EXCEEDED,
          severity: SecurityEventSeverity.WARNING,
          message: `Rate limit exceeded for identifier: ${identifier}`,
          metadata: { identifier, limit, ttl },
        });
      }

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      };
    }

    return {
      allowed: true,
      remaining: remaining - 1,
      resetTime,
    };
  }

  /**
   * Consume tokens from the bucket
   */
  async consume(
    identifier: string,
    tokens: number = 1,
    limit: number = this.defaultConfig.limit,
    ttl: number = this.defaultConfig.ttl,
  ): Promise<IRateLimitResult> {
    const result = await this.checkRateLimit(identifier, limit, ttl);

    if (result.allowed) {
      await this.decrementTokens(identifier, tokens, ttl);
    }

    return result;
  }

  /**
   * Get current rate limit status
   */
  async getStatus(identifier: string): Promise<{
    limit: number;
    remaining: number;
    resetTime: number;
  }> {
    const limit = this.defaultConfig.limit;
    const result = await this.checkRateLimit(
      identifier,
      limit,
      this.defaultConfig.ttl,
    );

    return {
      limit,
      remaining: result.remaining,
      resetTime: result.resetTime,
    };
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = `${this.redisKeyPrefix}${identifier}`;

    if (this.useRedis && this.redisService) {
      await this.redisService.del(key);
    } else {
      this.memoryStore.delete(identifier);
    }

    this.logger.debug(`Rate limit reset for: ${identifier}`);
  }

  /**
   * Get bucket from Redis
   */
  private async getFromRedis(
    key: string,
    ttl: number,
    now: number,
  ): Promise<RateLimitBucket> {
    const data = await this.redisService?.get(key);

    if (!data) {
      return {
        tokens: this.defaultConfig.limit,
        lastRefill: now,
      };
    }

    let bucket: RateLimitBucket;
    try {
      bucket = JSON.parse(data);
    } catch {
      bucket = {
        tokens: this.defaultConfig.limit,
        lastRefill: now,
      };
    }

    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = (timePassed / ttl) * this.defaultConfig.limit;

    bucket.tokens = Math.min(
      this.defaultConfig.limit,
      bucket.tokens + tokensToAdd,
    );
    bucket.lastRefill = now;

    const ttlSeconds = Math.ceil(ttl / 1000);
    await this.redisService?.set(key, JSON.stringify(bucket), ttlSeconds);

    return bucket;
  }

  /**
   * Get bucket from memory
   */
  private getFromMemory(
    identifier: string,
    ttl: number,
    now: number,
  ): RateLimitBucket {
    const bucket = this.memoryStore.get(identifier);

    if (!bucket) {
      return {
        tokens: this.defaultConfig.limit,
        lastRefill: now,
      };
    }

    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = (timePassed / ttl) * this.defaultConfig.limit;

    bucket.tokens = Math.min(
      this.defaultConfig.limit,
      bucket.tokens + tokensToAdd,
    );
    bucket.lastRefill = now;

    return bucket;
  }

  /**
   * Decrement tokens in the bucket
   */
  private async decrementTokens(
    identifier: string,
    tokens: number,
    ttl: number,
  ): Promise<void> {
    const now = Date.now();
    const key = `${this.redisKeyPrefix}${identifier}`;

    if (this.useRedis && this.redisService) {
      const bucket = await this.getFromRedis(key, ttl, now);
      bucket.tokens -= tokens;
      const ttlSeconds = Math.ceil(ttl / 1000);
      await this.redisService.set(key, JSON.stringify(bucket), ttlSeconds);
    } else {
      const bucket = this.getFromMemory(identifier, ttl, now);
      bucket.tokens -= tokens;
      this.memoryStore.set(identifier, bucket);
    }
  }
}
