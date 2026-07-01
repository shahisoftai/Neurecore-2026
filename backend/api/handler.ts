import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import type { Request, Response, NextFunction, Application } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';

let cachedApp: Application | null = null;

async function createApp(): Promise<NestExpressApplication> {
  console.warn('Creating NestJS application...');
  console.warn('DATABASE_URL present:', !!process.env.DATABASE_URL);
  console.warn('REDIS_URL present:', !!process.env.REDIS_URL);
  console.warn('JWT_SECRET present:', !!process.env.JWT_SECRET);
  console.warn('VERCEL env:', process.env.VERCEL);
  console.warn('NODE_ENV:', process.env.NODE_ENV);

  let app: NestExpressApplication;
  try {
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn', 'log'],
    });
    console.warn('NestJS application created successfully');
  } catch (error) {
    console.error('Failed to create NestJS application:', error);
    console.error(
      'Error stack:',
      error instanceof Error ? error.stack : 'No stack',
    );
    throw error;
  }

  const _config = app.get(ConfigService);
  console.warn('Config service obtained');

  // Security
  app.use(helmet());

  // Logging middleware for Vercel debugging
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.warn('Vercel request:', req.method, req.url, req.path);
    next();
  });

  // Versioning — Vercel rewrites /api/v1/* → /api/handler, so the request
  // URL seen by Express is still /api/v1/health.  We set the global prefix
  // to "api" so NestJS registers routes as /api/v1/<controller>.
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  // CORS — allow all origins for now (Vercel headers also set CORS)
  app.enableCors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Initialize the NestJS application (required for serverless to trigger onModuleInit hooks)
  await app.init();
  console.warn('NestJS application initialized successfully');

  return app;
}

async function getExpressApp() {
  if (!cachedApp) {
    const nestApp = await createApp();
    cachedApp = nestApp.getHttpAdapter().getInstance() as Application;
  }
  return cachedApp;
}

export default async function handler(req: Request, res: Response) {
  try {
    // Ensure basic CORS headers are present even if downstream fails.
    // This makes the serverless handler tolerant during local dev and Vercel
    // emulator runs so the frontend on another port can reach APIs.
    const allowedOrigins = [
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      '*',
    ];
    const origin = (req.headers.origin as string) || '';
    const allowOrigin = allowedOrigins.includes(origin) ? origin : '*';
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Correlation-ID',
    );

    // Handle preflight quickly here to avoid forwarding to Nest when not needed
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    // Enhanced logging to capture raw invocations from Vercel emulator
    console.warn(
      'Serverless function invoked (handler.ts) - timestamp:',
      new Date().toISOString(),
    );
    try {
      console.log('Request summary:', {
        method: req.method,
        url: req.url || req.originalUrl,
        path: req.path,
        headers: req.headers && Object.keys(req.headers).length,
        hasBody: !!req.body,
        rawType: typeof req,
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV,
      });
    } catch (logErr) {
      console.log('Error serializing request summary:', logErr);
    }
    // If body exists, log a truncated preview for diagnostics
    if (req.body) {
      try {
        const bodyStr =
          typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        console.log('Request body preview:', bodyStr.slice(0, 1000));
      } catch (e) {
        console.log('Could not stringify request body:', e);
      }
    }

    // Only handle API paths here.
    if (!req.url || !req.url.startsWith('/api')) {
      return res.status(404).json({
        status: 'error',
        error: { code: 'NOT_FOUND', message: 'Not handled by API handler' },
      });
    }

    // Simple test endpoint to verify function works
    if (req.url === '/api/test' || req.url === '/api/v1/test') {
      return res.status(200).json({
        status: 'success',
        message: 'Test endpoint working',
        timestamp: new Date().toISOString(),
        path: req.url,
      });
    }

    // Smoke endpoint for base /api to avoid 404s from Nest when no root route exists
    if (req.url === '/api' || req.url === '/api/') {
      return res.status(200).json({
        status: 'ok',
        env: process.env.NODE_ENV || 'development',
        message: 'Vercel smoke endpoint: /api',
        timestamp: new Date().toISOString(),
      });
    }

    // Diagnostic endpoint — returns env var presence without exposing values
    if (req.url === '/api/v1/diag' || req.url === '/api/diag') {
      return res.status(200).json({
        status: 'diagnostic',
        env: {
          DATABASE_URL: !!process.env.DATABASE_URL,
          REDIS_URL: !!process.env.REDIS_URL,
          JWT_SECRET: !!process.env.JWT_SECRET,
          VERCEL: process.env.VERCEL,
          NODE_ENV: process.env.NODE_ENV,
          UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
          UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const expressApp = await getExpressApp();
    console.warn('Express app ready, forwarding request');
    try {
      return expressApp(req, res);
    } catch (forwardErr) {
      console.error(
        'Error while forwarding request to Express app:',
        forwardErr,
      );
      try {
        return res.status(502).json({
          status: 'error',
          message: 'Bad Gateway forwarding to Express',
          error: String(forwardErr),
        });
      } catch {
        throw forwardErr;
      }
    }
  } catch (error) {
    console.error('Serverless function error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error('Error stack:', errStack);

    // Return the error as JSON so we can diagnose
    try {
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error during NestJS init',
        error: errMsg,
        stack: errStack,
      });
    } catch {
      // If even the response fails, re-throw
      throw error;
    }
  }
}
