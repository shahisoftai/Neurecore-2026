/**
 * Structured Logger
 *
 * Emits one JSON log line per gateway invocation. The shape is fixed
 * so downstream log shippers (Loki, OpenSearch, …) can index it.
 *
 * SOLID: SRP — logging only. No HTTP, no IO beyond console output.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Capability } from '../domain/capabilities';

export interface GatewayLogRecord {
  capability: Capability;
  provider: string;
  model: string;
  tenantId: string | null;
  sourceModule: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
  viaTenantOverride?: boolean;
  viaFallback?: boolean;
}

@Injectable()
export class StructuredLogger {
  private readonly logger = new Logger('AiGateway');

  invoke(record: GatewayLogRecord): void {
    const payload = JSON.stringify({
      at: 'ai-gateway.invoke',
      ...record,
    });
    if (record.ok) {
      this.logger.log(payload);
    } else {
      this.logger.warn(payload);
    }
  }
}
