import { GoogleGmailService } from '../google-gmail.service';
import type { GoogleAuthClient } from '../google-auth.client';

const authClient = {
  getAccessToken: jest.fn().mockResolvedValue('fake-access-token'),
} as unknown as GoogleAuthClient;

function makeService(): GoogleGmailService {
  return new GoogleGmailService(authClient);
}

interface FetchCall {
  url: string;
  init: RequestInit;
}

let fetchSpy: jest.SpyInstance;

function lastCall(): FetchCall {
  const call = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
  return { url: call[0] as string, init: (call[1] ?? {}) as RequestInit };
}

beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({}),
    } as Response),
  );
});

afterEach(() => {
  fetchSpy.mockRestore();
  (authClient.getAccessToken as jest.Mock).mockReset();
  (authClient.getAccessToken as jest.Mock).mockResolvedValue('fake-access-token');
});

describe('GoogleGmailService.listInbox', () => {
  it('returns messages parsed with headers from Gmail API metadata format', async () => {
    const svc = makeService();

    const msgMeta = {
      id: 'msg-1',
      threadId: 'thread-1',
      snippet: 'Hello world',
      labelIds: ['INBOX', 'UNREAD'],
      payload: {
        headers: [
          { name: 'From', value: 'alice@example.com' },
          { name: 'To', value: 'bob@example.com' },
          { name: 'Subject', value: 'Test Subject' },
          { name: 'Date', value: 'Mon, 06 Jul 2026 10:00:00 +0000' },
        ],
      },
    };

    let callCount = 0;
    fetchSpy.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(''),
          json: () =>
            Promise.resolve({
              messages: [{ id: 'msg-1', threadId: 'thread-1' }],
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve(msgMeta),
      } as Response);
    });

    const result = await svc.listInbox('tenant-1');

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual({
      id: 'msg-1',
      threadId: 'thread-1',
      from: 'alice@example.com',
      to: 'bob@example.com',
      subject: 'Test Subject',
      snippet: 'Hello world',
      date: 'Mon, 06 Jul 2026 10:00:00 +0000',
      isUnread: true,
      labels: ['INBOX', 'UNREAD'],
    });
  });

  it('returns empty array when no messages', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({ messages: [] }),
      } as Response),
    );

    const result = await svc.listInbox('tenant-1');

    expect(result.messages).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('passes q, labelIds, pageToken, maxResults in URL params', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({ messages: [] }),
      } as Response),
    );

    await svc.listInbox('tenant-1', {
      maxResults: 10,
      labelIds: ['INBOX', 'IMPORTANT'],
      pageToken: 'tok-abc',
      q: 'from:alice',
    });

    const { url } = lastCall();
    expect(url).toContain('maxResults=10');
    expect(url).toContain('labelIds=INBOX');
    expect(url).toContain('labelIds=IMPORTANT');
    expect(url).toContain('pageToken=tok-abc');
    expect(url).toContain('q=from%3Aalice');
  });

  it('throws BadRequestException when authClient returns null (no token)', async () => {
    const svc = makeService();
    (authClient.getAccessToken as jest.Mock).mockResolvedValueOnce(null);

    await expect(svc.listInbox('tenant-1')).rejects.toThrow('Google is not connected');
  });
});

describe('GoogleGmailService.getMessage', () => {
  it('parses From/To/Subject/Date headers and UNREAD label', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            id: 'msg-2',
            threadId: 'thread-2',
            snippet: 'Snippet text',
            labelIds: ['INBOX', 'UNREAD', 'CATEGORY_PERSONAL'],
            payload: {
              headers: [
                { name: 'From', value: 'sender@test.com' },
                { name: 'To', value: 'recipient@test.com' },
                { name: 'Subject', value: 'Important: Read Me' },
                { name: 'Date', value: 'Tue, 07 Jul 2026 08:00:00 +0500' },
              ],
            },
          }),
      } as Response),
    );

    const result = await svc.getMessage('msg-2', 'thread-2');

    expect(result.id).toBe('msg-2');
    expect(result.threadId).toBe('thread-2');
    expect(result.from).toBe('sender@test.com');
    expect(result.to).toBe('recipient@test.com');
    expect(result.subject).toBe('Important: Read Me');
    expect(result.snippet).toBe('Snippet text');
    expect(result.date).toBe('Tue, 07 Jul 2026 08:00:00 +0500');
    expect(result.isUnread).toBe(true);
    expect(result.labels).toEqual(['INBOX', 'UNREAD', 'CATEGORY_PERSONAL']);
  });

  it('throws BadRequestException when authClient returns null', async () => {
    const svc = makeService();
    (authClient.getAccessToken as jest.Mock).mockResolvedValueOnce(null);

    await expect(svc.getMessage('msg-1', 'thread-1')).rejects.toThrow('Google is not connected');
  });
});

describe('GoogleGmailService.getMessageBody', () => {
  it('decodes base64url plain text from multipart parts', async () => {
    const svc = makeService();
    const plainB64 = Buffer.from('Hello plain text body').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            payload: {
              parts: [
                { mimeType: 'text/plain', body: { data: plainB64 } },
                { mimeType: 'text/html', body: { data: plainB64 } },
              ],
            },
          }),
      } as Response),
    );

    const result = await svc.getMessageBody('msg-1', 'tenant-1');

    expect(result.plainText).toBe('Hello plain text body');
  });

  it('decodes base64url HTML from multipart parts', async () => {
    const svc = makeService();
    const htmlB64 = Buffer.from('<h1>Hello HTML</h1>').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            payload: {
              parts: [
                { mimeType: 'text/plain', body: {} },
                { mimeType: 'text/html', body: { data: htmlB64 } },
              ],
            },
          }),
      } as Response),
    );

    const result = await svc.getMessageBody('msg-1', 'tenant-1');

    expect(result.html).toBe('<h1>Hello HTML</h1>');
    expect(result.plainText).toBe('');
  });

  it('throws BadRequestException when authClient returns null', async () => {
    const svc = makeService();
    (authClient.getAccessToken as jest.Mock).mockResolvedValueOnce(null);

    await expect(svc.getMessageBody('msg-1', 'tenant-1')).rejects.toThrow('Google is not connected');
  });
});

describe('GoogleGmailService.sendEmail', () => {
  it('constructs raw MIME message with To/Subject/Cc/Bcc/Content-Type and base64url body', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({ id: 'sent-1', threadId: 'thread-1' }),
      } as Response),
    );

    await svc.sendEmail('tenant-1', {
      to: 'user@example.com',
      subject: 'Hello',
      body: 'Test body',
      cc: 'cc@example.com',
      bcc: 'bcc@example.com',
    });

    const { init } = lastCall();
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.raw).toBeDefined();

    const decoded = Buffer.from(body.raw, 'base64url').toString('utf-8');
    expect(decoded).toContain('To: user@example.com');
    expect(decoded).toContain('Subject: Hello');
    expect(decoded).toContain('Cc: cc@example.com');
    expect(decoded).toContain('Bcc: bcc@example.com');
    expect(decoded).toContain('Content-Type: text/plain');
    expect(decoded).toContain('Test body');
  });

  it('returns messageId and threadId from API response', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({ id: 'sent-2', threadId: 'thread-2' }),
      } as Response),
    );

    const result = await svc.sendEmail('tenant-1', {
      to: 'user@example.com',
      subject: 'Test',
      body: 'Body',
    });

    expect(result).toEqual({ messageId: 'sent-2', threadId: 'thread-2' });
  });

  it('throws BadRequestException when authClient returns null', async () => {
    const svc = makeService();
    (authClient.getAccessToken as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      svc.sendEmail('tenant-1', { to: 'a@b.com', subject: 'S', body: 'B' }),
    ).rejects.toThrow('Google is not connected');
  });
});

describe('GoogleGmailService.listLabels', () => {
  it('returns label list from API', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            labels: [
              { id: 'INBOX', name: 'INBOX', type: 'system' },
              { id: 'Label_1', name: 'Personal', type: 'user' },
            ],
          }),
      } as Response),
    );

    const result = await svc.listLabels('tenant-1');

    expect(result).toEqual([
      { id: 'INBOX', name: 'INBOX', type: 'system' },
      { id: 'Label_1', name: 'Personal', type: 'user' },
    ]);
  });

  it('throws BadRequestException when authClient returns null', async () => {
    const svc = makeService();
    (authClient.getAccessToken as jest.Mock).mockResolvedValueOnce(null);

    await expect(svc.listLabels('tenant-1')).rejects.toThrow('Google is not connected');
  });
});
