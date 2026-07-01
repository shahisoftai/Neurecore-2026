/**
 * RetailModule — Phase 8.
 *
 * Wires the retail service, controller, and registers the AI actions +
 * widgets on module init.
 *
 * SOLID:
 *  - SRP — this module exists solely to host the retail pack.
 *  - DIP — depends on the AI Actions + Widgets + Connectors modules'
 *    exported providers.
 */
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { RetailService } from './retail.service';
import { RetailController } from './retail.controller';
import { AIActionsModule } from '../ai-actions/ai-actions.module';
import { WidgetsModule } from '../widgets/widgets.module';
import { ConnectorsModule } from '../connectors/connectors.module';
import { ConnectorRegistry } from '../connectors/connector.registry';
import { ShopifyConnector } from '../connectors/adapters/shopify.adapter';
import { SquareConnector } from '../connectors/adapters/square.adapter';

@Module({
  imports: [AIActionsModule, WidgetsModule, ConnectorsModule],
  controllers: [RetailController],
  providers: [RetailService],
  exports: [RetailService],
})
export class RetailModule implements OnApplicationBootstrap {
  constructor(
    private readonly retailService: RetailService,
    private readonly connectorRegistry: ConnectorRegistry,
  ) {}

  onApplicationBootstrap(): void {
    // Register the retail connectors into the existing registry (OCP).
    this.connectorRegistry.register(new ShopifyConnector());
    this.connectorRegistry.register(new SquareConnector());

    // Register the 12 retail AI actions at boot. The Solution Pack
    // applier also does this on pack install — boot-time registration
    // ensures the actions are available in dev even before the pack is
    // installed (the dev tenant ships with the retail pack pre-installed).
    void this.retailService.registerRetailActions();
  }
}
