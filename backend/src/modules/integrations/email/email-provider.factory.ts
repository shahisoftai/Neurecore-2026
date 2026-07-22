import { Injectable } from '@nestjs/common';
import { PrismaIntegrationCredentialStore } from '../services/integration-credential.store';
import { IntegrationProvider } from '@prisma/client';
import type {
  IEmailProvider,
  EmailProviderName,
} from './email-provider.interface';
import { GmailEmailProvider } from './gmail-email.provider';
import { BrevoEmailProvider } from './brevo-email.provider';

export type EmailProviderPreference = 'auto' | 'gmail' | 'brevo';

@Injectable()
export class EmailProviderFactory {
  constructor(
    private readonly gmail: GmailEmailProvider,
    private readonly brevo: BrevoEmailProvider,
    private readonly credentials: PrismaIntegrationCredentialStore,
  ) {}

  /**
   * Pick a provider for sending, respecting the agent's preferred provider,
   * the caller's `requested` override, and which providers are connected.
   * Throws if no provider is available.
   */
  async forSend(
    tenantId: string,
    preferred: EmailProviderName,
    requested: EmailProviderPreference,
  ): Promise<IEmailProvider> {
    const [googleConnected, brevoConnected] = await Promise.all([
      this.credentials.exists(tenantId, IntegrationProvider.GOOGLE),
      this.credentials.exists(tenantId, IntegrationProvider.BREVO),
    ]);

    let chosen: EmailProviderName | null = null;
    if (requested === 'gmail') chosen = googleConnected ? 'gmail' : null;
    else if (requested === 'brevo') chosen = brevoConnected ? 'brevo' : null;
    else {
      if (preferred === 'gmail' && googleConnected) chosen = 'gmail';
      else if (preferred === 'brevo' && brevoConnected) chosen = 'brevo';
      else if (brevoConnected) chosen = 'brevo';
      else if (googleConnected) chosen = 'gmail';
    }

    if (!chosen) {
      throw new Error(
        'No email provider available. Connect Google Workspace or Brevo in Settings → Integrations.',
      );
    }
    return chosen === 'gmail' ? this.gmail : this.brevo;
  }
}
