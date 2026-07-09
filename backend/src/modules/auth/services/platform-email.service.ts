import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Platform-level email sender for system emails (password reset, etc.)
 * Not tenant-scoped — uses SMTP env config.
 *
 * Dev fallback: logs the email body to console instead of sending.
 */
@Injectable()
export class PlatformEmailService {
  private readonly logger = new Logger(PlatformEmailService.name);
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly smtpUser: string | undefined;
  private readonly smtpPass: string | undefined;
  private readonly smtpSecure: boolean;
  private readonly smtpFrom: string;
  private readonly fromName: string;

  constructor(config: ConfigService) {
    this.smtpHost = config.get<string>('SMTP_HOST', '');
    this.smtpPort = config.get<number>('SMTP_PORT', 587);
    this.smtpUser = config.get<string>('SMTP_USER') ?? undefined;
    this.smtpPass = config.get<string>('SMTP_PASSWORD') ?? undefined;
    this.smtpSecure = config.get<boolean>('SMTP_SECURE', false);
    this.smtpFrom = config.get<string>('SMTP_FROM', 'noreply@neurecore.com');
    this.fromName = config.get<string>('EMAIL_FROM_NAME', 'NeureCore');
  }

  async send(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    const accessible = Boolean(this.smtpHost && this.smtpUser);
    if (!accessible) {
      this.logger.warn('SMTP not configured — logging email to console');
      this.logger.log(`[EMAIL] To: ${options.to}`);
      this.logger.log(`[EMAIL] Subject: ${options.subject}`);
      this.logger.log(`[EMAIL] Body:\n${options.html}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpSecure,
      ...(this.smtpUser
        ? { auth: { user: this.smtpUser, pass: this.smtpPass } }
        : {}),
    });

    await transporter.sendMail({
      from: `"${this.fromName}" <${this.smtpFrom}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    this.logger.log(`Email sent to ${options.to}: ${options.subject}`);
  }
}
