import api from './api';
import { unwrapItem } from './unwrap';

export interface IntegrationStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
  expiresAt?: string;
}

export interface Integration {
  provider: string;
  label: string;
  description: string;
  connected: boolean;
  email?: string;
  scopes?: string[];
  expiresAt?: string;
}

export interface IntegrationsList {
  google: Integration;
  brevo: Integration;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  labels: string[];
}

export interface GmailMessageBody {
  plainText: string;
  html: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  html?: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees: { email: string; responseStatus?: string }[];
  status: string;
  htmlLink?: string;
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
  timeZone?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
}

export interface AgentFolder {
  agentId: string;
  agentName: string;
  folderId: string;
  folderLink?: string;
}

export interface AgentFoldersResponse {
  rootFolderId: string;
  agents: AgentFolder[];
}

export interface SetupAgentFoldersResponse {
  folderId: string;
  subfolders: Record<string, string>;
}

class IntegrationsService {
  async listIntegrations(): Promise<IntegrationsList> {
    const res = await api.get('/integrations');
    return unwrapItem(res) as IntegrationsList;
  }

  async getGoogleStatus(): Promise<IntegrationStatus> {
    const res = await api.get('/integrations/google/status');
    return unwrapItem(res) as IntegrationStatus;
  }

  async getBrevoStatus(): Promise<{ connected: boolean }> {
    const res = await api.get('/integrations/brevo/status');
    return unwrapItem(res) as { connected: boolean };
  }

  async initiateGoogleOAuth(redirectUri?: string): Promise<{ url: string }> {
    const res = await api.post('/integrations/google/authorize', { redirectUri });
    return unwrapItem(res) as { url: string };
  }

  async disconnectGoogle(): Promise<void> {
    await api.post('/integrations/google/disconnect');
  }

  async connectBrevo(apiKey: string): Promise<{ connected: boolean }> {
    const res = await api.post('/integrations/brevo/connect', { apiKey });
    return unwrapItem(res) as { connected: boolean };
  }

  async disconnectBrevo(): Promise<void> {
    await api.post('/integrations/brevo/disconnect');
  }

  async getBrevoUsage(): Promise<{
    sentToday: number;
    dailyLimit: number;
    warningThreshold: number;
    isAtWarning: boolean;
    isAtLimit: boolean;
    remaining: number;
  }> {
    const res = await api.get('/integrations/usage/brevo');
    const data = unwrapItem(res) as Record<string, unknown> | null;
    return {
      sentToday: (data?.sentToday as number) ?? 0,
      dailyLimit: (data?.dailyLimit as number) ?? 300,
      warningThreshold: (data?.warningThreshold as number) ?? 240,
      isAtWarning: (data?.isAtWarning as boolean) ?? false,
      isAtLimit: (data?.isAtLimit as boolean) ?? false,
      remaining: (data?.remaining as number) ?? 300,
    };
  }

  async getGoogleDriveFolders(): Promise<{
    rootFolderId: string | null;
    children: unknown[];
  }> {
    const res = await api.get('/integrations/google/drive-folders');
    return unwrapItem(res) as { rootFolderId: string | null; children: unknown[] };
  }

  // ─── Gmail ──────────────────────────────────────────────────────────

  async getInbox(options: { maxResults?: number; pageToken?: string; q?: string } = {}): Promise<{
    messages: GmailMessage[];
    nextPageToken?: string;
  }> {
    const params: Record<string, string> = {};
    if (options.maxResults) params.maxResults = String(options.maxResults);
    if (options.pageToken) params.pageToken = options.pageToken;
    if (options.q) params.q = options.q;
    const res = await api.get('/integrations/gmail/inbox', { params });
    return unwrapItem(res) as { messages: GmailMessage[]; nextPageToken?: string };
  }

  async getMessage(id: string): Promise<GmailMessage> {
    const res = await api.get(`/integrations/gmail/messages/${id}`);
    return unwrapItem(res) as GmailMessage;
  }

  async getMessageBody(id: string): Promise<GmailMessageBody> {
    const res = await api.get(`/integrations/gmail/messages/${id}/body`);
    return unwrapItem(res) as GmailMessageBody;
  }

  async sendEmail(input: SendEmailInput): Promise<{ messageId: string; threadId: string }> {
    const res = await api.post('/integrations/gmail/send', input);
    return unwrapItem(res) as { messageId: string; threadId: string };
  }

  async getGmailLabels(): Promise<{ id: string; name: string; type: string }[]> {
    const res = await api.get('/integrations/gmail/labels');
    return unwrapItem(res) as { id: string; name: string; type: string }[];
  }

  // ─── Calendar ──────────────────────────────────────────────────────

  async getCalendarEvents(options: {
    calendarId?: string;
    maxResults?: number;
    timeMin?: string;
    timeMax?: string;
    q?: string;
  } = {}): Promise<CalendarEvent[]> {
    const params: Record<string, string> = {};
    if (options.calendarId) params.calendarId = options.calendarId;
    if (options.maxResults) params.maxResults = String(options.maxResults);
    if (options.timeMin) params.timeMin = options.timeMin;
    if (options.timeMax) params.timeMax = options.timeMax;
    if (options.q) params.q = options.q;
    const res = await api.get('/integrations/calendar/events', { params });
    return unwrapItem(res) as CalendarEvent[];
  }

  async createCalendarEvent(input: CreateEventInput, calendarId?: string): Promise<CalendarEvent> {
    const params = calendarId ? { calendarId } : {};
    const res = await api.post('/integrations/calendar/events', input, { params });
    return unwrapItem(res) as CalendarEvent;
  }

  async deleteCalendarEvent(id: string, calendarId?: string): Promise<void> {
    const params = calendarId ? { calendarId } : {};
    await api.delete(`/integrations/calendar/events/${id}`, { params });
  }

  async getCalendarList(): Promise<{ id: string; summary: string; primary: boolean }[]> {
    const res = await api.get('/integrations/calendar/list');
    return unwrapItem(res) as { id: string; summary: string; primary: boolean }[];
  }

  // ─── Drive ──────────────────────────────────────────────────────────

  async listAgentFolders(): Promise<AgentFoldersResponse> {
    const res = await api.get('/integrations/drive/folders/agents');
    return unwrapItem(res) as AgentFoldersResponse;
  }

  async setupAgentFolders(agentId: string, agentName: string): Promise<SetupAgentFoldersResponse> {
    const res = await api.post(`/integrations/drive/folders/agents/${agentId}/setup`, { agentName });
    return unwrapItem(res) as SetupAgentFoldersResponse;
  }

  async listDriveFiles(folderId: string): Promise<DriveFile[]> {
    const res = await api.get(`/integrations/drive/folders/${folderId}/files`);
    return unwrapItem(res) as DriveFile[];
  }

  async createDriveFolder(name: string, parentId?: string): Promise<DriveFile> {
    const res = await api.post('/integrations/drive/folders', { name, parentId });
    return unwrapItem(res) as DriveFile;
  }

  async createDriveFile(input: { name: string; content: string; mimeType?: string; parentId?: string }): Promise<DriveFile> {
    const res = await api.post('/integrations/drive/files', input);
    return unwrapItem(res) as DriveFile;
  }
}

export const integrationsService = new IntegrationsService();