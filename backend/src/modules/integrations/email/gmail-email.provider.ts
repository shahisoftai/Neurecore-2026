import { Injectable } from '@nestjs/common';
import { GoogleGmailService } from '../google/google-gmail.service';
import type { IEmailProvider, ProviderSendInput, ProviderSendResult } from './email-provider.interface';

@Injectable()
export class GmailEmailProvider implements IEmailProvider {
  readonly name = 'gmail' as const;

  constructor(private readonly gmail: GoogleGmailService) {}

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    const result = await this.gmail.sendEmail(input.tenantId, {
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      body: input.body,
      html: input.html ?? false,
    });
    return {
      provider: 'gmail',
      messageId: result.messageId,
      threadId: result.threadId,
    };
  }
}
