import { ICRMConnector } from '../interfaces/ICRMConnector';

/**
 * SalesforceConnector — STUB IMPLEMENTATION
 *
 * PRODUCTION-BLOCKED: PD-21
 *
 * The OAuth flow and token storage are NOT implemented. This adapter
 * silently succeeds without actually connecting to Salesforce.
 * Do not enable in production until OAuth flow is implemented.
 * Tracked in pending-tasks.md PD-21.
 */

export class SalesforceConnector implements ICRMConnector {
  name = 'salesforce';

  async connect(_config: Record<string, unknown>): Promise<void> {
    // PRODUCTION-BLOCKED: OAuth flow not implemented (PD-21)
    // TODO: implement OAuth flow and token storage
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'SalesforceConnector: OAuth flow not implemented (PD-21). ' +
          'Do not enable in production.',
      );
    }
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async syncContacts(_tenantId: string): Promise<void> {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('SalesforceConnector: not implemented in production (PD-21)');
    }
    return Promise.resolve();
  }

  async syncLeads(_tenantId: string): Promise<void> {
    return Promise.resolve();
  }
}
