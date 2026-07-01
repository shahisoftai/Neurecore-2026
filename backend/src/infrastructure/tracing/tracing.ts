// OpenTelemetry types are declared in ../../types/opentelemetry.d.ts
// No runtime import needed - uses dynamic imports below

/**
 * OpenTelemetry instrumentation bootstrap — Phase 4.6
 *
 * This implementation is intentionally optional:
 * - If OTel packages are not installed, tracing is disabled without crashing.
 * - If OTEL_ENABLED is set to 'false' or NODE_ENV is 'test', it's disabled.
 */

let sdk: any = null;

export async function initTracing(): Promise<void> {
  if (
    process.env['OTEL_ENABLED'] === 'false' ||
    process.env['NODE_ENV'] === 'test'
  ) {
    return;
  }

  try {
    const sdkNode: any = await import('@opentelemetry/sdk-node');
    const instrNode: any =
      await import('@opentelemetry/auto-instrumentations-node');
    const exporterNode: any =
      await import('@opentelemetry/exporter-trace-otlp-http');
    const resourcesNode: any = await import('@opentelemetry/resources');
    const semanticNode: any =
      await import('@opentelemetry/semantic-conventions');

    const NodeSDK = sdkNode.NodeSDK;
    const getNodeAutoInstrumentations = instrNode.getNodeAutoInstrumentations;
    const OTLPTraceExporter = exporterNode.OTLPTraceExporter;
    const Resource = resourcesNode.Resource;
    const SEMRESATTRS_SERVICE_NAME = semanticNode.SEMRESATTRS_SERVICE_NAME;

    const exporter = new OTLPTraceExporter({
      url:
        process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ??
        'http://localhost:4318/v1/traces',
    });

    const localSdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]:
          process.env['OTEL_SERVICE_NAME'] ?? 'neurecore-api',
      }),
      traceExporter: exporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    sdk = localSdk;
    localSdk.start();
    console.log('[Tracing] OpenTelemetry SDK started');

    process.on('SIGTERM', () => {
      if (!sdk) return;
      void sdk.shutdown().then(() => console.log('[Tracing] SDK shut down'));
    });
  } catch (err) {
    console.warn(
      '[Tracing] OpenTelemetry not available; tracing disabled:',
      (err as Error).message,
    );
  }
}
