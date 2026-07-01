import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CryptoService } from '../../connectors/services/crypto.service';
import { IntegrationProvider, IntegrationStatus } from '@prisma/client';
import type { ICredentialStore } from './credential-store.interface';

export interface GoogleCredentials {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  scopes: string[];
}

export interface BrevoCredentials {
  apiKey: string;
}

export type IntegrationCredentials = GoogleCredentials | BrevoCredentials;

@Injectable()
export class PrismaIntegrationCredentialStore implements ICredentialStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async save(
    tenantId: string,
    provider: IntegrationProvider,
    credentials: IntegrationCredentials,
    label?: string,
  ): Promise<void> {
    const encrypted = this.crypto.encrypt(JSON.stringify(credentials));
    await this.prisma.integrationCredential.upsert({
      where: { tenantId_provider: { tenantId, provider } },
      create: {
        tenantId,
        provider,
        label,
        status: IntegrationStatus.ACTIVE,
        encryptedCredentials: encrypted,
        scopes: this.extractScopes(credentials),
      },
      update: {
        encryptedCredentials: encrypted,
        label: label ?? undefined,
        status: IntegrationStatus.ACTIVE,
        scopes: this.extractScopes(credentials),
        updatedAt: new Date(),
      },
    });
  }

  async get(
    tenantId: string,
    provider: IntegrationProvider,
  ): Promise<IntegrationCredentials | null> {
    const row = await this.prisma.integrationCredential.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!row) return null;
    try {
      return JSON.parse(this.crypto.decrypt(row.encryptedCredentials)) as IntegrationCredentials;
    } catch {
      return null;
    }
  }

  async delete(tenantId: string, provider: IntegrationProvider): Promise<void> {
    await this.prisma.integrationCredential.deleteMany({
      where: { tenantId, provider },
    });
  }

  async exists(tenantId: string, provider: IntegrationProvider): Promise<boolean> {
    const row = await this.prisma.integrationCredential.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
      select: { id: true },
    });
    return !!row;
  }

  async updateStatus(
    tenantId: string,
    provider: IntegrationProvider,
    status: IntegrationStatus,
  ): Promise<void> {
    await this.prisma.integrationCredential.updateMany({
      where: { tenantId, provider },
      data: { status },
    });
  }

  private extractScopes(credentials: IntegrationCredentials): string[] {
    if ('scopes' in credentials) {
      return credentials.scopes;
    }
    return [];
  }
}
