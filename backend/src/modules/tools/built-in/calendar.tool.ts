import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { GoogleCalendarService } from '../../integrations/google/google-calendar.service';

export const CalendarInputSchema = z.object({
  action: z
    .enum(['list', 'create', 'delete', 'list_calendars', 'find_free_slots'])
    .describe('Calendar operation to perform'),

  calendarId: z
    .string()
    .optional()
    .describe('Calendar ID (defaults to primary; for find_free_slots, accepts comma-separated IDs for cross-calendar checking)'),
  maxResults: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe('Max events to return (list, default 25)'),
  timeMin: z
    .string()
    .optional()
    .describe('Earliest start time in ISO 8601 (list/find_free_slots)'),
  timeMax: z
    .string()
    .optional()
    .describe('Latest end time in ISO 8601 (list/find_free_slots)'),
  q: z
    .string()
    .optional()
    .describe('Free-text search across event fields (list)'),

  summary: z.string().optional().describe('Event title (create, required)'),
  description: z.string().optional().describe('Event description (create)'),
  start: z
    .string()
    .optional()
    .describe('Start time ISO 8601 (create, required)'),
  end: z.string().optional().describe('End time ISO 8601 (create, required)'),
  location: z.string().optional().describe('Event location (create)'),
  attendees: z
    .array(z.string())
    .optional()
    .describe('Attendee email addresses (create)'),
  timeZone: z
    .string()
    .optional()
    .describe('Timezone e.g. America/New_York (create)'),

  eventId: z
    .string()
    .optional()
    .describe('Event ID (delete/find_free_slots reference)'),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Desired meeting length in minutes (find_free_slots, default 30)',
    ),
});
export type CalendarInput = z.infer<typeof CalendarInputSchema>;

export const CalendarOutputSchema = z.object({
  action: z.string(),
  count: z.number().optional(),
  events: z
    .array(
      z.object({
        id: z.string(),
        summary: z.string(),
        description: z.string().optional(),
        start: z.string(),
        end: z.string(),
        location: z.string().optional(),
        attendees: z.array(
          z.object({
            email: z.string(),
            responseStatus: z.string().optional(),
          }),
        ),
        status: z.string(),
        htmlLink: z.string().optional(),
      }),
    )
    .optional(),
  calendars: z
    .array(
      z.object({ id: z.string(), summary: z.string(), primary: z.boolean() }),
    )
    .optional(),
  created: z
    .object({
      id: z.string(),
      summary: z.string(),
      start: z.string(),
      end: z.string(),
      htmlLink: z.string().optional(),
    })
    .optional(),
  deleted: z.boolean().optional(),
  freeSlots: z
    .array(z.object({ start: z.string(), end: z.string() }))
    .optional(),
  calendarsChecked: z.array(z.string()).optional(),
  eventId: z.string().optional(),
});
export type CalendarOutput = z.infer<typeof CalendarOutputSchema>;

@Injectable()
export class CalendarTool extends BaseStructuredTool {
  readonly name = 'calendar';
  readonly description =
    'Manage Google Calendar events for the agent. ' +
    "action='list' shows upcoming events with optional search and date filters. " +
    "action='create' schedules a new event with attendees, location, and timezone. " +
    "action='delete' cancels an existing event. " +
    "action='list_calendars' lists all available calendars. " +
    "action='find_free_slots' finds open time windows on a given day between existing events. " +
    'Use this to schedule meetings, set reminders, and manage team availability.';
  readonly category = ToolCategory.COMMUNICATION;
  readonly inputSchema = CalendarInputSchema;
  readonly outputSchema = CalendarOutputSchema;
  readonly requiredPermissions = ['calendar:read', 'calendar:write'];

  constructor(private readonly calendar: GoogleCalendarService) {
    super();
  }

  protected async executeImpl(
    input: CalendarInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<CalendarOutput>> {
    const tenantId = context?.tenantId;
    if (!tenantId) {
      return {
        success: false,
        error: 'Tenant context required for calendar operations',
      };
    }

    try {
      switch (input.action) {
        case 'list':
          return await this.listEvents(tenantId, input);
        case 'create':
          return await this.createEvent(tenantId, input);
        case 'delete':
          return await this.deleteEvent(tenantId, input);
        case 'list_calendars':
          return await this.listCalendars(tenantId);
        case 'find_free_slots':
          return await this.findFreeSlots(tenantId, input);
        default:
          return {
            success: false,
            error: `Unknown action: ${String(input.action)}`,
          };
      }
    } catch (error) {
      this.logger.error(`CalendarTool [${input.action}] failed`, error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Calendar operation failed',
      };
    }
  }

  private async listEvents(
    tenantId: string,
    input: CalendarInput,
  ): Promise<StructuredToolResult<CalendarOutput>> {
    const events = await this.calendar.listEvents(tenantId, {
      calendarId: input.calendarId,
      maxResults: input.maxResults ?? 25,
      timeMin: input.timeMin,
      timeMax: input.timeMax,
      q: input.q,
    });

    return {
      success: true,
      data: {
        action: 'list',
        count: events.length,
        events: events.map((e) => ({
          id: e.id,
          summary: e.summary,
          description: e.description,
          start: e.start,
          end: e.end,
          location: e.location,
          attendees: e.attendees,
          status: e.status,
          htmlLink: e.htmlLink,
        })),
      },
      metadata: { model: 'calendar-tool-v1' },
    };
  }

  private async createEvent(
    tenantId: string,
    input: CalendarInput,
  ): Promise<StructuredToolResult<CalendarOutput>> {
    if (!input.summary || !input.start || !input.end) {
      return {
        success: false,
        error: 'create requires summary, start, and end',
      };
    }

    const event = await this.calendar.createEvent(
      tenantId,
      {
        summary: input.summary,
        description: input.description,
        start: input.start,
        end: input.end,
        location: input.location,
        attendees: input.attendees,
        timeZone: input.timeZone,
      },
      input.calendarId,
    );

    return {
      success: true,
      data: {
        action: 'create',
        created: {
          id: event.id,
          summary: event.summary,
          start: event.start,
          end: event.end,
          htmlLink: event.htmlLink,
        },
      },
      metadata: { model: 'calendar-tool-v1' },
    };
  }

  private async deleteEvent(
    tenantId: string,
    input: CalendarInput,
  ): Promise<StructuredToolResult<CalendarOutput>> {
    if (!input.eventId) {
      return { success: false, error: 'eventId is required for delete' };
    }

    await this.calendar.deleteEvent(input.eventId, tenantId, input.calendarId);

    return {
      success: true,
      data: { action: 'delete', eventId: input.eventId, deleted: true },
      metadata: { model: 'calendar-tool-v1' },
    };
  }

  private async listCalendars(
    tenantId: string,
  ): Promise<StructuredToolResult<CalendarOutput>> {
    const calendars = await this.calendar.listCalendars(tenantId);

    return {
      success: true,
      data: {
        action: 'list_calendars',
        count: calendars.length,
        calendars,
      },
      metadata: { model: 'calendar-tool-v1' },
    };
  }

  private async findFreeSlots(
    tenantId: string,
    input: CalendarInput,
  ): Promise<StructuredToolResult<CalendarOutput>> {
    const now = new Date();
    const timeMin = input.timeMin ?? now.toISOString();
    const durationMinutes = input.durationMinutes ?? 30;
    const timeMax =
      input.timeMax ??
      new Date(new Date(timeMin).getTime() + 24 * 60 * 60 * 1000).toISOString();

    const calendarIds = input.calendarId
      ? input.calendarId.split(',').map((id) => id.trim()).filter(Boolean)
      : ['primary'];

    const allEvents: { start: string; end: string }[] = [];
    for (const calId of calendarIds) {
      const events = await this.calendar.listEvents(tenantId, {
        calendarId: calId,
        maxResults: 100,
        timeMin,
        timeMax,
      });
      for (const e of events) {
        if (e.start && e.end) {
          allEvents.push({ start: e.start, end: e.end });
        }
      }
    }

    const busySlots = allEvents
      .map((e) => ({
        start: new Date(e.start).getTime(),
        end: new Date(e.end).getTime(),
      }))
      .sort((a, b) => a.start - b.start);

    const freeSlots: { start: string; end: string }[] = [];
    let cursor = new Date(timeMin).getTime();
    const endMs = new Date(timeMax).getTime();
    const slotMs = durationMinutes * 60 * 1000;

    for (const busy of busySlots) {
      if (busy.start > cursor + slotMs) {
        freeSlots.push({
          start: new Date(cursor).toISOString(),
          end: new Date(busy.start).toISOString(),
        });
      }
      cursor = Math.max(cursor, busy.end);
    }

    if (endMs > cursor + slotMs) {
      freeSlots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(endMs).toISOString(),
      });
    }

    return {
      success: true,
      data: {
        action: 'find_free_slots',
        freeSlots,
        count: freeSlots.length,
        calendarsChecked: calendarIds,
      },
      metadata: { model: 'calendar-tool-v1' },
    };
  }
}
