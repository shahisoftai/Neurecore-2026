import { ICRMConnector } from '../interfaces/ICRMConnector';

/**
 * HubSpotConnector — STUB IMPLEMENTATION
 *
 * PRODUCTION-BLOCKED: PD-21
 *
 * The OAuth2 token exchange and API calls are NOT implemented.
 * This adapter silently succeeds without connecting to HubSpot.
 * Do not enable in production until OAuth flow is implemented.
 * Tracked in pending-tasks.md PD-21.
 */
export class HubSpotConnector implements ICRMConnector {
  name = 'hubspot';

  async connect(_config: Record<string, unknown>): Promise<void> {
    void JSON.stringify(_config);
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'HubSpotConnector: OAuth2 flow not implemented (PD-21). ' +
          'Do not enable in production.',
      );
    }
    // TODO: Exchange code for tokens via HubSpot OAuth2 endpoint
    // POST https://api.hubapi.com/oauth/v1/token
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async syncContacts(_tenantId: string): Promise<void> {
    void _tenantId.length;
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('HubSpotConnector: not implemented in production (PD-21)');
    }
    // GET https://api.hubapi.com/crm/v3/objects/contacts?limit=100
    return Promise.resolve();
  }

  async syncLeads(_tenantId: string): Promise<void> {
    void _tenantId.length;
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('HubSpotConnector: not implemented in production (PD-21)');
    }
    // GET https://api.hubapi.com/crm/v3/objects/deals
    return Promise.resolve();
  }
}
