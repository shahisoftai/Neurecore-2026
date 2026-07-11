/**
 * Secret Interfaces — SOLID: Interface Segregation
 *
 * Single responsibility interfaces for centralized secret management.
 * All secrets should be accessed through these interfaces.
 *
 * @module security/interfaces
 */

// ─────────────────────────────────────────────────────────────
// ISecretResult — Result of secret resolution
// ─────────────────────────────────────────────────────────────

export interface ISecretResult {
  value: string;
  expiresAt?: number;
  source: 'env' | 'vault' | 'cache';
}

// ─────────────────────────────────────────────────────────────
// ISecretProvider — Main interface for secret access
// ─────────────────────────────────────────────────────────────

export interface ISecretProvider {
  /**
   * Resolve a secret reference
   * @param ref - Secret reference (e.g., 'env:OPENCLAW_API_KEY')
   * @returns Secret result with value and metadata
   */
  resolve(ref: string): ISecretResult;

  /**
   * Get OpenClaw API key
   */
  getOpenClawApiKey(): string;

  /**
   * Get JWT secret
   */
  getJwtSecret(): string;

  /**
   * Get OpenAI API key
   */
  getOpenAiApiKey(): string;

  /**
   * Get Anthropic API key
   */
  getAnthropicApiKey(): string;

  /**
   * Get MiniMax API key
   */
  getMiniMaxApiKey(): string;

  /**
   * Get DeepSeek API key
   */
  getDeepSeekApiKey(): string;

  /**
   * Get Xiaomi MiMo API key
   */
  getMimoApiKey(): string;

  /**
   * Get database URL
   */
  getDatabaseUrl(): string;

  /**
   * Get Redis URL
   */
  getRedisUrl(): string;

  /**
   * Check if a secret exists
   * @param ref - Secret reference
   */
  has(ref: string): boolean;
}

// ─────────────────────────────────────────────────────────────
// ISecretRotator — Interface for secret rotation
// ─────────────────────────────────────────────────────────────

export interface ISecretRotator {
  /**
   * Rotate a secret
   * @param secretName - Name of the secret
   * @param newValue - New secret value
   */
  rotate(secretName: string, newValue: string): Promise<void>;

  /**
   * Schedule automatic rotation
   * @param secretName - Name of the secret
   * @param intervalMs - Rotation interval in milliseconds
   */
  scheduleRotation(secretName: string, intervalMs: number): void;
}

// ─────────────────────────────────────────────────────────────
// ISecretAuditLogger — Interface for secret access auditing
// ─────────────────────────────────────────────────────────────

export interface ISecretAuditEvent {
  timestamp: Date;
  action: 'ACCESS' | 'ROTATE' | 'CACHE_HIT' | 'CACHE_MISS';
  secretName: string;
  source?: 'env' | 'vault';
  success: boolean;
  error?: string;
}

export interface ISecretAuditLogger {
  /**
   * Log secret access
   */
  log(event: ISecretAuditEvent): void;
}

// ─────────────────────────────────────────────────────────────
// Secret Reference Types
// ─────────────────────────────────────────────────────────────

/**
 * Supported secret reference formats
 */
export type SecretRef =
  | `env:${string}` // Environment variable: env:OPENCLAW_API_KEY
  | `vault:${string}` // Vault path: vault:secret/openclaw/api-key
  | `static:${string}` // Static value: static:default-api-key
  | `aws:${string}` // AWS Secrets Manager: aws:us-east-1:openclaw-api-key
  | `gcp:${string}`; // GCP Secret Manager: gcp:project:openclaw-api-key

/**
 * Well-known secret names for type safety
 */
export enum WellKnownSecret {
  OPENCLAW_API_KEY = 'OPENCLAW_API_KEY',
  JWT_SECRET = 'JWT_SECRET',
  OPENAI_API_KEY = 'OPENAI_API_KEY',
  ANTHROPIC_API_KEY = 'ANTHROPIC_API_KEY',
  MINIMAX_API_KEY = 'MINIMAX_API_KEY',
  DEEPSEEK_API_KEY = 'DEEPSEEK_API_KEY',
  MIMO_API_KEY = 'MIMO_API_KEY',
  DATABASE_URL = 'DATABASE_URL',
  REDIS_URL = 'REDIS_URL',
}
