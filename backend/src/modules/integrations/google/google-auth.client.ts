import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider } from '@prisma/client';
import {
  PrismaIntegrationCredentialStore,
  GoogleCredentials,
} from '../services/integration-credential.store';

/**
 * GoogleAuthClient — provides authenticated Google API client per tenant
 *
 * Handles OAuth token lifecycle:
 * - Retrieves stored credentials (encrypted in DB)
 * - Auto-refreshes access token using refresh token if expired
 * - Persists new access token after refresh
 *
 * Usage:
 *   const credentials = await googleAuthClient.getCredentials(tenantId);
 *   // Use credentials.accessToken for Google API calls
 */
@Injectable()
export class GoogleAuthClient {
  private readonly logger = new Logger(GoogleAuthClient.name);
  private readonly GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

  constructor(
    private readonly credentialStore: PrismaIntegrationCredentialStore,
    private readonly config: ConfigService,
  ) {}

  /**
   * Get valid credentials for a tenant. Refreshes if expired.
   */
  async getCredentials(tenantId: string): Promise<GoogleCredentials | null> {
    const creds = await this.credentialStore.get(
      tenantId,
      IntegrationProvider.GOOGLE,
    );

    if (!creds) {
      return null;
    }

    const googleCreds = creds as GoogleCredentials;

    if (!googleCreds.accessToken) {
      throw new BadRequestException(
        'Google credentials invalid: missing access token',
      );
    }

    if (!googleCreds.expiryDate) {
      return googleCreds;
    }

    const isExpired = googleCreds.expiryDate < Date.now() + 60_000;

    if (!isExpired) {
      return googleCreds;
    }

    if (!googleCreds.refreshToken) {
      this.logger.warn(
        `Google token expired for tenant ${tenantId} and no refresh token available`,
      );
      throw new BadRequestException(
        'Google access token expired. Please reconnect Google Workspace.',
      );
    }

    this.logger.log(`Refreshing Google access token for tenant ${tenantId}`);
    return this.refreshAccessToken(tenantId, googleCreds);
  }

  private async refreshAccessToken(
    tenantId: string,
    creds: GoogleCredentials,
  ): Promise<GoogleCredentials> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Google OAuth credentials not configured on server',
      );
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: creds.refreshToken!,
      grant_type: 'refresh_token',
    });

    const res = await fetch(this.GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Google token refresh failed: ${res.status} ${err}`);
      throw new BadRequestException('Google token refresh failed');
    }

    const tokens = (await res.json()) as {
      access_token: string;
      expires_in: number;
      scope?: string;
      token_type?: string;
    };

    const newCreds: GoogleCredentials = {
      accessToken: tokens.access_token,
      refreshToken: creds.refreshToken,
      expiryDate: Date.now() + tokens.expires_in * 1000,
      scopes: tokens.scope ? tokens.scope.split(' ') : creds.scopes,
    };

    await this.credentialStore.save(
      tenantId,
      IntegrationProvider.GOOGLE,
      newCreds,
    );

    this.logger.log(`Google token refreshed for tenant ${tenantId}`);
    return newCreds;
  }

  /**
   * Get just the access token (most common use case)
   */
  async getAccessToken(tenantId: string): Promise<string | null> {
    const creds = await this.getCredentials(tenantId);
    return creds?.accessToken ?? null;
  }
}
