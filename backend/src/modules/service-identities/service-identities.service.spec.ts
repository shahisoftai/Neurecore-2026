/**
 * Unit tests for ServiceIdentitiesService.
 *
 * Key properties:
 *   - Token issuance: plaintext returned once, SHA-256 hash stored
 *   - Token validation: expired/revoked/unknown tokens return null
 *   - Tenant isolation: identities are scoped per tenant
 *   - Revocation: marks identity disabled, prevents new token issuance
 */

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ServiceIdentitiesService } from './service-identities.service';
import { CreateServiceIdentityDto } from './dto/create-service-identity.dto';

const TOKEN_PREFIX = 'nsi_';

describe('ServiceIdentitiesService (Phase 1)', () => {
  let service: ServiceIdentitiesService;
  let mockPrisma: any;

  const identityStore: Map<string, any> = new Map();
  const tokenStore: Map<string, any> = new Map();

  beforeEach(async () => {
    identityStore.clear();
    tokenStore.clear();

    mockPrisma = {
      serviceIdentity: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where?.tenantId_name) {
            const { tenantId, name } = where.tenantId_name;
            for (const v of identityStore.values()) {
              if (v.tenantId === tenantId && v.name === name) return v;
            }
            return null;
          }
          if (where?.id) {
            return identityStore.get(where.id) ?? null;
          }
          return null;
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          for (const v of identityStore.values()) {
            if (v.id === where.id && v.tenantId === where.tenantId) return v;
          }
          return null;
        }),
        findMany: jest.fn(async ({ where }: any) => {
          return Array.from(identityStore.values())
            .filter((v) => !where.tenantId || v.tenantId === where.tenantId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }),
        create: jest.fn(async ({ data }: any) => {
          const id = 'si-' + (identityStore.size + 1);
          const rec = {
            id,
            tenantId: data.tenantId,
            name: data.name,
            description: data.description ?? null,
            scopes: data.scopes,
            enabled: true,
            revokedAt: null,
            revokedBy: null,
            createdByUserId: data.createdByUserId,
            lastUsedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          identityStore.set(id, rec);
          return rec;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          for (const [k, v] of identityStore.entries()) {
            if (v.id === where.id) {
              Object.assign(v, data);
              identityStore.set(k, v);
              return v;
            }
          }
          throw new Error('not found');
        }),
      },
      serviceToken: {
        create: jest.fn(async ({ data }: any) => {
          const id = 'tok-' + (tokenStore.size + 1);
          const rec = {
            id,
            serviceIdentityId: data.serviceIdentityId,
            tenantId: data.tenantId,
            scopes: data.scopes,
            tokenHash: data.tokenHash,
            expiresAt: data.expiresAt,
            revokedAt: null,
            lastUsedAt: null,
            createdAt: new Date(),
          };
          tokenStore.set(id, rec);
          tokenStore.set(data.tokenHash, rec); // also index by tokenHash for findUnique
          return rec;
        }),
        findUnique: jest.fn(async ({ where }: any) => {
          return tokenStore.get(where.tokenHash) ?? null;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          for (const [k, v] of tokenStore.entries()) {
            if (v.id === where.id) {
              Object.assign(v, data);
              tokenStore.set(k, v);
              return v;
            }
          }
          throw new Error('not found');
        }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ServiceIdentitiesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(ServiceIdentitiesService);
  });

  describe('create', () => {
    it('creates a new service identity', async () => {
      const dto: CreateServiceIdentityDto = { name: 'simulation-engine', scopes: ['simulations:run', 'events:write'] };
      const result = await service.create('t1', 'u1', dto);

      expect(result.name).toBe('simulation-engine');
      expect(result.scopes).toEqual(['simulations:run', 'events:write']);
      expect(result.enabled).toBe(true);
      expect(result.revokedAt).toBeNull();
    });

    it('throws SERVICE_IDENTITY_NAME_TAKEN on duplicate name for same tenant', async () => {
      const dto: CreateServiceIdentityDto = { name: 'simulation-engine', scopes: ['simulations:run'] };
      await service.create('t1', 'u1', dto);

      await expect(service.create('t1', 'u1', dto)).rejects.toThrow(ConflictException);
    });

    it('allows same name for different tenants', async () => {
      const dto: CreateServiceIdentityDto = { name: 'simulation-engine', scopes: ['simulations:run'] };
      await service.create('t1', 'u1', dto);

      const result = await service.create('t2', 'u1', dto);
      expect(result.tenantId).toBe('t2');
    });
  });

  describe('list', () => {
    it('returns all identities for a tenant', async () => {
      await service.create('t1', 'u1', { name: 'engine-a', scopes: ['simulations:run'] });
      await service.create('t1', 'u1', { name: 'engine-b', scopes: ['events:write'] });
      await service.create('t2', 'u1', { name: 'engine-c', scopes: ['events:read'] });

      const t1Identities = await service.list('t1');
      expect(t1Identities.length).toBe(2);
      expect(t1Identities.every((i: any) => i.tenantId === 't1')).toBe(true);
    });
  });

  describe('revoke', () => {
    it('marks identity as revoked and disabled', async () => {
      const created = await service.create('t1', 'u1', { name: 'engine-a', scopes: ['simulations:run'] });
      const revoked = await service.revoke('t1', created.id, 'u1');

      expect(revoked.revokedAt).not.toBeNull();
      expect(revoked.enabled).toBe(false);
    });

    it('returns identity unchanged if already revoked', async () => {
      const created = await service.create('t1', 'u1', { name: 'engine-a', scopes: ['simulations:run'] });
      const revoked1 = await service.revoke('t1', created.id, 'u1');
      const revoked2 = await service.revoke('t1', created.id, 'u1');

      expect(revoked2.revokedAt).toEqual(revoked1.revokedAt);
    });

    it('throws NOT_FOUND for unknown identity', async () => {
      await expect(service.revoke('t1', 'nonexistent', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('issueToken', () => {
    it('issues a token with nsi_ prefix and returns it in plaintext once', async () => {
      const identity = await service.create('t1', 'u1', { name: 'engine-a', scopes: ['simulations:run', 'events:write'] });

      const result = await service.issueToken('t1', identity.id, { ttlSeconds: 3600 });

      expect(result.token).toMatch(/^nsi_/);
      expect(result.token.length).toBeGreaterThan(10);
      expect(result.scopes).toEqual(['simulations:run', 'events:write']);
    });

    it('stores SHA-256 hash, not plaintext', async () => {
      const identity = await service.create('t1', 'u1', { name: 'engine-a', scopes: ['simulations:run'] });
      const result = await service.issueToken('t1', identity.id, {});

      const plaintext = result.token;
      const expectedHash = createHash('sha256').update(plaintext).digest('hex');
      const tokenRec = tokenStore.get(result.tokenId);
      expect(tokenRec.tokenHash).toBe(expectedHash);
    });

    it('throws SERVICE_IDENTITY_NOT_FOUND for unknown identity', async () => {
      await expect(service.issueToken('t1', 'nonexistent', {})).rejects.toThrow(NotFoundException);
    });

    it('throws SERVICE_IDENTITY_REVOKED for revoked identity', async () => {
      const identity = await service.create('t1', 'u1', { name: 'engine-a', scopes: ['simulations:run'] });
      await service.revoke('t1', identity.id, 'u1');

      await expect(service.issueToken('t1', identity.id, {})).rejects.toThrow(ForbiddenException);
    });

    it('respects custom ttlSeconds', async () => {
      const identity = await service.create('t1', 'u1', { name: 'engine-a', scopes: ['simulations:run'] });
      const before = new Date();
      const result = await service.issueToken('t1', identity.id, { ttlSeconds: 7200 });
      const after = new Date();

      const expiresAt = new Date(result.expiresAt);
      const expectedMin = new Date(before.getTime() + 7200 * 1000);
      const expectedMax = new Date(after.getTime() + 7200 * 1000);
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });
  });

  describe('validateToken', () => {
    it('returns null for null/empty plaintext', async () => {
      expect(await service.validateToken('')).toBeNull();
      expect(await service.validateToken(null as any)).toBeNull();
    });

    it('returns null for unknown token prefix', async () => {
      expect(await service.validateToken('unknown_prefix')).toBeNull();
    });

    it('returns null for unknown token hash', async () => {
      expect(await service.validateToken('nsi_nota_real_token')).toBeNull();
    });

    it('returns identity and token data for a valid token', async () => {
      const identity = await service.create('t1', 'u1', { name: 'engine-a', scopes: ['simulations:run'] });
      const { token } = await service.issueToken('t1', identity.id, {});

      const result = await service.validateToken(token);

      expect(result).not.toBeNull();
      expect(result!.identity.name).toBe('engine-a');
      expect(result!.token.scopes).toEqual(['simulations:run']);
    });

    it('returns null for expired token', async () => {
      const identity = await service.create('t1', 'u1', { name: 'engine-a', scopes: ['simulations:run'] });
      const { tokenId, token } = await service.issueToken('t1', identity.id, { ttlSeconds: 1 });

      tokenStore.get(tokenId).expiresAt = new Date(Date.now() - 1000);

      expect(await service.validateToken(token)).toBeNull();
    });
  });

  describe('hasScope', () => {
    it('returns true when token has the required scope', () => {
      const token = { scopes: ['simulations:run', 'events:write'] };
      expect(service.hasScope(token, 'simulations:run')).toBe(true);
    });

    it('returns false when token lacks the required scope', () => {
      const token = { scopes: ['events:read'] };
      expect(service.hasScope(token, 'simulations:run')).toBe(false);
    });
  });
});
