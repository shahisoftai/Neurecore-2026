import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CryptoService } from './crypto.service';
import type {
  IOAuthTokenStore,
  OAuthTokenData,
} from '../interfaces/IOAuthTokenStore';

/**
 * PrismaOAuthTokenStore — Phase 4.3 / 4.6
 * SRP: persists, retrieves and expires OAuth tokens per tenant/provider.
 * Tokens are encrypted with AES-256-GCM via CryptoService (Phase 4.6).
 * Satisfies LSP: can replace MemoryOAuthTokenStore in any IOAuthTokenStore consumer.
 */
@Injectable()
export class PrismaOAuthTokenStore implements IOAuthTokenStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async save(
    tenantId: string,
    provider: string,
    data: OAuthTokenData,
  ): Promise<void> {
    await this.prisma.oAuthToken.upsert({
      where: { tenantId_provider: { tenantId, provider } },
      create: {
        tenantId,
        provider,
        accessToken: this.crypto.encrypt(data.accessToken),
        refreshToken: data.refreshToken
          ? this.crypto.encrypt(data.refreshToken)
          : null,
        expiresAt: data.expiresAt ?? null,
        scopes: (data.scopes ?? []) as never,
        metadata: (data.metadata ?? {}) as never,
      },
      update: {
        accessToken: this.crypto.encrypt(data.accessToken),
        refreshToken: data.refreshToken
          ? this.crypto.encrypt(data.refreshToken)
          : null,
        expiresAt: data.expiresAt ?? null,
        scopes: (data.scopes ?? []) as never,
        metadata: (data.metadata ?? {}) as never,
      },
    });
  }

  async get(
    tenantId: string,
    provider: string,
  ): Promise<OAuthTokenData | null> {
    const row = await this.prisma.oAuthToken.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!row) return null;
    return {
      accessToken: this.crypto.decrypt(row.accessToken),
      refreshToken: row.refreshToken
        ? this.crypto.decrypt(row.refreshToken)
        : undefined,
      expiresAt: row.expiresAt ?? undefined,
      scopes: row.scopes as string[],
      metadata: row.metadata as Record<string, unknown>,
    };
  }

  async delete(tenantId: string, provider: string): Promise<void> {
    await this.prisma.oAuthToken.deleteMany({ where: { tenantId, provider } });
  }

  async isExpired(tenantId: string, provider: string): Promise<boolean> {
    const row = await this.prisma.oAuthToken.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
      select: { expiresAt: true },
    });
    if (!row || !row.expiresAt) return false;
    return row.expiresAt < new Date();
  }
}
