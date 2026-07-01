import { Injectable } from '@nestjs/common';
import { ICRMConnector } from './interfaces/ICRMConnector';

/**
 * ConnectorRegistry — injectable singleton.
 * OCP: new connectors are registered at module init without modifying this class.
 * DIP: ConnectorService depends on this registry, not on concrete adapters.
 */
@Injectable()
export class ConnectorRegistry {
  private readonly connectors: Map<string, ICRMConnector> = new Map();

  register(connector: ICRMConnector): void {
    if (this.connectors.has(connector.name)) return; // idempotent
    this.connectors.set(connector.name, connector);
  }

  get(name: string): ICRMConnector | undefined {
    return this.connectors.get(name);
  }

  list(): string[] {
    return Array.from(this.connectors.keys());
  }
}
