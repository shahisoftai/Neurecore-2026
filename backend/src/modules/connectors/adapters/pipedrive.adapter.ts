import { ICRMConnector } from '../interfaces/ICRMConnector';

/**
 * PipedriveConnector
 * Implements ICRMConnector adapter for Pipedrive.
 * Follows Liskov Substitution: all connectors are interchangeable via ICRMConnector.
 */
export class PipedriveConnector implements ICRMConnector {
  name = 'pipedrive';

  async connect(_config: Record<string, unknown>): Promise<void> {
    void JSON.stringify(_config);
    // TODO: Store encrypted API token from config
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async syncContacts(_tenantId: string): Promise<void> {
    void _tenantId.length;
    // GET https://api.pipedrive.com/v1/persons
    return Promise.resolve();
  }

  async syncLeads(_tenantId: string): Promise<void> {
    void _tenantId.length;
    // GET https://api.pipedrive.com/v1/deals
    return Promise.resolve();
  }
}
