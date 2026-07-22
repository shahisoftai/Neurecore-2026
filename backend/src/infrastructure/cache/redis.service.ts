import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LRUCache } from 'lru-cache';
// @upstash/redis is an optional dependency. The class is loaded dynamically
// so projects without the package can still build.
type UpstashRedisClass = new (opts: { url: string; token: string }) => unknown;
let UpstashRedis: UpstashRedisClass | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  UpstashRedis = require('@upstash/redis').Redis;
} catch (e) {
  UpstashRedis = null;
}

// Single Responsibility: manages Redis connection and common operations.
// Optimized for Upstash Redis compatibility
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;
  // If using Upstash REST client, this will hold the client instance
  // use `any` to avoid complex typing for the dynamically-required client
  private upstashClient: any = null;
  private isConnected = false;

  // PERF-FIX: in-process LRU cache for token-blacklist checks.
  // On Contabo (DE) → Upstash (US) the network round-trip alone is
  // ~150-300ms. JwtStrategy.validate() runs on EVERY authenticated
  // request, so caching the "not blacklisted" verdict for 30s collapses
  // dozens of round-trips per page load into one.
  // Positive verdicts (blacklisted) are also cached, with a shorter TTL
  // matching the remaining token lifetime so we don't accidentally
  // resurrect a revoked token after the TTL.
  private readonly blacklistCache = new LRUCache<string, boolean>({
    max: 50_000,
    ttl: 30_000, // 30s for the "not blacklisted" verdict
  });

  // Part 9 N11 — log dedupe: when Redis is down, the methods below would
  // log a warning on every request (hundreds per second under load).
  // We track which messages we've already fired in this Redis-down
  // window so the operator gets one clean notice instead of a flood.
  // Set is cleared whenever isConnected flips back to true.
  private readonly warnedKeys = new Set<string>();

  private warnOnce(key: string, message: string): void {
    if (this.warnedKeys.has(key)) return;
    this.warnedKeys.add(key);
    this.logger.warn(message);
  }

  constructor(private readonly config?: ConfigService) {}

  onModuleInit(): void {
    const redisUrl = this.config
      ? this.config.get<string>('REDIS_URL', 'redis://localhost:6379/0')
      : process.env.REDIS_URL || 'redis://localhost:6379/0';

    const upstashRestUrl = this.config
      ? this.config.get<string | undefined>('UPSTASH_REDIS_REST_URL')
      : process.env.UPSTASH_REDIS_REST_URL;
    const upstashRestToken = this.config
      ? this.config.get<string | undefined>('UPSTASH_REDIS_REST_TOKEN')
      : process.env.UPSTASH_REDIS_REST_TOKEN;

    // Check if using Upstash (either via REDIS_URL or REST integration)
    const isUpstash =
      Boolean(upstashRestUrl && upstashRestToken) ||
      redisUrl.includes('upstash.io');

    const options: any = {
      // Upstash-specific configuration
      maxRetriesPerRequest: isUpstash ? 3 : 1,
      retryStrategy: (times: number) => {
        if (times > 2) return null; // Stop retrying after 2 attempts
        const delay = isUpstash
          ? Math.min(times * 200, 2000)
          : Math.min(times * 50, 500);
        this.logger.log(`Redis retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      lazyConnect: false,
      // Fast timeouts for local Redis; slightly longer for Upstash
      connectTimeout: isUpstash ? 3000 : 1000,
      commandTimeout: isUpstash ? 2000 : 500,
      // Disable some commands that Upstash doesn't support well
      skipCommandSet: isUpstash
        ? ['CLIENT', 'CLUSTER', 'DEBUG', 'SLOWLOG', 'MEMORY']
        : [],
    };

    // Prefer Upstash REST client in serverless (Vercel) environments when provided
    if (upstashRestUrl && upstashRestToken && UpstashRedis) {
      this.logger.log('Using Upstash REST client for Redis');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      this.upstashClient = new UpstashRedis({
        url: upstashRestUrl,
        token: upstashRestToken,
      });
      // The Upstash REST client doesn't maintain persistent connections like ioredis
      this.isConnected = true;
      return;
    }

    // Fallback to ioredis for normal Redis URL (including Upstash TCP URL)
    this.client = new Redis(redisUrl, options);

    this.client.on('connect', () => {
      this.isConnected = true;
      // N11 — re-emit warnings on the next disconnect.
      this.warnedKeys.clear();
      this.logger.log('Redis connected');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      this.warnedKeys.clear();
      this.logger.log('Redis ready');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      this.logger.error('Redis error', err);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.log('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis reconnecting...');
    });
  }

  onModuleDestroy(): void {
    try {
      if (
        this.upstashClient &&
        typeof this.upstashClient.disconnect === 'function'
      ) {
        this.upstashClient.disconnect();
      }
    } catch {
      /* ignore teardown errors */
    }
    try {
      if (this.client) this.client.quit();
    } catch {
      /* ignore teardown errors */
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.upstashClient) {
      if (ttlSeconds)
        await this.upstashClient.set(key, value, { ex: ttlSeconds });
      else await this.upstashClient.set(key, value);
      return;
    }
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.upstashClient) {
      const res = await this.upstashClient.get(key);
      // Upstash returns null or string
      return res as string | null;
    }
    return this.client.get(key);
  }

  async del(key: string): Promise<void> {
    if (this.upstashClient) {
      await this.upstashClient.del(key);
      return;
    }
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (this.upstashClient) {
      const v = await this.upstashClient.get(key);
      return v !== null && v !== undefined;
    }
    const count = await this.client.exists(key);
    return count > 0;
  }

  /**
   * Atomically increment a counter, returning the new value.
   * Used for sliding-window rate limiting (Phase 5 AI Action guard).
   */
  async incr(key: string): Promise<number> {
    if (this.upstashClient) {
      const res = await this.upstashClient.incr(key);
      return Number(res ?? 0);
    }
    const res = await this.client.incr(key);
    return Number(res ?? 0);
  }

  /**
   * Set a TTL on an existing key. No-op if the key doesn't exist.
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (this.upstashClient) {
      await this.upstashClient.expire(key, ttlSeconds);
      return;
    }
    await this.client.expire(key, ttlSeconds);
  }

  /**
   * SCAN-based key discovery. Cursor-based, non-blocking — safe for
   * large multi-tenant keyspaces. Returns up to `count` keys per call
   * and a cursor the caller must pass back. When `cursor === '0'` the
   * iteration is complete.
   *
   * Upstash REST has no SCAN, so we degrade to a single KEYS call.
   * Acceptable because Upstash Redis keyspaces are typically small and
   * this is only used by background sweep jobs.
   */
  async scan(
    cursor: string,
    match: string,
    count: number,
  ): Promise<[string, string[]]> {
    if (this.upstashClient) {
      const keys = await this.upstashClient.keys(match);
      return ['0', (keys as string[] | undefined) ?? []];
    }
    const result = (await this.client.scan(
      cursor,
      'MATCH',
      match,
      'COUNT',
      count,
    )) as [string, string[]];
    return result;
  }

  /**
   * KEYS-based lookup. WARNING: blocks Redis O(N). Use `scan()` instead
   * for production code paths. Provided for small/test keyspaces only.
   */
  async keys(pattern: string): Promise<string[]> {
    if (this.upstashClient) {
      const keys = await this.upstashClient.keys(pattern);
      return (keys as string[] | undefined) ?? [];
    }
    return this.client.keys(pattern);
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  // Blacklist a JWT token (for logout/revocation)
  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    if (!this.isConnected) {
      // N11 — single warning per Redis-down window, not per call.
      this.warnOnce(
        'redis.blacklistToken.down',
        'Redis not connected, skipping token blacklist (further warnings suppressed until Redis reconnects)',
      );
      return;
    }
    try {
      await this.set(`bl:${jti}`, '1', ttlSeconds);
      // PERF-FIX: also poison the local cache so in-flight requests for
      // this same JTI get the blacklisted verdict immediately without
      // racing the Redis write.
      this.blacklistCache.set(`bl:${jti}`, true, { ttl: ttlSeconds * 1000 });
    } catch (err) {
      this.logger.warn(`Failed to blacklist token: ${String(err)}`);
    }
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const cacheKey = `bl:${jti}`;
    // PERF-FIX: short-circuit on the local LRU before paying the remote
    // round-trip. Cache entries auto-expire after 30s for "not
    // blacklisted" verdicts, so a revoke that happens after a token has
    // been seen will take effect within at most 30s — acceptable for
    // logout-revocation (Next refresh will re-check).
    const cached = this.blacklistCache.get(cacheKey);
    if (cached !== undefined) return cached;

    if (!this.isConnected) {
      this.warnOnce(
        'redis.isBlacklisted.down',
        'Redis not connected, failing open for token check (further warnings suppressed until Redis reconnects)',
      );
      // Fail-open + cache the verdict so we don't keep warning.
      this.blacklistCache.set(cacheKey, false);
      return false;
    }
    try {
      const isBl = await this.exists(cacheKey);
      this.blacklistCache.set(cacheKey, isBl);
      return isBl;
    } catch (err) {
      this.warnOnce(
        `redis.isBlacklisted.error.${(err as Error).message.slice(0, 80)}`,
        `Redis unavailable when checking token blacklist: ${String(err)} (further warnings of this type suppressed)`,
      );
      // Fail-open: cache the negative verdict for 30s so subsequent
      // requests don't hammer a downed Redis.
      this.blacklistCache.set(cacheKey, false);
      return false;
    }
  }
}
