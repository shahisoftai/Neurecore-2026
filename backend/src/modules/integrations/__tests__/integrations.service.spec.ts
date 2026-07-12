import { BadRequestException } from '@nestjs/common';
import { IntegrationsService } from '../integrations.service';
import { PrismaIntegrationCredentialStore } from '../services/integration-credential.store';
import type { GoogleAuthClient } from '../google/google-auth.client';
import type { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { ConfigService } from '@nestjs/config';

const mockCredentialStore = {
  get: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
} as unknown as PrismaIntegrationCredentialStore;

const mockConfig = {
  get: jest.fn(),
} as unknown as ConfigService;

const mockAuthClient = {
  getAccessToken: jest.fn(),
  getCredentials: jest.fn(),
} as unknown as GoogleAuthClient;

const mockTenant = {
  findUnique: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
};

const mockPrisma = {
  tenant: mockTenant,
} as unknown as PrismaService;

const originalFetch = global.fetch;

function makeService(): IntegrationsService {
  return new IntegrationsService(
    mockCredentialStore,
    mockConfig,
    mockPrisma,
    mockAuthClient,
  );
}

beforeEach(() => {
  jest.clearAllMocks();

  mockConfig.get = jest.fn((key: string) => {
    if (key === 'GOOGLE_CLIENT_ID') return 'client-id-test';
    if (key === 'GOOGLE_CLIENT_SECRET') return 'client-secret-test';
    if (key === 'GOOGLE_REDIRECT_URI') return 'https://hq.neurecore.com/settings/integrations/callback/google';
    return undefined;
  });

  mockTenant.update.mockResolvedValue({} as never);
  mockTenant.findUnique.mockResolvedValue(null);
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('IntegrationsService', () => {
  describe('initiateGoogleOAuth', () => {
    it('returns Google OAuth URL with correct client_id, scope, redirect_uri, response_type=code, access_type=offline, prompt=consent', async () => {
      const svc = makeService();
      const { url, state } = await svc.initiateGoogleOAuth('tenant-1');

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=client-id-test');
      expect(url).toContain('response_type=code');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fhq.neurecore.com%2Fsettings%2Fintegrations%2Fcallback%2Fgoogle');
      expect(url).toContain('scope=');

      const stateObj = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      expect(stateObj.tenantId).toBe('tenant-1');
      expect(stateObj.provider).toBe('google');
    });

    it('encodes audience in state (base64 JSON)', async () => {
      const svc = makeService();
      const { state } = await svc.initiateGoogleOAuth('tenant-1', undefined, 'admin');
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      expect(decoded.audience).toBe('admin');
      expect(decoded.tenantId).toBe('tenant-1');
    });

    it('throws BadRequestException when GOOGLE_CLIENT_ID/SECRET not configured', async () => {
      mockConfig.get = jest.fn(() => undefined);
      const svc = makeService();
      await expect(svc.initiateGoogleOAuth('tenant-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('uses provided redirectUri over default', async () => {
      const svc = makeService();
      const { url } = await svc.initiateGoogleOAuth('tenant-1', 'https://custom.example.com/callback');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fcustom.example.com%2Fcallback');
    });
  });

  describe('handleGoogleCallback', () => {
    it('exchanges code for tokens via oauth2.googleapis.com/token', async () => {
      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'at-123',
          refresh_token: 'rt-456',
          expires_in: 3600,
          scope: 'gmail.readonly drive',
        }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const state = Buffer.from(
        JSON.stringify({ tenantId: 't1', provider: 'google', redirectUri: 'https://example.com/cb' }),
      ).toString('base64');

      const svc = makeService();
      const result = await svc.handleGoogleCallback('auth-code', state);

      expect(fetchMock).toHaveBeenCalledWith('https://oauth2.googleapis.com/token', expect.objectContaining({
        method: 'POST',
      }));

      const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
      expect(body.get('code')).toBe('auth-code');
      expect(body.get('grant_type')).toBe('authorization_code');

      expect(mockCredentialStore.save).toHaveBeenCalledWith(
        't1',
        'GOOGLE',
        expect.objectContaining({
          accessToken: 'at-123',
          refreshToken: 'rt-456',
          scopes: ['gmail.readonly', 'drive'],
        }),
        'Google Workspace',
      );
      expect(result.connected).toBe(true);
    });

    it('throws BadRequestException on invalid state (not valid base64 JSON)', async () => {
      const svc = makeService();
      await expect(svc.handleGoogleCallback('code', 'not-valid-state')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequestException on state provider mismatch', async () => {
      const state = Buffer.from(
        JSON.stringify({ tenantId: 't1', provider: 'microsoft', redirectUri: 'https://x.com' }),
      ).toString('base64');

      const svc = makeService();
      await expect(svc.handleGoogleCallback('code', state)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('fetches userinfo to get email (optional, non-fatal)', async () => {
      const fetchMock = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'at-123',
            expires_in: 3600,
            scope: 'drive',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ email: 'agent@example.com' }),
        });
      global.fetch = fetchMock as unknown as typeof fetch;

      const state = Buffer.from(
        JSON.stringify({ tenantId: 't1', provider: 'google', redirectUri: 'https://example.com/cb' }),
      ).toString('base64');

      const svc = makeService();
      const result = await svc.handleGoogleCallback('auth-code', state);

      expect(result.email).toBe('agent@example.com');
    });

    it('saves credentials via credentialStore.save', async () => {
      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'at-final',
          expires_in: 1800,
          scope: 'gmail.send drive calendar',
        }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const state = Buffer.from(
        JSON.stringify({ tenantId: 'final-t', provider: 'google', redirectUri: 'https://example.com/cb' }),
      ).toString('base64');

      const svc = makeService();
      await svc.handleGoogleCallback('code', state);

      expect(mockCredentialStore.save).toHaveBeenCalledWith(
        'final-t',
        'GOOGLE',
        expect.objectContaining({ accessToken: 'at-final' }),
        'Google Workspace',
      );
    });
  });

  describe('disconnectGoogle', () => {
    it('deletes credential and clears googleDriveRootFolderId/googleCalendarId on tenant', async () => {
      const svc = makeService();
      await svc.disconnectGoogle('t-disconnect');

      expect(mockCredentialStore.delete).toHaveBeenCalledWith('t-disconnect', 'GOOGLE');
      expect(mockTenant.update).toHaveBeenCalledWith({
        where: { id: 't-disconnect' },
        data: {
          googleDriveRootFolderId: null,
          googleCalendarId: null,
          googleAccountEmail: null,
        },
      });
    });
  });

  describe('getGoogleConnectionStatus', () => {
    it('returns { connected: false } when no creds found', async () => {
      (mockCredentialStore.get as jest.Mock).mockResolvedValue(null);
      const svc = makeService();
      const result = await svc.getGoogleConnectionStatus('tenant-x');
      expect(result).toEqual({ connected: false });
    });

    it('returns scopes and expiresAt when connected', async () => {
      const expiresAt = Date.now() + 3600000;
      (mockCredentialStore.get as jest.Mock).mockResolvedValue({
        accessToken: 'at',
        scopes: ['drive', 'gmail.readonly'],
        expiryDate: expiresAt,
      });
      const svc = makeService();
      const result = await svc.getGoogleConnectionStatus('tenant-connected');
      expect(result.connected).toBe(true);
      expect(result.scopes).toEqual(['drive', 'gmail.readonly']);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect((result.expiresAt as Date).getTime()).toBe(expiresAt);
    });
  });

  describe('listIntegrations', () => {
    it('returns both google and brevo status objects', async () => {
      (mockCredentialStore.get as jest.Mock).mockResolvedValue({
        accessToken: 'at',
        scopes: ['drive'],
        expiryDate: Date.now() + 1000,
      });
      (mockCredentialStore.exists as jest.Mock).mockResolvedValue(true);

      const svc = makeService();
      const result = await svc.listIntegrations('t-list');

      expect(result).toHaveProperty('google');
      expect(result).toHaveProperty('brevo');
      expect(result.google).toMatchObject({
        provider: 'google',
        connected: true,
      });
      expect(result.brevo).toMatchObject({
        provider: 'brevo',
        connected: true,
      });
    });
  });
});
