import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PrismaOAuthTokenStore } from './oauth-token.service';
import { CryptoService } from './crypto.service';

export type OAuthProvider = 'hubspot' | 'salesforce' | 'pipedrive';

export interface OAuthAuthorizeResult {
  url: string;
  provider: OAuthProvider;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenStore: PrismaOAuthTokenStore,
    private readonly crypto: CryptoService,
  ) {}

  buildState(payload: Record<string, unknown>): string {
    return this.crypto.encrypt(JSON.stringify(payload));
  }

  parseState(state: string): Record<string, unknown> {
    try {
      return JSON.parse(this.crypto.decrypt(state)) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }
  }

  authorizeHubSpot(tenantId: string, input: {
    redirectUri: string;
    scopes: string[];
  }): OAuthAuthorizeResult {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    if (!clientId)
      throw new BadRequestException('HUBSPOT_CLIENT_ID is not set');

    const state = this.buildState({
      tenantId,
      provider: 'hubspot',
    });
    const scope = encodeURIComponent(input.scopes.join(' '));
    const redirect = encodeURIComponent(input.redirectUri);

    const url = `https://app.hubspot.com/oauth/authorize?client_id=${encodeURIComponent(
      clientId,
    )}&redirect_uri=${redirect}&scope=${scope}&state=${encodeURIComponent(state)}`;

    return { url, provider: 'hubspot' };
  }

  async callbackHubSpot(input: {
    code: string;
    redirectUri: string;
    state: string;
  }) {
    const clientId = process.env.HUBSPOT_CLIENT_ID;
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new BadRequestException('HubSpot OAuth is not configured');
    }

    const parsed = this.parseState(input.state);
    const tenantIdRaw = parsed.tenantId;
    if (typeof tenantIdRaw !== 'string' || tenantIdRaw.length === 0) {
      throw new BadRequestException('Missing tenantId in OAuth state');
    }
    const tenantId = tenantIdRaw;

    const body = new URLSearchParams();
    body.set('grant_type', 'authorization_code');
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
    body.set('redirect_uri', input.redirectUri);
    body.set('code', input.code);

    const resp = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      this.logger.warn(`HubSpot token exchange failed: ${resp.status} ${text}`);
      throw new BadRequestException('HubSpot token exchange failed');
    }

    const token = (await resp.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : undefined;

    await this.tokenStore.save(tenantId, 'hubspot', {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scopes: token.scope ? token.scope.split(' ') : [],
      metadata: { obtainedAt: new Date().toISOString() },
    });

    // Ensure a connector record exists
    const crmConnector = (this.prisma as any).crmConnector;
    const existing = await crmConnector.findFirst({
      where: { tenantId, provider: 'hubspot' },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await crmConnector.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    } else {
      await crmConnector.create({
        data: {
          tenantId,
          provider: 'hubspot',
          name: 'HubSpot',
          config: {},
          isActive: true,
        },
      });
    }

    return { ok: true, tenantId, provider: 'hubspot', expiresAt };
  }
}
