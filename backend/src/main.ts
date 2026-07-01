import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { initTracing } from './infrastructure/tracing/tracing';
import { MetricsService } from './modules/metrics/metrics.service';

// Initialise tracing before the app bootstraps.
void initTracing();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService);

  // Security
  app.use(helmet());

  // Phase 9: cookie-parser (parses Cookie header into req.cookies)
  // Required by CookieAuthService + JwtStrategy cookie-first extraction.
  app.use(cookieParser());

  // Global prefix & versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  // CORS — frontend origins only
  const tenantFrontendUrl = config.get<string>('TENANT_FRONTEND_URL');
  const adminFrontendUrl = config.get<string>('ADMIN_FRONTEND_URL');

  // Dev defaults in this repo: admin=3001, tenant=3002 (support localhost and 127.0.0.1)
  // Production domains for Vercel frontends
  const defaultOrigins = [
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'https://hq.neurecore.com',
    'https://cc.neurecore.com',
  ];
  const origins = [
    tenantFrontendUrl,
    adminFrontendUrl,
    ...defaultOrigins,
  ].filter((v): v is string => Boolean(v));

  const isProd =
    config.get<string>('NODE_ENV') === 'production' ||
    process.env.NODE_ENV === 'production';
  if (isProd) {
    app.enableCors({
      origin: Array.from(new Set(origins)),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Correlation-ID',
        'X-CSRF-Token',
        'X-Tenant-ID',
        'Idempotency-Key',
      ],
    });
  } else {
    // In local dev allow all origins to avoid CORS friction
    app.enableCors({ origin: true, credentials: true });
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Be permissive in local/dev workflows: strip unknown props but don't fail
      // (prevents 400 responses when frontends send extra fields).
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Phase 1, Task 1.7: OpenAPI generation ───────────────────────
  // Per `EAOS-api-contract.md` §11, we generate the OpenAPI 3.1 spec
  // at boot and persist it to `backend/openapi/openapi.json` so the
  // frontend codegen pipeline can consume a committed artifact.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('NeureCore API')
    .setDescription('Enterprise AI Operating System — REST + WebSocket + SSE')
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addApiKey(
      { type: 'apiKey', name: 'X-Tenant-ID', in: 'header' },
      'X-Tenant-ID',
    )
    .addApiKey(
      { type: 'apiKey', name: 'Idempotency-Key', in: 'header' },
      'Idempotency-Key',
    )
    .addServer('http://localhost:3000/api/v1', 'Local dev')
    .addServer('https://brain.neurecore.com/api/v1', 'Production (Contabo)')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Persist OpenAPI artifact to backend/openapi/openapi.json (per spec §11.4).
  try {
    const outDir = join(process.cwd(), 'openapi');
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, 'openapi.json'),
      JSON.stringify(document, null, 2),
    );
    // eslint-disable-next-line no-console
    console.log(
      `[OpenAPI] Wrote backend/openapi/openapi.json (${Object.keys((document as { paths?: Record<string, unknown> }).paths ?? {}).length} paths)`,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[OpenAPI] Failed to write openapi.json (request flow NOT blocked): ${String(err)}`,
    );
  }

  // Serve Swagger UI at /api/docs (dev + prod per spec §11.4).
  SwaggerModule.setup('api/docs', app, document);

  // Add a lightweight root handler for `/api` so the base path returns useful info
  try {
    const adapter = app.getHttpAdapter().getInstance();
    if (adapter && typeof adapter.get === 'function') {
      adapter.get('/api', (_req: any, res: any) => {
        res.json({
          status: 'ok',
          api: 'NeureCore Backend',
          endpoints: [
            '/api/health',
            '/api/health/ready',
            '/api/health/live',
            '/api/docs',
            '/api/docs-json',
          ],
        });
      });

      adapter.get('/api/metrics', async (_req: any, res: any) => {
        try {
          const metricsService = app.get(MetricsService);
          const body = await metricsService.toExpositionFormat();
          res.setHeader('Content-Type', metricsService.contentType);
          res.status(200).send(body);
        } catch (err) {
          res.status(500).send('Metrics unavailable');
        }
      });
    }
  } catch (err) {
    // ignore if adapter not available
  }

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`🚀 NeureCore API running on: http://localhost:${port}/api`);
  console.log(`📘 OpenAPI UI:  http://localhost:${port}/api/docs`);
}
bootstrap();
