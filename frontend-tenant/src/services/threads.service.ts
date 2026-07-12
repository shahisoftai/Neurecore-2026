// services/threads.service.ts — Enterprise Communication Platform
// Thread REST API client. SRP: communicates with backend thread endpoints only.
//
// 2026-07-11: Created for comms-gated tenant UI rollout.

import api from './api';

export interface ThreadData {
  id: string;
  tenantId: string;
  title: string;
  contextType?: string | null;
  contextId?: string | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'CLOSED';
  hopCount: number;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
}

export interface ThreadMessage {
  id: string;
  sessionId: string;
  threadId: string | null;
  role: 'USER' | 'HERMES' | 'SYSTEM';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CreateThreadParams {
  title: string;
  contextType?: string;
  contextId?: string;
  participants: Array<{ type: 'USER' | 'AI_AGENT'; id: string; role?: string }>;
}

export interface IThreadService {
  list(): Promise<ThreadData[]>;
  get(threadId: string): Promise<ThreadData | null>;
  create(params: CreateThreadParams): Promise<ThreadData>;
  getMessages(threadId: string, opts?: { limit?: number; before?: string }): Promise<ThreadMessage[]>;
  addParticipant(threadId: string, type: string, id: string, role?: string): Promise<void>;
  markRead(threadId: string): Promise<void>;
  getUnreadCount(): Promise<number>;
  close(threadId: string): Promise<void>;
}

function unwrap<T>(res: unknown, path: string[]): T {
  let v: any = (res as any)?.data;
  for (const key of path) {
    if (v == null) break;
    v = v[key];
  }
  return v as T;
}

function toThread(raw: any): ThreadData {
  return {
    id: raw.id ?? '',
    tenantId: raw.tenantId ?? '',
    title: raw.title ?? '',
    contextType: raw.contextType ?? null,
    contextId: raw.contextId ?? null,
    status: raw.status ?? 'ACTIVE',
    hopCount: typeof raw.hopCount === 'number' ? raw.hopCount : 0,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    closedAt: raw.closedAt ?? null,
  };
}

function toMessage(raw: any): ThreadMessage {
  return {
    id: raw.id ?? '',
    sessionId: raw.sessionId ?? '',
    threadId: raw.threadId ?? null,
    role: raw.role ?? 'SYSTEM',
    content: raw.content ?? '',
    metadata: raw.metadata ?? undefined,
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

export const threadService: IThreadService = {
  async list(): Promise<ThreadData[]> {
    const res = await api.get('/threads');
    const threads: any[] = unwrap<any[]>(res, ['data', 'threads']) ??
      unwrap<any[]>(res, ['threads']) ??
      unwrap<any[]>(res, ['data', 'data', 'threads']) ?? [];
    return Array.isArray(threads) ? threads.map(toThread) : [];
  },

  async get(threadId: string): Promise<ThreadData | null> {
    const res = await api.get(`/threads/${threadId}`);
    const raw = unwrap<any>(res, ['data', 'thread']) ??
      unwrap<any>(res, ['thread']) ??
      unwrap<any>(res, ['data', 'data', 'thread']);
    return raw && typeof raw === 'object' && raw.id ? toThread(raw) : null;
  },

  async create(params: CreateThreadParams): Promise<ThreadData> {
    const res = await api.post('/threads', params);
    const raw = unwrap<any>(res, ['data', 'thread']) ??
      unwrap<any>(res, ['thread']) ??
      unwrap<any>(res, ['data', 'data', 'thread']);
    if (!raw || typeof raw !== 'object' || !raw.id) {
      throw new Error('Invalid thread response from server');
    }
    return toThread(raw);
  },

  async getMessages(
    threadId: string,
    opts?: { limit?: number; before?: string },
  ): Promise<ThreadMessage[]> {
    const res = await api.get(`/threads/${threadId}/messages`, {
      params: { limit: opts?.limit ?? 50, ...(opts?.before ? { before: opts.before } : {}) },
    });
    const msgs: any[] = unwrap<any[]>(res, ['data', 'messages']) ??
      unwrap<any[]>(res, ['messages']) ??
      unwrap<any[]>(res, ['data', 'data', 'messages']) ?? [];
    return Array.isArray(msgs) ? msgs.map(toMessage) : [];
  },

  async addParticipant(
    threadId: string,
    type: string,
    id: string,
    role?: string,
  ): Promise<void> {
    await api.post(`/threads/${threadId}/participants`, { type, id, ...(role ? { role } : {}) });
  },

  async markRead(threadId: string): Promise<void> {
    await api.post(`/threads/${threadId}/read`, {});
  },

  async getUnreadCount(): Promise<number> {
    const res = await api.get('/threads/unread/count');
    const data = (res.data as any)?.data ?? res.data;
    const count = (data as any)?.count ?? (data as any)?.data?.count ?? 0;
    return typeof count === 'number' ? count : 0;
  },

  async close(threadId: string): Promise<void> {
    await api.delete(`/threads/${threadId}`);
  },
};

export default threadService;
