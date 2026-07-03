/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Frontend Configuration - Admin Application
 * ═══════════════════════════════════════════════════════════════════════════
 * Type-safe environment configuration for the Admin frontend.
 * Supports Vercel environment variables and client-side configuration.
 */

/**
 * Environment Interface for Frontend Admin
 */
export interface FrontendEnvConfig {
  // Application
  NODE_ENV: "development" | "production" | "test";

  // API Configuration
  NEXT_PUBLIC_API_URL: string;
  NEXT_PUBLIC_API_TIMEOUT: number;

  // Frontend URLs
  NEXT_PUBLIC_TENANT_URL: string;
  NEXT_PUBLIC_ADMIN_URL: string;

  // App Info
  NEXT_PUBLIC_APP_NAME: string;
  NEXT_PUBLIC_APP_VERSION: string;

  // Feature Flags
  NEXT_PUBLIC_ENABLE_ANALYTICS: boolean;
  NEXT_PUBLIC_ENABLE_DEBUG: boolean;
  NEXT_PUBLIC_ENABLE_MAINTENANCE: boolean;

  // UI Configuration
  NEXT_PUBLIC_DEFAULT_THEME: "light" | "dark" | "system";
  NEXT_PUBLIC_ENABLE_ANIMATIONS: boolean;
  NEXT_PUBLIC_ENABLE_SOUND: boolean;

  // Third-party Services
  NEXT_PUBLIC_SENTRY_DSN?: string;
  NEXT_PUBLIC_SENTRY_ENVIRONMENT?: string;

  // WebSocket
  NEXT_PUBLIC_WS_URL: string;

  // Storage
  NEXT_PUBLIC_STORAGE_PROVIDER: "local" | "s3" | "gcs";
  NEXT_PUBLIC_S3_BUCKET?: string;
}

/**
 * Default configuration values
 */
const defaultConfig: FrontendEnvConfig = {
  NODE_ENV: "development",
  NEXT_PUBLIC_API_URL: "http://127.0.0.1:3003/api/v1",
  NEXT_PUBLIC_API_TIMEOUT: 30000,
  NEXT_PUBLIC_TENANT_URL: "http://127.0.0.1:3001",
  NEXT_PUBLIC_ADMIN_URL: "http://127.0.0.1:3002",
  NEXT_PUBLIC_APP_NAME: "NeureCore Admin",
  NEXT_PUBLIC_APP_VERSION: "1.0.0",
  NEXT_PUBLIC_ENABLE_ANALYTICS: true,
  NEXT_PUBLIC_ENABLE_DEBUG: false,
  NEXT_PUBLIC_ENABLE_MAINTENANCE: false,
  NEXT_PUBLIC_DEFAULT_THEME: "system",
  NEXT_PUBLIC_ENABLE_ANIMATIONS: true,
  NEXT_PUBLIC_ENABLE_SOUND: false,
  NEXT_PUBLIC_SENTRY_DSN: undefined,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: undefined,
  NEXT_PUBLIC_WS_URL: "ws://127.0.0.1:3003",
  NEXT_PUBLIC_STORAGE_PROVIDER: "local",
  NEXT_PUBLIC_S3_BUCKET: undefined,
};

/**
 * Parse boolean environment variable
 */
function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) return defaultValue;
  return value === "true";
}

/**
 * Parse string environment variable
 */
function parseString(value: string | undefined, defaultValue: string): string {
  return value ?? defaultValue;
}

/**
 * Parse number environment variable
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Configuration singleton
 */
class FrontendConfig {
  private static instance: FrontendConfig;
  private config: FrontendEnvConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FrontendConfig {
    if (!FrontendConfig.instance) {
      FrontendConfig.instance = new FrontendConfig();
    }
    return FrontendConfig.instance;
  }

  /**
   * Load configuration from environment
   */
  private loadConfig(): FrontendEnvConfig {
    return {
      NODE_ENV:
        (process.env.NODE_ENV as FrontendEnvConfig["NODE_ENV"]) ||
        defaultConfig.NODE_ENV,
      NEXT_PUBLIC_API_URL: parseString(
        process.env.NEXT_PUBLIC_API_URL,
        defaultConfig.NEXT_PUBLIC_API_URL,
      ),
      NEXT_PUBLIC_API_TIMEOUT: parseNumber(
        process.env.NEXT_PUBLIC_API_TIMEOUT,
        defaultConfig.NEXT_PUBLIC_API_TIMEOUT,
      ),
      NEXT_PUBLIC_TENANT_URL: parseString(
        process.env.NEXT_PUBLIC_TENANT_URL,
        defaultConfig.NEXT_PUBLIC_TENANT_URL,
      ),
      NEXT_PUBLIC_ADMIN_URL: parseString(
        process.env.NEXT_PUBLIC_ADMIN_URL,
        defaultConfig.NEXT_PUBLIC_ADMIN_URL,
      ),
      NEXT_PUBLIC_APP_NAME: parseString(
        process.env.NEXT_PUBLIC_APP_NAME,
        defaultConfig.NEXT_PUBLIC_APP_NAME,
      ),
      NEXT_PUBLIC_APP_VERSION: parseString(
        process.env.NEXT_PUBLIC_APP_VERSION,
        defaultConfig.NEXT_PUBLIC_APP_VERSION,
      ),
      NEXT_PUBLIC_ENABLE_ANALYTICS: parseBoolean(
        process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
        defaultConfig.NEXT_PUBLIC_ENABLE_ANALYTICS,
      ),
      NEXT_PUBLIC_ENABLE_DEBUG: parseBoolean(
        process.env.NEXT_PUBLIC_ENABLE_DEBUG,
        defaultConfig.NEXT_PUBLIC_ENABLE_DEBUG,
      ),
      NEXT_PUBLIC_ENABLE_MAINTENANCE: parseBoolean(
        process.env.NEXT_PUBLIC_ENABLE_MAINTENANCE,
        defaultConfig.NEXT_PUBLIC_ENABLE_MAINTENANCE,
      ),
      NEXT_PUBLIC_DEFAULT_THEME:
        (process.env
          .NEXT_PUBLIC_DEFAULT_THEME as FrontendEnvConfig["NEXT_PUBLIC_DEFAULT_THEME"]) ||
        defaultConfig.NEXT_PUBLIC_DEFAULT_THEME,
      NEXT_PUBLIC_ENABLE_ANIMATIONS: parseBoolean(
        process.env.NEXT_PUBLIC_ENABLE_ANIMATIONS,
        defaultConfig.NEXT_PUBLIC_ENABLE_ANIMATIONS,
      ),
      NEXT_PUBLIC_ENABLE_SOUND: parseBoolean(
        process.env.NEXT_PUBLIC_ENABLE_SOUND,
        defaultConfig.NEXT_PUBLIC_ENABLE_SOUND,
      ),
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      NEXT_PUBLIC_SENTRY_ENVIRONMENT:
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
      NEXT_PUBLIC_WS_URL: parseString(
        process.env.NEXT_PUBLIC_WS_URL,
        defaultConfig.NEXT_PUBLIC_WS_URL,
      ),
      NEXT_PUBLIC_STORAGE_PROVIDER:
        (process.env
          .NEXT_PUBLIC_STORAGE_PROVIDER as FrontendEnvConfig["NEXT_PUBLIC_STORAGE_PROVIDER"]) ||
        defaultConfig.NEXT_PUBLIC_STORAGE_PROVIDER,
      NEXT_PUBLIC_S3_BUCKET: process.env.NEXT_PUBLIC_S3_BUCKET,
    };
  }

  /**
   * Get configuration value
   */
  get<K extends keyof FrontendEnvConfig>(key: K): FrontendEnvConfig[K] {
    return this.config[key];
  }

  /**
   * Get all configuration
   */
  getAll(): FrontendEnvConfig {
    return this.config;
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.config.NODE_ENV === "production";
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.config.NODE_ENV === "development";
  }

  /**
   * Check if running in test
   */
  isTest(): boolean {
    return this.config.NODE_ENV === "test";
  }

  /**
   * Get API URL
   */
  getApiUrl(): string {
    return this.config.NEXT_PUBLIC_API_URL;
  }

  /**
   * Get WebSocket URL
   */
  getWsUrl(): string {
    return this.config.NEXT_PUBLIC_WS_URL;
  }

  /**
   * Check if analytics is enabled
   */
  isAnalyticsEnabled(): boolean {
    return this.config.NEXT_PUBLIC_ENABLE_ANALYTICS;
  }

  /**
   * Check if debug mode is enabled
   */
  isDebugEnabled(): boolean {
    return this.config.NEXT_PUBLIC_ENABLE_DEBUG;
  }

  /**
   * Check if maintenance mode is enabled
   */
  isMaintenanceModeEnabled(): boolean {
    return this.config.NEXT_PUBLIC_ENABLE_MAINTENANCE;
  }

  /**
   * Get app name
   */
  getAppName(): string {
    return this.config.NEXT_PUBLIC_APP_NAME;
  }

  /**
   * Get app version
   */
  getAppVersion(): string {
    return this.config.NEXT_PUBLIC_APP_VERSION;
  }
}

// Export singleton instance
export const frontendConfig = FrontendConfig.getInstance();

// Export default config for reference
export { defaultConfig };
