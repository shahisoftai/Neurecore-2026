import api from './api';
import { unwrapArrayOrEmpty, unwrapItem } from './unwrap';

export interface Connector {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
  createdAt: string;
}

class ConnectorsService {
  async listProviders(): Promise<string[]> {
    const res = await api.get('/connectors/providers');
    return unwrapArrayOrEmpty(res) as string[];
  }

  async listConnectors(params?: { tenantId?: string }): Promise<Connector[]> {
    const res = await api.get('/connectors', { params });
    return unwrapArrayOrEmpty(res) as Connector[];
  }

  async registerConnector(input: {
    tenantId?: string;
    name: string;
    provider: string;
    config?: Record<string, unknown>;
  }): Promise<Connector> {
    const res = await api.post('/connectors', input);
    return unwrapItem(res) as Connector;
  }

  async syncConnector(id: string, input: { tenantId?: string; syncType: 'contacts' | 'leads' }) {
    const res = await api.post(`/connectors/${id}/sync`, input);
    return unwrapItem(res);
  }

  async deleteConnector(id: string, tenantId?: string): Promise<void> {
    await api.delete(`/connectors/${id}`, { params: tenantId ? { tenantId } : undefined });
  }
}

export const connectorsService = new ConnectorsService();
