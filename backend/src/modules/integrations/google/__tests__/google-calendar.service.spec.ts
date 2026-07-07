import { GoogleCalendarService } from '../google-calendar.service';
import type { GoogleAuthClient } from '../google-auth.client';

const authClient = {
  getAccessToken: jest.fn().mockResolvedValue('fake-access-token'),
} as unknown as GoogleAuthClient;

function makeService(): GoogleCalendarService {
  return new GoogleCalendarService(authClient);
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

describe('GoogleCalendarService.listEvents', () => {
  it('returns parsed events with start/end/attendees/status/htmlLink', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            items: [
              {
                id: 'evt-1',
                summary: 'Team Standup',
                description: 'Daily sync',
                start: { dateTime: '2026-07-07T09:00:00Z' },
                end: { dateTime: '2026-07-07T09:30:00Z' },
                location: 'Room A',
                attendees: [
                  { email: 'alice@example.com', responseStatus: 'accepted' },
                  { email: 'bob@example.com', responseStatus: 'needsAction' },
                ],
                status: 'confirmed',
                htmlLink: 'https://calendar.google.com/event?eid=evt-1',
              },
            ],
          }),
      } as Response),
    );

    const result = await svc.listEvents('tenant-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'evt-1',
      summary: 'Team Standup',
      description: 'Daily sync',
      start: '2026-07-07T09:00:00Z',
      end: '2026-07-07T09:30:00Z',
      location: 'Room A',
      attendees: [
        { email: 'alice@example.com', responseStatus: 'accepted' },
        { email: 'bob@example.com', responseStatus: 'needsAction' },
      ],
      status: 'confirmed',
      htmlLink: 'https://calendar.google.com/event?eid=evt-1',
    });
  });

  it('passes all query params (maxResults, timeMin, timeMax, q, singleEvents, orderBy)', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({ items: [] }),
      } as Response),
    );

    await svc.listEvents('tenant-1', {
      maxResults: 5,
      timeMin: '2026-07-01T00:00:00Z',
      timeMax: '2026-07-31T23:59:59Z',
      q: 'standup',
    });

    const { url } = lastCall();
    expect(url).toContain('maxResults=5');
    expect(url).toContain('singleEvents=true');
    expect(url).toContain('orderBy=startTime');
    expect(url).toContain('timeMin=2026-07-01T00%3A00%3A00Z');
    expect(url).toContain('timeMax=2026-07-31T23%3A59%3A59Z');
    expect(url).toContain('q=standup');
  });

  it("defaults calendarId to 'primary' when not provided", async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({ items: [] }),
      } as Response),
    );

    await svc.listEvents('tenant-1');

    const { url } = lastCall();
    expect(url).toContain('/calendars/primary/events');
  });

  it('returns empty array when API returns no items', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      } as Response),
    );

    const result = await svc.listEvents('tenant-1');

    expect(result).toEqual([]);
  });

  it('throws BadRequestException when authClient returns null', async () => {
    const svc = makeService();
    (authClient.getAccessToken as jest.Mock).mockResolvedValueOnce(null);

    await expect(svc.listEvents('tenant-1')).rejects.toThrow('Google is not connected');
  });
});

describe('GoogleCalendarService.createEvent', () => {
  it('constructs proper request body with start/end/attendees/timeZone', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            id: 'evt-new',
            summary: 'Meeting',
            start: { dateTime: '2026-07-08T14:00:00+05:00' },
            end: { dateTime: '2026-07-08T15:00:00+05:00' },
            attendees: [{ email: 'user@test.com' }],
            status: 'confirmed',
            htmlLink: 'https://calendar.google.com/event?eid=evt-new',
          }),
      } as Response),
    );

    await svc.createEvent('tenant-1', {
      summary: 'Meeting',
      description: 'Discuss roadmap',
      start: '2026-07-08T14:00:00+05:00',
      end: '2026-07-08T15:00:00+05:00',
      location: 'Conference Room',
      attendees: ['user@test.com'],
      timeZone: 'Asia/Karachi',
    });

    const { init } = lastCall();
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.summary).toBe('Meeting');
    expect(body.description).toBe('Discuss roadmap');
    expect(body.location).toBe('Conference Room');
    expect(body.start).toEqual({ dateTime: '2026-07-08T14:00:00+05:00', timeZone: 'Asia/Karachi' });
    expect(body.end).toEqual({ dateTime: '2026-07-08T15:00:00+05:00', timeZone: 'Asia/Karachi' });
    expect(body.attendees).toEqual([{ email: 'user@test.com' }]);
  });

  it('returns parsed CalendarEvent with htmlLink', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            id: 'evt-2',
            summary: 'Lunch',
            start: { dateTime: '2026-07-08T12:00:00Z' },
            end: { dateTime: '2026-07-08T13:00:00Z' },
            attendees: [],
            status: 'confirmed',
            htmlLink: 'https://calendar.google.com/event?eid=evt-2',
          }),
      } as Response),
    );

    const result = await svc.createEvent('tenant-1', {
      summary: 'Lunch',
      start: '2026-07-08T12:00:00Z',
      end: '2026-07-08T13:00:00Z',
    });

    expect(result.id).toBe('evt-2');
    expect(result.summary).toBe('Lunch');
    expect(result.htmlLink).toBe('https://calendar.google.com/event?eid=evt-2');
  });

  it('throws BadRequestException when authClient returns null', async () => {
    const svc = makeService();
    (authClient.getAccessToken as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      svc.createEvent('tenant-1', { summary: 'S', start: 'X', end: 'Y' }),
    ).rejects.toThrow('Google is not connected');
  });
});

describe('GoogleCalendarService.deleteEvent', () => {
  it('sends DELETE request with correct calendarId + eventId', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 204,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      } as Response),
    );

    await svc.deleteEvent('evt-del', 'tenant-1', 'custom-calendar');

    const { url, init } = lastCall();
    expect(init.method).toBe('DELETE');
    expect(url).toContain('/calendars/custom-calendar/events/evt-del');
  });

  it('swallows HTTP 410 status (does not throw)', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 410,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      } as Response),
    );

    await expect(svc.deleteEvent('evt-gone', 'tenant-1')).resolves.toBeUndefined();
  });

  it('throws BadRequestException when authClient returns null', async () => {
    const svc = makeService();
    (authClient.getAccessToken as jest.Mock).mockResolvedValueOnce(null);

    await expect(svc.deleteEvent('evt-1', 'tenant-1')).rejects.toThrow('Google is not connected');
  });
});

describe('GoogleCalendarService.listCalendars', () => {
  it('returns parsed calendar list with primary flag', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            items: [
              { id: 'primary@cal', summary: 'My Calendar', primary: true },
              { id: 'sec@cal', summary: 'Team Calendar', primary: false },
              { id: 'third@cal', summary: 'Holidays' },
            ],
          }),
      } as Response),
    );

    const result = await svc.listCalendars('tenant-1');

    expect(result).toEqual([
      { id: 'primary@cal', summary: 'My Calendar', primary: true },
      { id: 'sec@cal', summary: 'Team Calendar', primary: false },
      { id: 'third@cal', summary: 'Holidays', primary: false },
    ]);
  });

  it('throws BadRequestException when authClient returns null', async () => {
    const svc = makeService();
    (authClient.getAccessToken as jest.Mock).mockResolvedValueOnce(null);

    await expect(svc.listCalendars('tenant-1')).rejects.toThrow('Google is not connected');
  });
});
