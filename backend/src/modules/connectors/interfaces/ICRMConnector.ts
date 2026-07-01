export interface IContactSync {
  syncContacts(tenantId: string): Promise<void>;
}

export interface ILeadSync {
  syncLeads(tenantId: string): Promise<void>;
}

export interface ICRMConnector
  extends Partial<IContactSync>, Partial<ILeadSync> {
  name: string;
  connect(config: Record<string, unknown>): Promise<void>;
  disconnect(): Promise<void>;
}
