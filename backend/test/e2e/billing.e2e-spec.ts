import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { AppModule } from '../../src/app.module';

/**
 * Billing Golden-Path E2E — Phase 4.6
 *
 * Tests the full invoice lifecycle:
 *   generate → issue → mark paid
 *   and verifies billing events are emitted at each step.
 *
 * Requires a running PostgreSQL instance (see docker-compose.yml).
 * Set TEST_DATABASE_URL to point to a dedicated test DB.
 *
 * Run with:
 *   pnpm test:e2e -- --testPathPattern=billing
 */
describe('Billing Golden Path (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let tenantId: string;
  let invoiceId: string;

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

  it('POST /api/v1/auth/login — obtains a tenant admin token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'demo@demo.com', password: 'DemoPass123!' })
      .expect(200);

    authToken = res.body.data?.accessToken;
    tenantId = res.body.data?.tenantId;
    expect(authToken).toBeDefined();
  });

  it('POST /api/v1/finance/invoices/generate — creates a DRAFT invoice', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/finance/invoices/generate')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        lineItems: [
          { description: 'Agent execution credits', qty: 100, unitPrice: 0.5 },
        ],
      })
      .expect(201);

    expect(res.body.data).toMatchObject({ status: 'DRAFT', currency: 'USD' });
    expect(res.body.data.total).toBeGreaterThan(0);
    invoiceId = res.body.data.id;
  });

  it('GET /api/v1/finance/invoices — lists invoices for the tenant', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/finance/invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data.data)).toBe(true);
    expect(res.body.data.data.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/finance/invoices/:id/issue — transitions to ISSUED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/finance/invoices/${invoiceId}/issue`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(res.body.data.status).toBe('ISSUED');
  });

  it('POST /api/v1/finance/invoices/:id/paid — transitions to PAID', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/finance/invoices/${invoiceId}/paid`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(201);

    expect(res.body.data.status).toBe('PAID');
  });

  it('GET /api/v1/finance/billing-events — confirms 3 billing events were emitted', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/finance/billing-events')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const events: { type: string }[] = res.body.data.data;
    const types = events.map((e) => e.type);
    expect(types).toContain('INVOICE_CREATED');
    expect(types).toContain('INVOICE_ISSUED');
    expect(types).toContain('INVOICE_PAID');
  });

  it('GET /api/v1/finance/report — returns a billing summary', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/finance/report')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
      })
      .expect(200);

    expect(res.body.data).toMatchObject({ tenantId, currency: 'USD' });
  });

  it('POST /api/v1/finance/expenses — records an expense', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/finance/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        category: 'API_CALL',
        description: 'OpenAI call',
        amountUsd: 0.02,
      })
      .expect(201);

    expect(res.body.data.category).toBe('API_CALL');
  });
});
