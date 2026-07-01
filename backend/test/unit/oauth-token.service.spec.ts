import { Test, TestingModule } from '@nestjs/testing';
import { PrismaOAuthTokenStore } from '../../src/modules/connectors/services/oauth-token.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { CryptoService } from '../../src/modules/connectors/services/crypto.service';

const mockPrisma = {
  oAuthToken: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    deleteMany: jest.fn(),
  },
};

/** Mock CryptoService: encrypt adds a 'enc:' prefix; decrypt strips it */
const mockCrypto = {
  encrypt: jest.fn((v: string) => `enc:${v}`),
  decrypt: jest.fn((v: string) => v.replace(/^enc:/, '')),
  isEncrypted: jest.fn((v: string) => v.startsWith('enc:')),
};

const TOKEN_DATA = {
  accessToken: 'my-access-token',
  refreshToken: 'my-refresh-token',
  expiresAt: new Date(Date.now() + 3600_000),
  scopes: ['read', 'write'],
  metadata: { instanceUrl: 'https://example.salesforce.com' },
};

describe('PrismaOAuthTokenStore', () => {
  let store: PrismaOAuthTokenStore;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaOAuthTokenStore,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
      ],
    }).compile();
    store = module.get(PrismaOAuthTokenStore);
  });

  it('should call upsert when saving a token', async () => {
    mockPrisma.oAuthToken.upsert.mockResolvedValue({});
    await store.save('tenant-1', 'salesforce', TOKEN_DATA);
    expect(mockPrisma.oAuthToken.upsert).toHaveBeenCalledTimes(1);
    const call = mockPrisma.oAuthToken.upsert.mock.calls[0][0];
    // Token should be encrypted (mock prefixes with 'enc:')
    expect(call.create.accessToken).not.toBe(TOKEN_DATA.accessToken);
    expect(call.create.accessToken).toBe('enc:my-access-token');
  });

  it('should decrypt the access token on get()', async () => {
    mockPrisma.oAuthToken.findUnique.mockResolvedValue({
      accessToken: 'enc:my-access-token',
      refreshToken: 'enc:my-refresh-token',
      expiresAt: TOKEN_DATA.expiresAt,
      scopes: [],
      metadata: {},
    });

    const result = await store.get('tenant-1', 'salesforce');
    expect(result?.accessToken).toBe('my-access-token');
    expect(result?.refreshToken).toBe('my-refresh-token');
  });

  it('should return null when no token is found', async () => {
    mockPrisma.oAuthToken.findUnique.mockResolvedValue(null);
    const result = await store.get('tenant-1', 'pipedrive');
    expect(result).toBeNull();
  });

  it('should call deleteMany on delete()', async () => {
    mockPrisma.oAuthToken.deleteMany.mockResolvedValue({ count: 1 });
    await store.delete('tenant-1', 'salesforce');
    expect(mockPrisma.oAuthToken.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', provider: 'salesforce' },
    });
  });

  it('should return true for an expired token', async () => {
    mockPrisma.oAuthToken.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1_000),
    });
    const expired = await store.isExpired('tenant-1', 'salesforce');
    expect(expired).toBe(true);
  });

  it('should return false when expiresAt is in the future', async () => {
    mockPrisma.oAuthToken.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    const expired = await store.isExpired('tenant-1', 'salesforce');
    expect(expired).toBe(false);
  });

  it('should return false when token has no expiry', async () => {
    mockPrisma.oAuthToken.findUnique.mockResolvedValue({ expiresAt: null });
    const expired = await store.isExpired('tenant-1', 'salesforce');
    expect(expired).toBe(false);
  });
});
