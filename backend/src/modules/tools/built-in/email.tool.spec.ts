import { EmailTool } from './email.tool';

describe('EmailTool', () => {
  let tool: EmailTool;
  const mockPrisma = { agent: { findUnique: jest.fn() } };
  const mockGmail = {
    listInbox: jest.fn(),
    getMessage: jest.fn(),
    getMessageBody: jest.fn(),
  };
  const mockProviderFactory = {
    forSend: jest.fn(),
  };
  const tenantId = 'tenant-1';

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new EmailTool(
      mockPrisma as any,
      mockGmail as any,
      mockProviderFactory as any,
    );
  });

  describe('read_inbox', () => {
    it('returns messages from gmail.listInbox with count and provider=gmail', async () => {
      const messages = [
        {
          id: 'msg1',
          threadId: 'thread1',
          from: 'alice@test.com',
          to: 'agent@test.com',
          subject: 'Hello',
          snippet: 'Hi there',
          date: '2026-01-01T00:00:00Z',
          isUnread: true,
          labels: ['INBOX'],
        },
      ];
      mockGmail.listInbox.mockResolvedValue({ messages });

      const result = await (tool as any).executeImpl(
        { action: 'read_inbox' },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        action: 'read_inbox',
        provider: 'gmail',
        count: 1,
        messages,
      });
    });

    it('passes maxResults, labelIds, q to gmail.listInbox', async () => {
      const messages: any[] = [];
      mockGmail.listInbox.mockResolvedValue({ messages });

      await (tool as any).executeImpl(
        {
          action: 'read_inbox',
          maxResults: 25,
          labelIds: ['UNREAD'],
          q: 'from:alice',
        },
        { tenantId },
      );

      expect(mockGmail.listInbox).toHaveBeenCalledWith(tenantId, {
        maxResults: 25,
        labelIds: ['UNREAD'],
        q: 'from:alice',
      });
    });
  });

  describe('get_message', () => {
    it('returns validation error when messageId missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'get_message' },
        { tenantId },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('messageId is required for get_message');
    });

    it('returns message body (plainText fallback to html)', async () => {
      const meta = {
        id: 'msg1',
        threadId: 'thread1',
        from: 'alice@test.com',
        to: 'agent@test.com',
        subject: 'Hello',
        snippet: 'Hi',
        date: '2026-01-01T00:00:00Z',
        isUnread: true,
        labels: ['INBOX'],
      };
      mockGmail.getMessage.mockResolvedValue(meta);
      mockGmail.getMessageBody.mockResolvedValue({ plainText: 'Plain body', html: '<p>HTML body</p>' });

      const result = await (tool as any).executeImpl(
        { action: 'get_message', messageId: 'msg1' },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.body).toBe('Plain body');
      expect(result.data.messageId).toBe('msg1');
    });

    it('falls back to html body when plainText is empty', async () => {
      const meta = {
        id: 'msg2',
        threadId: 'thread2',
        from: 'bob@test.com',
        to: 'agent@test.com',
        subject: 'Rich',
        snippet: '',
        date: '2026-01-01T00:00:00Z',
        isUnread: false,
        labels: [],
      };
      mockGmail.getMessage.mockResolvedValue(meta);
      mockGmail.getMessageBody.mockResolvedValue({ plainText: '', html: '<p>HTML only</p>' });

      const result = await (tool as any).executeImpl(
        { action: 'get_message', messageId: 'msg2' },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.body).toBe('<p>HTML only</p>');
    });
  });

  describe('send', () => {
    it('returns validation error when to/subject/body missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'send' },
        { tenantId },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('send requires to, subject, and body fields');
    });

    it('resolves sender via prisma agent lookup and providerFactory.forSend', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue({
        id: 'agent-1',
        name: 'Test Agent',
        tenantId,
        emailProvider: 'brevo',
        emailAlias: 'agent@test.com',
        emailDisplayName: 'Test Agent',
        emailSignature: null,
      });
      const sendResult = {
        provider: 'brevo',
        messageId: 'sent-1',
        threadId: 'thread-1',
      };
      const mockSend = jest.fn().mockResolvedValue(sendResult);
      mockProviderFactory.forSend.mockResolvedValue({ send: mockSend });

      const result = await (tool as any).executeImpl(
        {
          action: 'send',
          to: 'recipient@test.com',
          subject: 'Test',
          body: 'Test body',
        },
        { tenantId, agentId: 'agent-1' },
      );

      expect(result.success).toBe(true);
      expect(mockProviderFactory.forSend).toHaveBeenCalledWith(
        tenantId,
        'brevo',
        'auto',
      );
      expect(result.data.messageId).toBe('sent-1');
      expect(result.data.threadId).toBe('thread-1');
      expect(result.data.from).toBe('agent@test.com');
      expect(result.data.to).toBe('recipient@test.com');
      expect(result.data.subject).toBe('Test');
    });
  });

  describe('flag', () => {
    it('returns validation error when messageId missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'flag', priority: 'urgent' },
        { tenantId },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('messageId is required for flag');
    });

    it('returns validation error when priority missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'flag', messageId: 'msg1' },
        { tenantId },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'priority is required for flag (urgent|important|starred|clear)',
      );
    });

    it('applies IMPORTANT and STARRED labels for urgent priority', async () => {
      (mockGmail as any).getAccessToken = jest
        .fn()
        .mockResolvedValue('fake-token');
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(''),
      } as any);

      const result = await (tool as any).executeImpl(
        { action: 'flag', messageId: 'msg1', priority: 'urgent' },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('flag');
      expect(result.data.appliedLabels).toEqual(['IMPORTANT', 'STARRED']);

      delete (global as any).fetch;
    });
  });

  describe('tenant context', () => {
    it('returns error when tenantId is missing for any action', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'read_inbox' },
        {},
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant context required for email operations');
    });
  });
});
