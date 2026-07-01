import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider, IntegrationStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PrismaIntegrationCredentialStore, GoogleCredentials } from './services/integration-credential.store';

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets',
];

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly credentialStore: PrismaIntegrationCredentialStore,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async initiateGoogleOAuth(tenantId: string, redirectUri?: string): Promise<{ url: string; state: string }> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth is not configured on this server');
    }

    const finalRedirectUri =
      redirectUri ??
      this.config.get<string>('GOOGLE_REDIRECT_URI') ??
      `${process.env.FRONTEND_BASE_URL ?? 'https://hq.neurecore.com'}/settings/integrations/callback/google`;

    const state = Buffer.from(
      JSON.stringify({ tenantId, provider: 'google', redirectUri: finalRedirectUri }),
    ).toString('base64');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: finalRedirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      state,
      prompt: 'consent',
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
    };
  }

  async handleGoogleCallback(code: string, state: string): Promise<{ connected: boolean; email?: string }> {
    let parsed: { tenantId: string; provider: string; redirectUri: string };
    try {
      parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }

    if (parsed.provider !== 'google') {
      throw new BadRequestException('OAuth state provider mismatch');
    }

    const { tenantId, redirectUri } = parsed;

    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text().catch(() => 'unknown');
      this.logger.warn(`Google token exchange failed: ${tokenRes.status} ${err}`);
      throw new BadRequestException('Google token exchange failed');
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    const credentials: GoogleCredentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: Date.now() + tokens.expires_in * 1000,
      scopes: tokens.scope.split(' ').filter(Boolean),
    };

    await this.credentialStore.save(
      tenantId,
      IntegrationProvider.GOOGLE,
      credentials,
      'Google Workspace',
    );

    let email: string | undefined;
    try {
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userInfoRes.ok) {
        const userInfo = (await userInfoRes.json()) as { email?: string };
        email = userInfo.email;
      }
    } catch {
      // Non-fatal — email lookup failed
    }

    this.logger.log(`Google OAuth connected for tenant ${tenantId}`);
    return { connected: true, email };
  }

  async disconnectGoogle(tenantId: string): Promise<void> {
    await this.credentialStore.delete(tenantId, IntegrationProvider.GOOGLE);
    // Clear cached Google identifiers on tenant
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { googleDriveRootFolderId: null, googleCalendarId: null },
    }).catch(() => {
      // Tenant update is best-effort cleanup
    });
    this.logger.log(`Google OAuth disconnected for tenant ${tenantId}`);
  }

  async getGoogleConnectionStatus(tenantId: string): Promise<{
    connected: boolean;
    email?: string;
    scopes?: string[];
    expiresAt?: Date;
  }> {
    const creds = await this.credentialStore.get(tenantId, IntegrationProvider.GOOGLE);
    if (!creds) return { connected: false };

    const googleCreds = creds as GoogleCredentials;
    return {
      connected: true,
      scopes: googleCreds.scopes,
      expiresAt: googleCreds.expiryDate ? new Date(googleCreds.expiryDate) : undefined,
    };
  }

  async connectBrevo(tenantId: string, apiKey: string): Promise<{ connected: boolean }> {
    const validateRes = await fetch('https://api.brevo.com/v3/account', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!validateRes.ok) {
      throw new BadRequestException('Invalid Brevo API key');
    }

    await this.credentialStore.save(
      tenantId,
      IntegrationProvider.BREVO,
      { apiKey },
      'Brevo Email Relay',
    );

    this.logger.log(`Brevo connected for tenant ${tenantId}`);
    return { connected: true };
  }

  async disconnectBrevo(tenantId: string): Promise<void> {
    await this.credentialStore.delete(tenantId, IntegrationProvider.BREVO);
    this.logger.log(`Brevo disconnected for tenant ${tenantId}`);
  }

  async getBrevoConnectionStatus(tenantId: string): Promise<{ connected: boolean }> {
    const connected = await this.credentialStore.exists(tenantId, IntegrationProvider.BREVO);
    return { connected };
  }

  async listIntegrations(tenantId: string): Promise<Record<string, unknown>> {
    const [google, brevo] = await Promise.all([
      this.getGoogleConnectionStatus(tenantId),
      this.getBrevoConnectionStatus(tenantId),
    ]);

    return {
      google: {
        provider: 'google',
        label: 'Google Workspace',
        description: 'Gmail, Drive, Calendar, Sheets',
        ...google,
      },
      brevo: {
        provider: 'brevo',
        label: 'Brevo (Email Relay)',
        description: 'Agent email aliases (300 emails/day free)',
        ...brevo,
      },
    };
  }

  async getDecryptedCredentials(
    tenantId: string,
    provider: IntegrationProvider,
  ): Promise<GoogleCredentials | { apiKey: string } | null> {
    return this.credentialStore.get(tenantId, provider);
  }
}
