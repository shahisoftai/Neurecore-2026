/**
 * Security Module
 *
 * SOLID: Dependency Inversion — All dependencies are injected via constructor
 * SOLID: Single Responsibility — This module ONLY wires security components
 *
 * Provides centralized secret management for the entire application.
 *
 * NOTE: AccountLockoutService lives in AuthModule (it needs TokenService and
 * would otherwise introduce a circular module import). Keep this module
 * focused on secrets + global guards.
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
