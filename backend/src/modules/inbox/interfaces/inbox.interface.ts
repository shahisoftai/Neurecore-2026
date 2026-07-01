export interface IInboxNotifier {
  notify(userId: string, item: InboxItemInput): Promise<void>;
  notifyBatch(userId: string, items: InboxItemInput[]): Promise<void>;
  notifyMultiChannel(userId: string, item: InboxItemInput, channels: string[]): Promise<void>;
}

export interface IInboxRepository {
  create(userId: string, tenantId: string, input: InboxItemInput): Promise<InboxItem>;
  findByUser(userId: string, tenantId: string, options?: FindInboxOptions): Promise<InboxItem[]>;
  findById(id: string): Promise<InboxItem | null>;
  markRead(id: string, userId: string, tenantId: string): Promise<void>;
  markArchived(id: string, userId: string, tenantId: string): Promise<void>;
  markAllRead(userId: string, tenantId: string): Promise<void>;
  getUnreadCount(userId: string, tenantId: string): Promise<number>;
  cleanupOldItems(olderThanDays: number): Promise<number>;
}

export interface InboxItemInput {
  kind: InboxKind;
  title: string;
  body?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  entityType: string;
  entityId: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export type InboxKind =
  | 'APPROVAL'
  | 'FAILED_TASK'
  | 'AGENT_ALERT'
  | 'BUDGET_ALERT'
  | 'MENTION'
  | 'SYSTEM';

export type InboxStatus = 'UNREAD' | 'READ' | 'ARCHIVED' | 'DISMISSED';

export interface FindInboxOptions {
  status?: InboxStatus;
  kind?: InboxKind;
  limit?: number;
  offset?: number;
}

export interface InboxItem {
  id: string;
  tenantId: string;
  userId: string;
  kind: InboxKind;
  title: string;
  body?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: InboxStatus;
  entityType: string;
  entityId: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  readAt?: Date;
  archivedAt?: Date;
  createdAt: Date;
}
