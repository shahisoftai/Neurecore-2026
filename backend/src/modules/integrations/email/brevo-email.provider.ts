import { Injectable } from '@nestjs/common';
import { BrevoEmailService } from '../brevo/brevo-email.service';
import type { IEmailProvider, ProviderSendInput, ProviderSendResult } from './email-provider.interface';

@Injectable()
export class BrevoEmailProvider implements IEmailProvider {
  readonly name = 'brevo' as const;

  constructor(private readonly brevo: BrevoEmailService) {}

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    const htmlContent = input.html
      ? input.body
      : `<p>${escapeHtml(input.body).replace(/\n/g, '<br>')}</p>`;

    const result = await this.brevo.sendEmail(input.tenantId, {
      to: input.to,
      subject: input.subject,
      htmlContent,
      from: input.from,
      fromName: input.fromName,
      signature: input.signature,
    });
    return { provider: 'brevo', messageId: result.messageId };
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
