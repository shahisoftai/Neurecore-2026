import { Injectable } from '@nestjs/common';
import { IFeatureStore } from '../interfaces/IFeatureStore';

@Injectable()
export class MemoryFeatureStore implements IFeatureStore {
  private readonly store: Map<
    string,
    Array<{ features: Record<string, unknown>; timestamp: string }>
  > = new Map();

  async save(tenantId: string, features: Record<string, unknown>, timestamp?: string): Promise<void> {
    const ts = timestamp ?? new Date().toISOString();
    const arr = this.store.get(tenantId) ?? [];
    arr.unshift({ features, timestamp: ts });
    this.store.set(tenantId, arr);
  }

  async getLatest(tenantId: string): Promise<{ features: Record<string, unknown>; timestamp: string } | null> {
    const arr = this.store.get(tenantId) ?? [];
    return arr.length > 0 ? arr[0] : null;
  }

  async list(tenantId: string, limit = 50): Promise<Array<{ features: Record<string, unknown>; timestamp: string }>> {
    const arr = this.store.get(tenantId) ?? [];
    return arr.slice(0, limit);
  }
}
