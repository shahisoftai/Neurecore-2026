import api from './api';

/**
 * ActivityFeedService — Phase 5 client for the unified activity feed.
 *
 * Calls the canonical `/api/v1/activity` endpoint, which returns
 * tenant-scoped + visibility-scoped events. Mirrors the server's
 * `ActivityEvent` model shape.
 */

export interface ActivityFeedEvent {
  id: string;
  tenantId: string;
  actorType: 'USER' | 'AI_AGENT' | 'SYSTEM' | 'WORKFLOW' | 'EXTERNAL';
  actorId: string;
  type: string;
  title: string;
  description?: string | null;
  threadId?: string | null;
  contextType?: string | null;
  contextId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  severity: string;
  visibility: string;
  targetParticipantType?: string | null;
  targetParticipantId?: string | null;
  createdAt: string | Date;
  expiresAt?: string | Date | null;
}

export interface ActivityFeedListResponse {
  status: string;
  data: { events: ActivityFeedEvent[] };
}

export interface ActivityFeedListParams {
  limit?: number;
  before?: string;
  since?: string;
  severity?: string;
  agentId?: string;
}

export const activityFeedService = {
  async list(params: ActivityFeedListParams = {}): Promise<ActivityFeedEvent[]> {
    const res = await api.get<{ data?: { data?: { events?: ActivityFeedEvent[] } } }>(
      '/activity',
      {
        params: {
          limit: params.limit ?? 50,
          ...(params.before ? { before: params.before } : {}),
          ...(params.since ? { since: params.since } : {}),
          ...(params.severity ? { severity: params.severity } : {}),
          ...(params.agentId ? { agentId: params.agentId } : {}),
        },
      },
    );
    // NestJS responses use { status, data: { status, data: { events } } }.
    // Unwrap both envelope layers before returning.
    // NestJS responses use { status, data: { status, data: { events } } }.
    // Unwrap both envelope layers before returning.
    const outer = (res.data as any)?.data?.data?.events as
      | ActivityFeedEvent[]
      | undefined;
    const inner = (res.data as any)?.data?.events as
      | ActivityFeedEvent[]
      | undefined;
    const payload: ActivityFeedEvent[] = outer ?? inner ?? [];
    return Array.isArray(payload) ? payload : [];
  },
};

export default activityFeedService;