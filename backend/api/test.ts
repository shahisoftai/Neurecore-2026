import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { AppModule } from '../src/app.module';

export default async function handler(req: any, res: any) {
  console.log('Test function invoked with path:', req.url);

  try {
    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn'],
    });

    app.enableVersioning({ type: VersioningType.URI });

    const server = app.getHttpAdapter().getInstance();
    return server(req, res);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed', message: error.message });
  }
}
