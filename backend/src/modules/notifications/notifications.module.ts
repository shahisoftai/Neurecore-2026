import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './services/notifications.service';
import { IndustryNotificationTemplatesService } from './industry-notification-templates.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, IndustryNotificationTemplatesService],
  exports: [NotificationsService, IndustryNotificationTemplatesService],
})
export class NotificationsModule {}
