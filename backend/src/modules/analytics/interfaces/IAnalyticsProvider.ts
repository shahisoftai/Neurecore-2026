export interface IAnalyticsProvider {
  score(features: Record<string, unknown>): Promise<Record<string, unknown>>;
  getModels(): Promise<Array<{ id: string; name: string; version: string }>>;
}

export interface IModelRunner {
  runModel(
    modelId: string,
    features: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}
