import { ICRMConnector } from '../interfaces/ICRMConnector';

/**
 * HubSpotConnector
 * Implements ICRMConnector adapter for HubSpot.
 * OCP: registered in ConnectorRegistry without modifying existing adapters.
 */
export class HubSpotConnector implements ICRMConnector {
  name = 'hubspot';

  async connect(_config: Record<string, unknown>): Promise<void> {
    void JSON.stringify(_config);
    // TODO: Exchange code for tokens via HubSpot OAuth2 endpoint
    // POST https://api.hubapi.com/oauth/v1/token
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async syncContacts(_tenantId: string): Promise<void> {
    void _tenantId.length;
    // GET https://api.hubapi.com/crm/v3/objects/contacts?limit=100
    // Upsert results into internal DB for this tenantId
    return Promise.resolve();
  }

  async syncLeads(_tenantId: string): Promise<void> {
    void _tenantId.length;
    // GET https://api.hubapi.com/crm/v3/objects/deals
    return Promise.resolve();
  }
}
