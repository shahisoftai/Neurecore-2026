/**
 * Industry Notification Templates Service
 *
 * Stage 2 Phase 2C: Service to resolve per-industry notification templates.
 *
 * Provides access to the notification template registry, allowing
 * other services (e.g. routines, workflows, compliance) to render
 * industry-appropriate notification messages.
 *
 * SOLID:
 * - SRP: This service ONLY resolves notification templates.
 * - OCP: New template = add to INDUSTRY_NOTIFICATION_TEMPLATES. Zero changes here.
 */

import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from './services/notifications.service';
import {
  getNotificationTemplates,
  getNotificationTemplate,
  getTemplatesByCategory,
} from './industry-notification-templates';
import type {
  NotificationTemplate,
  NotificationChannel,
} from './industry-notification-templates';

@Injectable()
export class IndustryNotificationTemplatesService {
  private readonly logger = new Logger(
    IndustryNotificationTemplatesService.name,
  );

  constructor(private readonly notificationsService: NotificationsService) {}

  getTemplates(industryGroup: string): NotificationTemplate[] {
    return getNotificationTemplates(industryGroup);
  }

  getTemplate(
    industryGroup: string,
    slug: string,
  ): NotificationTemplate | undefined {
    return getNotificationTemplate(industryGroup, slug);
  }

  getTemplatesByCategory(
    industryGroup: string,
    category: NotificationTemplate['category'],
  ): NotificationTemplate[] {
    return getTemplatesByCategory(industryGroup, category);
  }

  /**
   * Render a notification template with variable substitution
   * and send it via the NotificationsService.
   */
  async sendFromTemplate(
    tenantId: string,
    industryGroup: string,
    templateSlug: string,
    variables: Record<string, string>,
    options?: {
      userId?: string;
      channel?: NotificationChannel;
      fallbackTitle?: string;
      fallbackMessage?: string;
    },
  ): Promise<void> {
    const template = getNotificationTemplate(industryGroup, templateSlug);

    if (!template) {
      if (options?.fallbackTitle && options?.fallbackMessage) {
        await this.notificationsService.create({
          type: 'INFO',
          title: options.fallbackTitle,
          message: options.fallbackMessage,
          tenantId,
          userId: options.userId,
        });
      }
      this.logger.warn(
        `Notification template "${templateSlug}" not found for group "${industryGroup}"`,
      );
      return;
    }

    const title = this.interpolate(template.title, variables);
    const body = this.interpolate(template.body, variables);

    await this.notificationsService.create({
      type: template.category === 'alert' ? 'WARNING' : 'INFO',
      title,
      message: body,
      tenantId,
      userId: options?.userId,
      payload: { templateSlug, industryGroup, variables },
    });

    this.logger.debug(
      `Sent notification "${templateSlug}" for tenant=${tenantId} group=${industryGroup}`,
    );
  }

  private interpolate(
    template: string,
    variables: Record<string, string>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      return variables[key] ?? `{{${key}}}`;
    });
  }
}
