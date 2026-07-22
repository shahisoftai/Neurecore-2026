import type { IntegrationProvider, IntegrationStatus } from '@prisma/client';
import type { IntegrationCredentials } from './integration-credential.store';

/**
 * WS-4.2: Credential store abstraction (Interface Segregation + DIP).
 *
 * Tools and controllers depend on this interface, never on PrismaIntegrationCredentialStore.
 * Swapping the implementation (e.g., for Vault, AWS Secrets Manager) does not require
 * touching consumers.
 */
export interface ICredentialStore {
  save(
    tenantId: string,
    provider: IntegrationProvider,
    credentials: IntegrationCredentials,
    label?: string,
  ): Promise<void>;
  get(
    tenantId: string,
    provider: IntegrationProvider,
  ): Promise<IntegrationCredentials | null>;
  delete(tenantId: string, provider: IntegrationProvider): Promise<void>;
  exists(tenantId: string, provider: IntegrationProvider): Promise<boolean>;
  updateStatus(
    tenantId: string,
    provider: IntegrationProvider,
    status: IntegrationStatus,
  ): Promise<void>;
}

export const CREDENTIAL_STORE = Symbol('CREDENTIAL_STORE');
