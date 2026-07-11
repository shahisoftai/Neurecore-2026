/**
 * LangSmith Sink
 *
 * Thin adapter that emits gateway spans via the existing
 * `LangSmithTracingService`. The sink is the only place that knows
 * about LangSmith's API; the rest of the gateway just calls
 * `wrap(name, fn)` and gets back the function's return value.
 *
 * SOLID: DIP — the gateway depends on the small
 * `LangSmithSink.wrap` interface, not on the LangSmith SDK.
 * SOLID: SRP — emitting spans only. No HTTP, no DB.
 */

import { Injectable, Optional } from '@nestjs/common';
import {
  LangSmithTracingService,
  type Span,
} from '../langsmith-tracing.service';

export interface SinkMetadata {
  capability?: string;
  provider?: string;
  model?: string;
  tenantId?: string | null;
  sourceModule?: string;
  [key: string]: unknown;
}

@Injectable()
export class LangSmithSink {
  constructor(@Optional() private readonly tracing?: LangSmithTracingService) {}

  /**
   * Wrap an async operation in a LangSmith span. When tracing is
   * disabled, this is a transparent pass-through (no overhead).
   */
  async wrap<T>(
    name: string,
    metadata: SinkMetadata,
    fn: (span: Span | null) => Promise<T>,
  ): Promise<T> {
    if (!this.tracing) return fn(null);
    return this.tracing.trace(name, fn, metadata);
  }

  isEnabled(): boolean {
    return this.tracing?.isEnabled() ?? false;
  }
}
