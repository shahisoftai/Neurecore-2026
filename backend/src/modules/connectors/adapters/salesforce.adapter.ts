import { ICRMConnector } from '../interfaces/ICRMConnector';

export class SalesforceConnector implements ICRMConnector {
  name = 'salesforce';

  async connect(_config: Record<string, unknown>): Promise<void> {
    // TODO: implement OAuth flow and token storage
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async syncContacts(_tenantId: string): Promise<void> {
    // Implement idempotent contact sync
    return Promise.resolve();
  }

  async syncLeads(_tenantId: string): Promise<void> {
    return Promise.resolve();
  }
}
