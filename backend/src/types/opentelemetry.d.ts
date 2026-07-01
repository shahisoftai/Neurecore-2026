// Phase 4.6 — optional OpenTelemetry integration
//
// These declarations allow TypeScript to compile even when OTel packages
// are not installed in a given environment. The tracing bootstrap uses
// dynamic imports and will disable tracing at runtime if imports fail.

declare module '@opentelemetry/sdk-node' {
  export const NodeSDK: any;
}

declare module '@opentelemetry/auto-instrumentations-node' {
  export const getNodeAutoInstrumentations: any;
}

declare module '@opentelemetry/exporter-trace-otlp-http' {
  export const OTLPTraceExporter: any;
}

declare module '@opentelemetry/resources' {
  export const Resource: any;
}

declare module '@opentelemetry/semantic-conventions' {
  export const SEMRESATTRS_SERVICE_NAME: string;
}
