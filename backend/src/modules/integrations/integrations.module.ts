import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { PrismaIntegrationCredentialStore } from './services/integration-credential.store';
import { BrevoEmailService } from './brevo/brevo-email.service';
import { BrevoUsageService } from './brevo/brevo-usage.service';
import { CryptoService } from '../connectors/services/crypto.service';
import { GoogleAuthClient } from './google/google-auth.client';
import { GoogleGmailService } from './google/google-gmail.service';
import { GoogleCalendarService } from './google/google-calendar.service';
import { GoogleDriveService } from './google/google-drive.service';
import { DriveCleanupService } from './google/drive-cleanup.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { GmailEmailProvider } from './email/gmail-email.provider';
import { BrevoEmailProvider } from './email/brevo-email.provider';
import { EmailProviderFactory } from './email/email-provider.factory';

@Module({
  imports: [NotificationsModule],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    PrismaIntegrationCredentialStore,
    BrevoEmailService,
    BrevoUsageService,
    CryptoService,
    GoogleAuthClient,
    GoogleGmailService,
    GoogleCalendarService,
    GoogleDriveService,
    DriveCleanupService,
    GmailEmailProvider,
    BrevoEmailProvider,
    EmailProviderFactory,
  ],
  exports: [IntegrationsService, BrevoEmailService, BrevoUsageService, GoogleAuthClient, GoogleGmailService, GoogleCalendarService, GoogleDriveService, DriveCleanupService, EmailProviderFactory],
})
export class IntegrationsModule {}