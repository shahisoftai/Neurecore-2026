export interface IFeatureStore {
  save(tenantId: string, features: Record<string, unknown>, timestamp?: string): Promise<void>;
  getLatest(tenantId: string): Promise<{ features: Record<string, unknown>; timestamp: string } | null>;
  list(tenantId: string, limit?: number): Promise<Array<{ features: Record<string, unknown>; timestamp: string }>>;
}
