import { useState, useCallback } from "react";
import { useGoogleLogin } from "@react-oauth/google";

const STORAGE_KEY = "gcal_token";

export interface CalendarEventInput {
  title: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  description?: string;
  attendeeEmail?: string;
  attendeeName?: string;
  ccEmails?: string[];
  timeZone: string;
}

export interface CreatedCalendarEvent {
  id: string;
  htmlLink: string;
  hangoutLink?: string;
}

function loadToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { token, expires } = JSON.parse(raw);
    if (Date.now() > expires) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function useGoogleCalendar() {
  const [accessToken, setAccessToken] = useState<string | null>(loadToken);

  const connect = useGoogleLogin({
    scope: "https://www.googleapis.com/auth/calendar.events",
    onSuccess: (tokenResponse) => {
      const expires = Date.now() + ((tokenResponse.expires_in ?? 3600) - 60) * 1000;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: tokenResponse.access_token, expires }));
      setAccessToken(tokenResponse.access_token);
    },
    onError: (err) => {
      console.error("Google OAuth error:", err);
    },
  });

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAccessToken(null);
  }, []);

  const createEvent = useCallback(
    async (input: CalendarEventInput): Promise<CreatedCalendarEvent> => {
      if (!accessToken) throw new Error("Google Calendar not connected");

      const attendees: { email: string; displayName?: string }[] = [];
      if (input.attendeeEmail) {
        attendees.push({ email: input.attendeeEmail, displayName: input.attendeeName });
      }
      input.ccEmails?.forEach((email) => attendees.push({ email }));

      const body = {
        summary: input.title,
        location: input.location,
        description: input.description,
        start: { dateTime: input.startDateTime, timeZone: input.timeZone },
        end:   { dateTime: input.endDateTime,   timeZone: input.timeZone },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: `crm-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email",  minutes: 24 * 60 },
            { method: "popup",  minutes: 60 },
          ],
        },
        guestsCanSeeOtherGuests: true,
      };

      const res = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401) {
          localStorage.removeItem(STORAGE_KEY);
          setAccessToken(null);
          throw new Error("Google Calendar session expired. Please reconnect.");
        }
        throw new Error(errData.error?.message ?? "Failed to create calendar event");
      }

      return res.json();
    },
    [accessToken]
  );

  return { isConnected: !!accessToken, connect, disconnect, createEvent };
}
