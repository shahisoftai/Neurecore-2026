import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IModelRunner } from '../interfaces/IAnalyticsProvider';

/**
 * HttpModelRunner
 * SRP: calls the Python FastAPI model-runner service over HTTP.
 * OCP: swap base URL or add retry logic in a subclass without touching callers.
 * DIP: callers depend on IModelRunner interface, not this class directly.
 */
@Injectable()
export class HttpModelRunner implements IModelRunner {
  private readonly logger = new Logger(HttpModelRunner.name);
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.MODEL_RUNNER_URL ?? 'http://localhost:8080';
  }

  async runModel(
    modelId: string,
    features: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const endpoint = `${this.baseUrl}/score`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        throw new Error(`Model runner responded ${res.status}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      return { modelId, ...data };
    } catch (err) {
      this.logger.error(
        `HttpModelRunner.runModel failed: ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Analytics model runner is unavailable',
      );
    }
  }

  async forecast(periods: number): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periods }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok)
      throw new ServiceUnavailableException('Forecast service unavailable');
    return res.json() as Promise<Record<string, unknown>>;
  }

  async detectAnomalies(vectors: number[][]): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/anomaly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vectors }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok)
      throw new ServiceUnavailableException('Anomaly service unavailable');
    return res.json() as Promise<Record<string, unknown>>;
  }

  async embed(texts: string[]): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok)
      throw new ServiceUnavailableException('Embedding service unavailable');
    return res.json() as Promise<Record<string, unknown>>;
  }
}
