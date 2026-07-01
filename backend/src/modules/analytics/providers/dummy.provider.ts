import { IAnalyticsProvider } from '../interfaces/IAnalyticsProvider';

export class DummyAnalyticsProvider implements IAnalyticsProvider {
  async getModels() {
    return [{ id: 'dummy-v1', name: 'DummyModel', version: 'v1' }];
  }

  async score(features: Record<string, unknown>) {
    // Simple deterministic scoring for early integration tests
    const value = Object.keys(features).length;
    return {
      score: Math.max(0, Math.min(1, (value % 10) / 10)),
      meta: { featureCount: value },
    };
  }
}
