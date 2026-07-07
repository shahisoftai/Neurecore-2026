import { GoogleAuthClient } from '../google-auth.client';
import type { PrismaIntegrationCredentialStore, GoogleCredentials } from '../../services/integration-credential.store';
import type { ConfigService } from '@nestjs/config';
import { IntegrationProvider } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

const TENANT_ID = 'tenant-1';

function makeCreds(overrides: Partial<GoogleCredentials> = {}): GoogleCredentials {
  return {
    accessToken: 'access-token-abc',
    refreshToken: 'refresh-token-xyz',
    expiryDate: Date.now() + 3600_000,
    scopes: ['https://www.googleapis.com/auth/drive'],
    ...overrides,
  };
}

let credentialStore: jest.Mocked<PrismaIntegrationCredentialStore>;
let config: jest.Mocked<ConfigService>;
let client: GoogleAuthClient;
let fetchSpy: jest.SpyInstance;

beforeEach(() => {
  credentialStore = {
    get: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<PrismaIntegrationCredentialStore>;

  config = {
    get: jest.fn(),
  } as unknown as jest.Mocked<ConfigService>;

  config.get.mockImplementation((key: string) => {
    if (key === 'GOOGLE_CLIENT_ID') return 'test-client-id';
    if (key === 'GOOGLE_CLIENT_SECRET') return 'test-client-secret';
    return undefined;
  });

  client = new GoogleAuthClient(credentialStore, config);

  fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    text: () => Promise.resolve(''),
    json: () =>
      Promise.resolve({
        access_token: 'new-access-token',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/drive',
      }),
  } as Response);
});

afterEach(() => {
  fetchSpy.mockRestore();
});

describe('GoogleAuthClient', () => {
  describe('getCredentials', () => {
    it('returns null when credentialStore.get returns null', async () => {
      credentialStore.get.mockResolvedValue(null);

      const result = await client.getCredentials(TENANT_ID);

      expect(result).toBeNull();
      expect(credentialStore.get).toHaveBeenCalledWith(TENANT_ID, IntegrationProvider.GOOGLE);
    });

    it('throws BadRequestException when creds have no accessToken', async () => {
      const creds = makeCreds({ accessToken: '' });
      credentialStore.get.mockResolvedValue(creds as GoogleCredentials);

      await expect(client.getCredentials(TENANT_ID)).rejects.toThrow(BadRequestException);
      await expect(client.getCredentials(TENANT_ID)).rejects.toThrow('missing access token');
    });

    it('returns creds as-is when expiryDate is far in the future (not expired)', async () => {
      const creds = makeCreds({ expiryDate: Date.now() + 3600_000 });
      credentialStore.get.mockResolvedValue(creds);

      const result = await client.getCredentials(TENANT_ID);

      expect(result).toEqual(creds);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns creds as-is when no expiryDate present', async () => {
      const creds = makeCreds({ expiryDate: undefined });
      credentialStore.get.mockResolvedValue(creds);

      const result = await client.getCredentials(TENANT_ID);

      expect(result).toEqual(creds);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('refreshes token when expired — verifies POST to token endpoint with correct params', async () => {
      const creds = makeCreds({ expiryDate: Date.now() - 1000 });
      credentialStore.get.mockResolvedValue(creds);

      await client.getCredentials(TENANT_ID);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const callUrl: string = fetchSpy.mock.calls[0][0];
      const callInit: RequestInit = fetchSpy.mock.calls[0][1];
      expect(callUrl).toBe('https://oauth2.googleapis.com/token');
      expect(callInit.method).toBe('POST');
      expect(callInit.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
      const body = callInit.body as URLSearchParams;
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('refresh_token')).toBe('refresh-token-xyz');
      expect(body.get('grant_type')).toBe('refresh_token');
    });

    it('updates creds with new accessToken/expiryDate after refresh', async () => {
      const creds = makeCreds({ expiryDate: Date.now() - 1000 });
      credentialStore.get.mockResolvedValue(creds);

      const result = await client.getCredentials(TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe('new-access-token');
      expect(result!.refreshToken).toBe('refresh-token-xyz');
      expect(result!.expiryDate).toBeGreaterThan(Date.now());
      expect(credentialStore.save).toHaveBeenCalledWith(
        TENANT_ID,
        IntegrationProvider.GOOGLE,
        expect.objectContaining({
          accessToken: 'new-access-token',
          refreshToken: 'refresh-token-xyz',
        }),
      );
    });

    it('throws BadRequestException when expired and no refreshToken', async () => {
      const creds = makeCreds({ expiryDate: Date.now() - 1000, refreshToken: undefined });
      credentialStore.get.mockResolvedValue(creds);

      await expect(client.getCredentials(TENANT_ID)).rejects.toThrow(BadRequestException);
      await expect(client.getCredentials(TENANT_ID)).rejects.toThrow('reconnect');
    });

    it('throws BadRequestException when OAuth client config is missing during refresh', async () => {
      config.get.mockReturnValue(undefined);
      const creds = makeCreds({ expiryDate: Date.now() - 1000 });
      credentialStore.get.mockResolvedValue(creds);

      await expect(client.getCredentials(TENANT_ID)).rejects.toThrow(BadRequestException);
      await expect(client.getCredentials(TENANT_ID)).rejects.toThrow('not configured');
    });
  });

  describe('getAccessToken', () => {
    it('returns accessToken from getCredentials when credentials exist', async () => {
      const creds = makeCreds();
      credentialStore.get.mockResolvedValue(creds);

      const token = await client.getAccessToken(TENANT_ID);

      expect(token).toBe('access-token-abc');
    });

    it('returns null when getCredentials returns null', async () => {
      credentialStore.get.mockResolvedValue(null);

      const token = await client.getAccessToken(TENANT_ID);

      expect(token).toBeNull();
    });
  });
});
