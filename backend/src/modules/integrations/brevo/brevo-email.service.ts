import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { IntegrationProvider } from '@prisma/client';
import { PrismaIntegrationCredentialStore } from '../services/integration-credential.store';
import { BrevoUsageService } from './brevo-usage.service';

export interface SendEmailDto {
  to: string;
  subject: string;
  htmlContent: string;
  from: string;
  fromName?: string;
  signature?: string;
}

@Injectable()
export class BrevoEmailService {
  private readonly logger = new Logger(BrevoEmailService.name);
  private readonly BREVO_API_BASE = 'https://api.brevo.com/v3';

  constructor(
    private readonly credentialStore: PrismaIntegrationCredentialStore,
    private readonly usage: BrevoUsageService,
  ) {}

  private async getApiKey(tenantId: string): Promise<string | null> {
    const creds = await this.credentialStore.get(tenantId, IntegrationProvider.BREVO);
    if (!creds || !('apiKey' in creds)) return null;
    return creds.apiKey;
  }

  async sendEmail(tenantId: string, dto: SendEmailDto): Promise<{ messageId: string }> {
    const apiKey = await this.getApiKey(tenantId);

    if (!apiKey) {
      throw new BadRequestException('Brevo is not connected for this tenant');
    }

    await this.usage.checkLimit(tenantId);

    const finalHtml = dto.signature
      ? `${dto.htmlContent}<br><br><div class="signature">${escapeHtml(dto.signature)}</div>`
      : dto.htmlContent;

    const body = {
      to: [{ email: dto.to }],
      sender: {
        email: dto.from,
        ...(dto.fromName ? { name: dto.fromName } : {}),
      },
      subject: dto.subject,
      htmlContent: finalHtml,
    };

    const res = await fetch(`${this.BREVO_API_BASE}/smtp/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      this.logger.error(`Brevo send failed: ${res.status} ${err}`);
      throw new BadRequestException('Failed to send email via Brevo');
    }

    const data = (await res.json()) as { messageId?: string };
    const messageId = data.messageId ?? 'unknown';

    await this.usage.recordSend(tenantId);
    this.logger.log(`Email sent for tenant ${tenantId}: ${messageId}`);
    return { messageId };
  }

  async getAccountInfo(tenantId: string): Promise<Record<string, unknown>> {
    const apiKey = await this.getApiKey(tenantId);
    if (!apiKey) {
      throw new BadRequestException('Brevo is not connected');
    }

    const res = await fetch(`${this.BREVO_API_BASE}/account`, {
      headers: { 'api-key': apiKey },
    });

    if (!res.ok) {
      throw new BadRequestException('Failed to fetch Brevo account info');
    }

    return res.json() as Promise<Record<string, unknown>>;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
