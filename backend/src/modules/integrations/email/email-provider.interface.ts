/**
 * WS-4.1: Email provider abstraction (Open/Closed Principle).
 *
 * EmailTool and any future email-sending code depend on this interface, NOT on the
 * concrete Gmail/Brevo services. Adding Sendgrid, Mailgun, or AWS SES is a new class
 * + 1 line in EmailProviderFactory — no edits to EmailTool.
 */
export type EmailProviderName = 'gmail' | 'brevo';

export interface ProviderSendInput {
  tenantId: string;
  from: string;
  fromName?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  html?: boolean;
  signature?: string;
}

export interface ProviderSendResult {
  provider: EmailProviderName;
  messageId: string;
  threadId?: string;
}

export interface IEmailProvider {
  readonly name: EmailProviderName;
  send(input: ProviderSendInput): Promise<ProviderSendResult>;
}
