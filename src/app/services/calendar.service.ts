import { Injectable } from '@angular/core';

export interface CalEvent {
  title: string;
  start: Date;           // local Date from your IntentParser
  end: Date;             // ensure end > start
  description?: string;
  location?: string;
}

@Injectable({ providedIn: 'root' })
export class CalendarService {

  // Pre-filled Google Calendar URL (no OAuth)
  gcalUrl(e: CalEvent) {
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); // YYYYMMDDThhmmssZ
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: e.title || 'Plan',
      dates: `${fmt(e.start)}/${fmt(e.end)}`,
      details: e.description || '',
      location: e.location || ''
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  // Build a universal .ics file
  buildIcs(e: CalEvent): Blob {
    const esc = (s = '') => s.replace(/[\n\r]/g, '\\n').replace(/,/g, '\\,');
    const dt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); // UTC
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@rain-vs-flame`;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RainVsFlame//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dt(new Date())}`,
      `DTSTART:${dt(e.start)}`,
      `DTEND:${dt(e.end)}`,
      `SUMMARY:${esc(e.title)}`,
      e.location ? `LOCATION:${esc(e.location)}` : '',
      e.description ? `DESCRIPTION:${esc(e.description)}` : '',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');
    return new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  }

  downloadIcs(e: CalEvent, filename = 'event.ics') {
    const blob = this.buildIcs(e);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = filename;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
