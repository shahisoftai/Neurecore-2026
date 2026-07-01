/**
 * Security Module
 *
 * SOLID: Dependency Inversion — All dependencies are injected via constructor
 * SOLID: Single Responsibility — This module ONLY wires security components
 *
 * Provides centralized secret management for the entire application.
 *
 * @module security
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Providers
import { SecretProviderService } from './providers/secret.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    SecretProviderService,
    {
      provide: 'AUDIT_LOGGER',
      useValue: {
        log: () => {},
      },
    },
  ],
  exports: [SecretProviderService, 'AUDIT_LOGGER'],
})
export class SecurityModule {}

/**
 * Security Module Usage Guide
 *
 * This module provides centralized secret management.
 *
 * 1. Import in your module:
 *
 * ```typescript
 * import { SecurityModule } from '../security/security.module';
 *
 * @Module({
 *   imports: [SecurityModule],
 * })
 * export class MyModule {}
 * ```
 *
 * 2. Inject and use:
 *
 * ```typescript
 * import { SecretProviderService } from '../security/providers/secret.provider';
 *
 * constructor(private readonly secrets: SecretProviderService) {}
 *
 * // Access well-known secrets
 * const apiKey = this.secrets.getOpenClawApiKey();
 *
 * // Or resolve any secret reference
 * const value = this.secrets.resolve('env:MY_SECRET').value;
 * ```
 *
 * 3. Configuration:
 *
 * Set cache TTL via environment variable:
 * ```
 * SECURITY_SECRETS_CACHE_TTL_MS=300000
 * ```
 *
 * Supported environment variables:
 * - OPENCLAW_API_KEY
 * - JWT_SECRET
 * - MINIMAX_API_KEY
 * - DEEPSEEK_API_KEY
 * - MIMO_API_KEY
 * - DATABASE_URL
 * - REDIS_URL
 */
