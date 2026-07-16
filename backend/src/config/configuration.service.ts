/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Configuration Service
 * ═══════════════════════════════════════════════════════════════════════════
 * Provides type-safe access to validated configuration.
 * Implements the Dependency Inversion Principle - depends on abstractions (interfaces)
 * not concrete implementations.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import type {
  AppEnvironment,
  DatabaseConfig,
  CacheConfig,
  JwtConfig,
  RateLimitConfig,
  CorsConfig,
  SecurityConfig,
  AiConfig,
  FeatureFlagsConfig,
  ObservabilityConfig,
  BrevoConfig,
  Environment,
} from './env.loader';

/**
 * Configuration Service Interface
 * Defines the contract for accessing configuration values
 * Following Dependency Inversion Principle
 */
export interface IConfigService {
  // Environment
  get<T = string>(key: string): T;
  getOrThrow<T = string>(key: string): T;
  getEnvironment(): Environment;
  isProduction(): boolean;
  isDevelopment(): boolean;
  isTest(): boolean;

  // Database
  getDatabase(): DatabaseConfig;

  // Cache
  getCache(): CacheConfig;

  // JWT
  getJwt(): JwtConfig;

  // Rate Limiting
  getRateLimit(): RateLimitConfig;

  // CORS
  getCors(): CorsConfig;

  // Security
  getSecurity(): SecurityConfig;

  // AI
  getAi(): AiConfig;

  // Feature Flags
  getFeatureFlags(): FeatureFlagsConfig;

  // Observability
  getObservability(): ObservabilityConfig;

  // Brevo
  getBrevo(): BrevoConfig;

  // All config
  getAll(): AppEnvironment;
}

/**
 * Configuration Service Implementation
 * Wraps NestJS ConfigService with type-safe methods
 */
@Injectable()
export class ConfigurationService implements IConfigService {
  constructor(private readonly configService: NestConfigService) {}

  /**
   * Get a configuration value
   */
  get<T = string>(key: string): T {
    return this.configService.get<T>(key) as T;
  }

  /**
   * Get a configuration value or throw if not found
   */
  getOrThrow<T = string>(key: string): T {
    const value = this.configService.get<T>(key);
    if (value === undefined || value === null) {
      throw new Error(`Configuration key "${key}" is not defined`);
    }
    return value as T;
  }

  /**
   * Get current environment
   */
  getEnvironment(): Environment {
    return this.get<Environment>('NODE_ENV') || 'development';
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  /**
   * Check if running in test
   */
  isTest(): boolean {
    return this.getEnvironment() === 'test';
  }

  /**
   * Get database configuration
   */
  getDatabase(): DatabaseConfig {
    return {
      DATABASE_URL: this.getOrThrow<string>('DATABASE_URL'),
      DATABASE_URL_UNPOOLED: this.get<string>('DATABASE_URL_UNPOOLED'),
      POSTGRES_URL: this.get<string>('POSTGRES_URL'),
      POSTGRES_URL_NON_POOLING: this.get<string>('POSTGRES_URL_NON_POOLING'),
      POSTGRES_USER: this.get<string>('POSTGRES_USER'),
      POSTGRES_HOST: this.get<string>('POSTGRES_HOST'),
      POSTGRES_PASSWORD: this.get<string>('POSTGRES_PASSWORD'),
      POSTGRES_DATABASE: this.get<string>('POSTGRES_DATABASE'),
      POSTGRES_URL_NO_SSL: this.get<string>('POSTGRES_URL_NO_SSL'),
      POSTGRES_PRISMA_URL: this.get<string>('POSTGRES_PRISMA_URL'),
      DATABASE_POOL_SIZE: this.get<number>('DATABASE_POOL_SIZE') || 10,
      DATABASE_CONNECTION_TIMEOUT:
        this.get<number>('DATABASE_CONNECTION_TIMEOUT') || 10,
      DATABASE_STATEMENT_TIMEOUT:
        this.get<number>('DATABASE_STATEMENT_TIMEOUT') || 30,
    };
  }

  /**
   * Get cache configuration
   */
  getCache(): CacheConfig {
    return {
      REDIS_URL: this.get<string>('REDIS_URL') || 'redis://localhost:6379/0',
      UPSTASH_REDIS_URL: this.get<string>('UPSTASH_REDIS_URL'),
      UPSTASH_REDIS_REST_URL: this.get<string>('UPSTASH_REDIS_REST_URL'),
      UPSTASH_REDIS_REST_TOKEN: this.get<string>('UPSTASH_REDIS_REST_TOKEN'),
      CACHE_TTL_DEFAULT: this.get<number>('CACHE_TTL_DEFAULT') || 3600,
      CACHE_TTL_SHORT: this.get<number>('CACHE_TTL_SHORT') || 60,
      CACHE_TTL_LONG: this.get<number>('CACHE_TTL_LONG') || 86400,
    };
  }

  /**
   * Get JWT configuration
   */
  getJwt(): JwtConfig {
    return {
      JWT_SECRET: this.getOrThrow<string>('JWT_SECRET'),
      JWT_ACCESS_EXPIRES: this.get<string>('JWT_ACCESS_EXPIRES') || '15m',
      JWT_REFRESH_EXPIRES: this.get<string>('JWT_REFRESH_EXPIRES') || '7d',
      JWT_ALGORITHM:
        this.get<'HS256' | 'HS384' | 'HS512'>('JWT_ALGORITHM') || 'HS256',
      JWT_ISSUER: this.get<string>('JWT_ISSUER'),
      JWT_AUDIENCE: this.get<string>('JWT_AUDIENCE'),
    };
  }

  /**
   * Get rate limiting configuration
   */
  getRateLimit(): RateLimitConfig {
    return {
      THROTTLE_TTL: this.get<number>('THROTTLE_TTL') || 60000,
      THROTTLE_LIMIT: this.get<number>('THROTTLE_LIMIT') || 60,
      THROTTLE_AUTH_LIMIT: this.get<number>('THROTTLE_AUTH_LIMIT') || 10,
      THROTTLE_API_LIMIT: this.get<number>('THROTTLE_API_LIMIT') || 100,
      THROTTLE_UPLOAD_LIMIT: this.get<number>('THROTTLE_UPLOAD_LIMIT') || 5,
    };
  }

  /**
   * Get CORS configuration
   */
  getCors(): CorsConfig {
    return {
      CORS_ENABLED: this.get<boolean>('CORS_ENABLED') ?? true,
      CORS_ORIGINS: this.get<string>('CORS_ORIGINS'),
      CORS_CREDENTIALS: this.get<boolean>('CORS_CREDENTIALS') ?? true,
      CORS_METHODS:
        this.get<string>('CORS_METHODS') || 'GET,HEAD,PUT,PATCH,POST,DELETE',
      CORS_HEADERS:
        this.get<string>('CORS_HEADERS') || 'Content-Type,Authorization',
    };
  }

  /**
   * Get security configuration
   */
  getSecurity(): SecurityConfig {
    return {
      SESSION_SECRET: this.get<string>('SESSION_SECRET'),
      SESSION_COOKIE_NAME:
        this.get<string>('SESSION_COOKIE_NAME') || 'neurecore.sid',
      SESSION_COOKIE_SECURE: this.get<boolean>('SESSION_COOKIE_SECURE') ?? true,
      SESSION_COOKIE_SAMESITE:
        this.get<'strict' | 'lax' | 'none'>('SESSION_COOKIE_SAMESITE') || 'lax',
      SESSION_MAX_AGE: this.get<number>('SESSION_MAX_AGE') || 86400000,
      CSRF_ENABLED: this.get<boolean>('CSRF_ENABLED') ?? true,
      HELMET_ENABLED: this.get<boolean>('HELMET_ENABLED') ?? true,
      API_KEY_HEADER: this.get<string>('API_KEY_HEADER') || 'x-api-key',
      RATE_LIMIT_BY_IP: this.get<boolean>('RATE_LIMIT_BY_IP') ?? true,
    };
  }

  /**
   * Get AI configuration
   *
   * Per ai-gateway-imp-plan.md §3.1 row S31: API keys and per-model
   * defaults have moved to the gateway catalog (DB-backed). Only
   * non-secret gateway knobs live here.
   */
  getAi(): AiConfig {
    return {
      AI_STREAMING_ENABLED: this.get<boolean>('AI_STREAMING_ENABLED') ?? true,
      AI_FUNCTION_CALLING_ENABLED:
        this.get<boolean>('AI_FUNCTION_CALLING_ENABLED') ?? true,
      DEFAULT_AGENT_MODEL: this.get<string>('DEFAULT_AGENT_MODEL'),
    };
  }

  /**
   * Get feature flags configuration
   */
  getFeatureFlags(): FeatureFlagsConfig {
    return {
      FEATURE_ANALYTICS_ENABLED:
        this.get<boolean>('FEATURE_ANALYTICS_ENABLED') ?? true,
      FEATURE_CONNECTORS_ENABLED:
        this.get<boolean>('FEATURE_CONNECTORS_ENABLED') ?? true,
      FEATURE_NOTIFICATIONS_ENABLED:
        this.get<boolean>('FEATURE_NOTIFICATIONS_ENABLED') ?? true,
      FEATURE_AUDIT_LOG_ENABLED:
        this.get<boolean>('FEATURE_AUDIT_LOG_ENABLED') ?? true,
      FEATURE_VOICE_COMMANDS_ENABLED:
        this.get<boolean>('FEATURE_VOICE_COMMANDS_ENABLED') ?? false,
      FEATURE_WORKFLOW_AUTOMATION_ENABLED:
        this.get<boolean>('FEATURE_WORKFLOW_AUTOMATION_ENABLED') ?? false,
      FEATURE_ADVANCED_REPORTING_ENABLED:
        this.get<boolean>('FEATURE_ADVANCED_REPORTING_ENABLED') ?? false,
      FEATURE_DEBUG_MODE: this.get<boolean>('FEATURE_DEBUG_MODE') ?? false,
      FEATURE_MAINTENANCE_MODE:
        this.get<boolean>('FEATURE_MAINTENANCE_MODE') ?? false,
    };
  }

  /**
   * Get observability configuration
   */
  getObservability(): ObservabilityConfig {
    return {
      SENTRY_DSN: this.get<string>('SENTRY_DSN'),
      SENTRY_ENVIRONMENT: this.get<string>('SENTRY_ENVIRONMENT'),
      SENTRY_TRACES_SAMPLE_RATE:
        this.get<number>('SENTRY_TRACES_SAMPLE_RATE') || 0.1,
      OTEL_ENABLED: this.get<boolean>('OTEL_ENABLED') ?? false,
      OTEL_EXPORTER_OTLP_ENDPOINT: this.get<string>(
        'OTEL_EXPORTER_OTLP_ENDPOINT',
      ),
      OTEL_SERVICE_NAME:
        this.get<string>('OTEL_SERVICE_NAME') || 'neurecore-backend',
      LOG_FORMAT: this.get<'json' | 'pretty'>('LOG_FORMAT') || 'json',
      LOG_PRETTY_PRINT: this.get<boolean>('LOG_PRETTY_PRINT') ?? false,
    };
  }

  /**
   * Get Brevo configuration.
   *
   * `masterApiKey` is the platform-level key decoded from BREVO_MASTER_API_KEY
   * (or the legacy BREVO_API base64 blob). When a per-tenant key exists it is
   * preferred; this master key is the fallback used to bootstrap new tenants.
   */
  getBrevo(): BrevoConfig {
    return {
      masterApiKey: this.get<string>('BREVO_MASTER_API_KEY') || null,
      fromAddress:
        this.get<string>('EMAIL_FROM_ADDRESS') ||
        this.get<string>('SMTP_FROM') ||
        '',
      fromName: this.get<string>('EMAIL_FROM_NAME') || 'NeureCore',
      replyTo: this.get<string>('EMAIL_REPLY_TO') || null,
      dailyLimit: this.get<number>('BREVO_DAILY_LIMIT') || 300,
      apiBaseUrl:
        this.get<string>('BREVO_API_BASE_URL') || 'https://api.brevo.com/v3',
    };
  }

  /**
   * Get all configuration
   */
  getAll(): AppEnvironment {
    return {
      // App
      NODE_ENV: this.getEnvironment(),
      PORT: this.get<number>('PORT') || 3000,
      BACKEND_PORT: this.get<number>('BACKEND_PORT') || 3000,
      API_PREFIX: this.get<string>('API_PREFIX') || '/api/v1',
      LOG_LEVEL:
        this.get<'debug' | 'info' | 'warn' | 'error'>('LOG_LEVEL') || 'info',

      // Frontend URLs
      TENANT_FRONTEND_URL:
        this.get<string>('TENANT_FRONTEND_URL') || 'http://localhost:3001',
      ADMIN_FRONTEND_URL:
        this.get<string>('ADMIN_FRONTEND_URL') || 'http://localhost:3002',
      ADDITIONAL_CORS_ORIGINS: this.get<string>('ADDITIONAL_CORS_ORIGINS'),

      // Database
      ...this.getDatabase(),

      // Cache
      ...this.getCache(),

      // JWT
      ...this.getJwt(),

      // Rate Limit
      ...this.getRateLimit(),

      // CORS
      ...this.getCors(),

      // Security
      ...this.getSecurity(),

      // AI
      ...this.getAi(),

      // Feature Flags
      ...this.getFeatureFlags(),

      // Observability
      ...this.getObservability(),

      // Brevo
      ...this.getBrevo(),

      // Upload
      MAX_FILE_SIZE: this.get<number>('MAX_FILE_SIZE') || 10485760,
      MAX_FILES_PER_REQUEST: this.get<number>('MAX_FILES_PER_REQUEST') || 5,
      ALLOWED_FILE_TYPES:
        this.get<string>('ALLOWED_FILE_TYPES') ||
        'image/jpeg,image/png,image/webp,application/pdf',
      UPLOAD_DIR: this.get<string>('UPLOAD_DIR') || './uploads',
      STORAGE_TYPE: this.get<'local' | 's3' | 'gcs'>('STORAGE_TYPE') || 'local',
      AWS_S3_BUCKET: this.get<string>('AWS_S3_BUCKET'),
      AWS_S3_REGION: this.get<string>('AWS_S3_REGION'),
      AWS_ACCESS_KEY_ID: this.get<string>('AWS_ACCESS_KEY_ID'),
      AWS_SECRET_ACCESS_KEY: this.get<string>('AWS_SECRET_ACCESS_KEY'),

      // Email
      EMAIL_PROVIDER:
        this.get<'smtp' | 'sendgrid' | 'ses' | 'mailgun'>('EMAIL_PROVIDER') ||
        'smtp',
      SMTP_HOST: this.get<string>('SMTP_HOST'),
      SMTP_PORT: this.get<number>('SMTP_PORT') || 587,
      SMTP_USER: this.get<string>('SMTP_USER'),
      SMTP_PASSWORD: this.get<string>('SMTP_PASSWORD'),
      SMTP_FROM: this.get<string>('SMTP_FROM'),
      SMTP_SECURE: this.get<boolean>('SMTP_SECURE') ?? false,
      SENDGRID_API_KEY: this.get<string>('SENDGRID_API_KEY'),
      MAILGUN_API_KEY: this.get<string>('MAILGUN_API_KEY'),
      MAILGUN_DOMAIN: this.get<string>('MAILGUN_DOMAIN'),
      EMAIL_FROM_NAME: this.get<string>('EMAIL_FROM_NAME') || 'NeureCore',

      // External Services
      WS_ENABLED: this.get<boolean>('WS_ENABLED') ?? true,
      WS_PING_INTERVAL: this.get<number>('WS_PING_INTERVAL') || 25000,
      WS_PING_TIMEOUT: this.get<number>('WS_PING_TIMEOUT') || 20000,
      ANALYTICS_WRITE_KEY: this.get<string>('ANALYTICS_WRITE_KEY'),
      SALESFORCE_CLIENT_ID: this.get<string>('SALESFORCE_CLIENT_ID'),
      SALESFORCE_CLIENT_SECRET: this.get<string>('SALESFORCE_CLIENT_SECRET'),
      SALESFORCE_INSTANCE_URL: this.get<string>('SALESFORCE_INSTANCE_URL'),
      HUBSPOT_ACCESS_TOKEN: this.get<string>('HUBSPOT_ACCESS_TOKEN'),
      STORAGE_PROVIDER:
        this.get<'local' | 's3' | 'gcs'>('STORAGE_PROVIDER') || 'local',
    };
  }
}
