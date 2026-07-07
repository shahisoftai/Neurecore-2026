import { CalendarTool } from './calendar.tool';

describe('CalendarTool', () => {
  let tool: CalendarTool;
  const mockCalendar = {
    listEvents: jest.fn(),
    createEvent: jest.fn(),
    deleteEvent: jest.fn(),
    listCalendars: jest.fn(),
  };
  const tenantId = 'tenant-1';

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new CalendarTool(mockCalendar as any);
  });

  describe('list', () => {
    it('returns events with parsed properties (id, summary, start, end, etc.)', async () => {
      const rawEvents = [
        {
          id: 'evt1',
          summary: 'Team Sync',
          description: 'Weekly sync',
          start: '2026-01-01T09:00:00Z',
          end: '2026-01-01T10:00:00Z',
          location: 'Room A',
          attendees: [{ email: 'alice@test.com', responseStatus: 'accepted' }],
          status: 'confirmed',
          htmlLink: 'https://calendar.google.com/evt1',
        },
      ];
      mockCalendar.listEvents.mockResolvedValue(rawEvents);

      const result = await (tool as any).executeImpl(
        { action: 'list' },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('list');
      expect(result.data.count).toBe(1);
      expect(result.data.events[0]).toEqual({
        id: 'evt1',
        summary: 'Team Sync',
        description: 'Weekly sync',
        start: '2026-01-01T09:00:00Z',
        end: '2026-01-01T10:00:00Z',
        location: 'Room A',
        attendees: [{ email: 'alice@test.com', responseStatus: 'accepted' }],
        status: 'confirmed',
        htmlLink: 'https://calendar.google.com/evt1',
      });
    });

    it('passes calendarId, maxResults, timeMin, timeMax, q to calendar.listEvents', async () => {
      mockCalendar.listEvents.mockResolvedValue([]);

      await (tool as any).executeImpl(
        {
          action: 'list',
          calendarId: 'cal-2',
          maxResults: 10,
          timeMin: '2026-01-01T00:00:00Z',
          timeMax: '2026-01-02T00:00:00Z',
          q: 'sync',
        },
        { tenantId },
      );

      expect(mockCalendar.listEvents).toHaveBeenCalledWith(tenantId, {
        calendarId: 'cal-2',
        maxResults: 10,
        timeMin: '2026-01-01T00:00:00Z',
        timeMax: '2026-01-02T00:00:00Z',
        q: 'sync',
      });
    });
  });

  describe('create', () => {
    it('returns validation error when summary/start/end missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'create' },
        { tenantId },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('create requires summary, start, and end');
    });

    it('returns created event with id, summary, start, end, htmlLink', async () => {
      const created = {
        id: 'evt-new',
        summary: 'Design Review',
        start: '2026-01-01T14:00:00Z',
        end: '2026-01-01T15:00:00Z',
        htmlLink: 'https://calendar.google.com/evt-new',
      };
      mockCalendar.createEvent.mockResolvedValue(created);

      const result = await (tool as any).executeImpl(
        {
          action: 'create',
          summary: 'Design Review',
          start: '2026-01-01T14:00:00Z',
          end: '2026-01-01T15:00:00Z',
          location: 'Office',
          attendees: ['alice@test.com'],
          timeZone: 'America/New_York',
          description: 'Review mockups',
        },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('create');
      expect(result.data.created).toEqual({
        id: 'evt-new',
        summary: 'Design Review',
        start: '2026-01-01T14:00:00Z',
        end: '2026-01-01T15:00:00Z',
        htmlLink: 'https://calendar.google.com/evt-new',
      });
      expect(mockCalendar.createEvent).toHaveBeenCalledWith(
        tenantId,
        {
          summary: 'Design Review',
          description: 'Review mockups',
          start: '2026-01-01T14:00:00Z',
          end: '2026-01-01T15:00:00Z',
          location: 'Office',
          attendees: ['alice@test.com'],
          timeZone: 'America/New_York',
        },
        undefined,
      );
    });
  });

  describe('delete', () => {
    it('returns validation error when eventId missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'delete' },
        { tenantId },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('eventId is required for delete');
    });

    it('returns { deleted: true, eventId } on success', async () => {
      mockCalendar.deleteEvent.mockResolvedValue(undefined);

      const result = await (tool as any).executeImpl(
        { action: 'delete', eventId: 'evt-del' },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        action: 'delete',
        eventId: 'evt-del',
        deleted: true,
      });
      expect(mockCalendar.deleteEvent).toHaveBeenCalledWith(
        'evt-del',
        tenantId,
        undefined,
      );
    });
  });

  describe('list_calendars', () => {
    it('returns calendars array with count', async () => {
      const calendars = [
        { id: 'primary', summary: 'Primary', primary: true },
        { id: 'cal-2', summary: 'Work', primary: false },
      ];
      mockCalendar.listCalendars.mockResolvedValue(calendars);

      const result = await (tool as any).executeImpl(
        { action: 'list_calendars' },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('list_calendars');
      expect(result.data.count).toBe(2);
      expect(result.data.calendars).toEqual(calendars);
    });
  });

  describe('find_free_slots', () => {
    it('with single calendar computes free slots between busy events', async () => {
      const busyEvents = [
        {
          id: 'b1',
          summary: 'Meeting A',
          start: '2026-01-01T10:00:00Z',
          end: '2026-01-01T11:00:00Z',
        },
        {
          id: 'b2',
          summary: 'Meeting B',
          start: '2026-01-01T14:00:00Z',
          end: '2026-01-01T15:30:00Z',
        },
      ];
      mockCalendar.listEvents.mockResolvedValue(busyEvents);

      const result = await (tool as any).executeImpl(
        {
          action: 'find_free_slots',
          timeMin: '2026-01-01T08:00:00Z',
          durationMinutes: 30,
        },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('find_free_slots');
      expect(result.data.calendarsChecked).toEqual(['primary']);
      expect(result.data.freeSlots).toBeDefined();
      expect(result.data.freeSlots.length).toBeGreaterThan(0);
    });

    it('with comma-separated calendarIds queries multiple calendars and merges busy slots', async () => {
      const cal1Events = [
        {
          id: 'c1e1',
          summary: 'Cal1 Event',
          start: '2026-01-01T09:00:00Z',
          end: '2026-01-01T10:00:00Z',
        },
      ];
      const cal2Events = [
        {
          id: 'c2e1',
          summary: 'Cal2 Event',
          start: '2026-01-01T09:30:00Z',
          end: '2026-01-01T10:30:00Z',
        },
      ];

      mockCalendar.listEvents
        .mockResolvedValueOnce(cal1Events)
        .mockResolvedValueOnce(cal2Events);

      const result = await (tool as any).executeImpl(
        {
          action: 'find_free_slots',
          calendarId: 'cal-a,cal-b',
          timeMin: '2026-01-01T08:00:00Z',
          durationMinutes: 30,
        },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.calendarsChecked).toEqual(['cal-a', 'cal-b']);
      expect(mockCalendar.listEvents).toHaveBeenCalledTimes(2);
      expect(mockCalendar.listEvents).toHaveBeenCalledWith(tenantId, {
        calendarId: 'cal-a',
        maxResults: 100,
        timeMin: '2026-01-01T08:00:00Z',
        timeMax: expect.any(String),
      });
      expect(mockCalendar.listEvents).toHaveBeenCalledWith(tenantId, {
        calendarId: 'cal-b',
        maxResults: 100,
        timeMin: '2026-01-01T08:00:00Z',
        timeMax: expect.any(String),
      });
    });

    it('returns calendarsChecked in output', async () => {
      mockCalendar.listEvents.mockResolvedValue([]);

      const result = await (tool as any).executeImpl(
        {
          action: 'find_free_slots',
          calendarId: 'cal-x,cal-y',
          timeMin: '2026-01-01T08:00:00Z',
        },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.calendarsChecked).toEqual(['cal-x', 'cal-y']);
    });
  });

  describe('tenant context', () => {
    it('returns error when tenantId is missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'list' },
        {},
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant context required for calendar operations');
    });
  });
});
