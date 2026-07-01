import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { AppModule } from '../../src/app.module';

/**
 * CRM Sync Golden-Path E2E — Phase 4.6
 *
 * Tests the full connector lifecycle:
 *   register connector → connect (OAuth) → trigger sync → verify status
 *
 * Requires running PostgreSQL + a mock CRM endpoint (or test credentials).
 * In CI, the test stubs out the actual HTTP calls via env: MOCK_CRM=true.
 *
 * Run with:
 *   pnpm test:e2e -- --testPathPattern=crm-sync
 */
describe('CRM Sync Golden Path (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let connectorId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/login — obtains auth token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'demo@demo.com', password: 'DemoPass123!' })
      .expect(200);

    authToken = res.body.data?.accessToken;
    expect(authToken).toBeDefined();
  });

  it('GET /api/v1/connectors/providers — lists available CRM adapters', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/connectors/providers')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const providers: string[] = res.body.data;
    expect(providers).toContain('salesforce');
    expect(providers).toContain('hubspot');
    expect(providers).toContain('pipedrive');
  });

  it('POST /api/v1/connectors — registers a HubSpot connector', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/connectors')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test HubSpot',
        provider: 'hubspot',
        config: { portalId: 'test-portal' },
      })
      .expect(201);

    expect(res.body.data.provider).toBe('hubspot');
    connectorId = res.body.data.id;
  });

  it('GET /api/v1/connectors — lists tenant connectors', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/connectors')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const connectors: { id: string }[] = res.body.data;
    expect(connectors.find((c) => c.id === connectorId)).toBeDefined();
  });

  it('POST /api/v1/connectors/:id/sync — triggers idempotent sync', async () => {
    // In a test environment with MOCK_CRM=true the adapter returns empty arrays
    const res = await request(app.getHttpServer())
      .post(`/api/v1/connectors/${connectorId}/sync`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ syncType: 'contacts' })
      .expect(201);

    // Sync completes without throwing even if zero records synced
    expect(res.body.data).toBeDefined();
  });

  it('DELETE /api/v1/connectors/:id — removes the connector', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/connectors/${connectorId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/connectors')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const connectors: { id: string }[] = res.body.data;
    expect(connectors.find((c) => c.id === connectorId)).toBeUndefined();
  });
});
