/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Configuration Module
 * ═══════════════════════════════════════════════════════════════════════════
 * Global configuration module for NestJS application.
 * Provides type-safe configuration access throughout the application.
 */

import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validate } from './env.loader';
import { ConfigurationService } from './configuration.service';

const resolveEnvFilePaths = (): string[] => {
  // Allow explicit env-file override for local troubleshooting.
  if (process.env.ENV_FILE) {
    return [process.env.ENV_FILE];
  }

  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production') {
    return ['.env.production', '.env'];
  }
  if (nodeEnv === 'test') {
    return ['.env.test', '.env'];
  }

  // In local development, avoid accidentally loading production credentials.
  return ['.env', '.env.development'];
};

/**
 * Configuration Module
 * Import this once in AppModule with isGlobal: true
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: resolveEnvFilePaths(),
      // Load from process.env for Vercel deployment
      ignoreEnvFile: process.env.VERCEL === 'true',
    }),
  ],
  providers: [ConfigurationService],
  exports: [ConfigurationService, NestConfigModule],
})
export class ConfigurationModule {}

// Re-export types for convenience
export * from './env.loader';
export { ConfigurationService } from './configuration.service';
