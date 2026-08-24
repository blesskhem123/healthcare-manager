import { google } from 'googleapis';

export interface CalendarEventDetails {
  summary: string;
  description: string;
  startDateTime: string; // ISO String
  endDateTime: string;   // ISO String
  patientEmail: string;
  doctorEmail: string;
}

function getCalendarClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken && clientId !== 'your_google_client_id') {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  return null;
}

/**
 * Create Google Calendar Event for Appointment
 */
export async function createCalendarEvent(details: CalendarEventDetails): Promise<string | null> {
  const calendar = getCalendarClient();

  if (!calendar) {
    console.log(`[MOCK GOOGLE CALENDAR] Event Created: "${details.summary}" between ${details.patientEmail} and ${details.doctorEmail}`);
    return `mock-calendar-event-${Date.now()}`;
  }

  try {
    const event = {
      summary: details.summary,
      description: details.description,
      start: { dateTime: details.startDateTime, timeZone: 'UTC' },
      end: { dateTime: details.endDateTime, timeZone: 'UTC' },
      attendees: [
        { email: details.patientEmail },
        { email: details.doctorEmail }
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 }
        ]
      }
    };

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all'
    });

    return res.data.id || null;
  } catch (err) {
    console.warn('Google Calendar API event creation failed (fallback mode active):', err);
    return `fallback-event-${Date.now()}`;
  }
}

/**
 * Update Google Calendar Event
 */
export async function updateCalendarEvent(eventId: string, details: Partial<CalendarEventDetails>): Promise<boolean> {
  const calendar = getCalendarClient();

  if (!calendar || eventId.startsWith('mock-') || eventId.startsWith('fallback-')) {
    console.log(`[MOCK GOOGLE CALENDAR] Event Updated: ID ${eventId}`);
    return true;
  }

  try {
    const patchObj: any = {};
    if (details.summary) patchObj.summary = details.summary;
    if (details.description) patchObj.description = details.description;
    if (details.startDateTime) patchObj.start = { dateTime: details.startDateTime, timeZone: 'UTC' };
    if (details.endDateTime) patchObj.end = { dateTime: details.endDateTime, timeZone: 'UTC' };

    await calendar.events.patch({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: patchObj,
      sendUpdates: 'all'
    });

    return true;
  } catch (err) {
    console.warn(`Google Calendar API event update failed for ${eventId}:`, err);
    return false;
  }
}

/**
 * Delete Google Calendar Event
 */
export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  const calendar = getCalendarClient();

  if (!calendar || eventId.startsWith('mock-') || eventId.startsWith('fallback-')) {
    console.log(`[MOCK GOOGLE CALENDAR] Event Deleted: ID ${eventId}`);
    return true;
  }

  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: 'all'
    });

    return true;
  } catch (err) {
    console.warn(`Google Calendar API event deletion failed for ${eventId}:`, err);
    return false;
  }
}
