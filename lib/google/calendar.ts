type GoogleCalendarEventResponse = {
  id?: string
  htmlLink?: string
  error?: {
    message?: string
  }
}

export async function createGoogleCalendarEvent({
  accessToken,
  summary,
  description,
  attendeeEmail,
  startIso,
  endIso,
}: {
  accessToken: string
  summary: string
  description: string
  attendeeEmail: string
  startIso: string
  endIso: string
}) {
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        summary,
        description,
        start: {
          dateTime: startIso,
        },
        end: {
          dateTime: endIso,
        },
        attendees: [{ email: attendeeEmail }],
      }),
      cache: 'no-store',
    },
  )

  const json = (await response.json()) as GoogleCalendarEventResponse

  if (!response.ok || !json.id) {
    throw new Error(json.error?.message || 'Falha ao criar evento no Google Calendar.')
  }

  return {
    id: json.id,
    htmlLink: json.htmlLink || null,
  }
}
