/**
 * OpenClaw Inbox Notifier
 *
 * Implements IInboxNotifier - logs notifications and stores in repository
 * Multi-channel delivery (email, slack) is a future enhancement
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  IInboxNotifier,
  InboxItemInput,
} from '../interfaces/inbox.interface';

@Injectable()
export class OpenClawInboxNotifier implements IInboxNotifier {
  private readonly logger = new Logger(OpenClawInboxNotifier.name);

  /**
   * Send a notification to a user's inbox
   * For now, just logs - multi-channel delivery future enhancement
   */
  async notify(userId: string, item: InboxItemInput): Promise<void> {
    this.logger.log(
      `Inbox notification for user ${userId}: [${item.kind}] ${item.title}`,
    );
    // Multi-channel delivery (email, slack) would be implemented here
    // using OpenClaw gateway when available
  }

  /**
   * Send multiple notifications to a user
   */
  async notifyBatch(userId: string, items: InboxItemInput[]): Promise<void> {
    this.logger.log(
      `Batch notifications for user ${userId}: ${items.length} items`,
    );
    for (const item of items) {
      await this.notify(userId, item);
    }
  }

  /**
   * Send to multiple channels
   * Future: email, slack via OpenClaw gateway
   */
  async notifyMultiChannel(
    userId: string,
    item: InboxItemInput,
    channels: string[],
  ): Promise<void> {
    this.logger.log(
      `Multi-channel notification for user ${userId} via ${channels.join(', ')}: ${item.title}`,
    );
    await this.notify(userId, item);
  }
}
