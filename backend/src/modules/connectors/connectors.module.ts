import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConnectorRegistry } from './connector.registry';
import { ConnectorService } from './services/connector.service';
import { PrismaOAuthTokenStore } from './services/oauth-token.service';
import { CryptoService } from './services/crypto.service';
import { SyncSchedulerService } from './services/sync-scheduler.service';
import { OAuthService } from './services/oauth.service';
import { ConnectorsController } from './controllers/connectors.controller';
import { SalesforceConnector } from './adapters/salesforce.adapter';
import { HubSpotConnector } from './adapters/hubspot.adapter';
import { PipedriveConnector } from './adapters/pipedrive.adapter';

/**
 * ConnectorsModule — Phase 4.2 / 4.3
 *
 * OCP:  Add new adapters in onModuleInit without touching ConnectorService.
 * DIP:  All services receive dependencies via NestJS DI.
 * SRP:  PrismaOAuthTokenStore handles token persistence;
 *       SyncSchedulerService handles background scheduling only.
 */
@Module({
  controllers: [ConnectorsController],
  providers: [
    ConnectorRegistry,
    ConnectorService,
    CryptoService,
    PrismaOAuthTokenStore,
    SyncSchedulerService,
    OAuthService,
  ],
  exports: [
    ConnectorService,
    ConnectorRegistry,
    CryptoService,
    PrismaOAuthTokenStore,
    SyncSchedulerService,
    OAuthService,
  ],
})
export class ConnectorsModule implements OnModuleInit {
  private readonly logger = new Logger(ConnectorsModule.name);

  constructor(private readonly registry: ConnectorRegistry) {}

  onModuleInit(): void {
    // Guard against missing registry during early init (defensive for local dev/emulator)
    if (!this.registry || typeof this.registry.register !== 'function') {
      this.logger.warn(
        'ConnectorRegistry unavailable during onModuleInit — skipping adapter registration',
      );
      return;
    }

    // Register all built-in adapters — OCP: extend here only
    this.registry.register(new SalesforceConnector());
    this.registry.register(new HubSpotConnector());
    this.registry.register(new PipedriveConnector());
  }
}
