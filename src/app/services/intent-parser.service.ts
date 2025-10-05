import { Injectable } from '@angular/core';
import * as chrono from 'chrono-node';

export type WindowKind = 'day'|'week'|'month';
export interface IntentResult {
  window: WindowKind;
  // for your existing code:
  months: number[];            // used when window === 'month' (keep filled for labels)
  start?: Date; end?: Date;    // for day/week windows
  label: string;
}

@Injectable({ providedIn: 'root' })
export class IntentParserService {
  // Choose week start: 1 = Monday, 0 = Sunday
  private weekStartsOn: 0|1 = 1;

  parse(input: string): IntentResult | null {
    const q = (input || '').trim().toLowerCase();
    if (!q) return null;

    // 1) Relative week phrases ------------------------------------------------
    // "last week", "this week", "next week", "last 2 weeks"
    const relWeek = q.match(/^last\s+(\d+)\s+weeks?$/) || q.match(/^(last|this|next)\s+week$/);
    if (relWeek) {
      if (relWeek[1] && /\d+/.test(relWeek[1])) {
        const n = Math.max(1, parseInt(relWeek[1], 10));
        const { start, end } = this.rangeForLastNWeeks(n, new Date());
        return this.resultWeek(start, end, `${n} week${n>1?'s':''} back`);
      } else {
        const phrase = relWeek[1] as 'last'|'this'|'next';
        const { start, end } = this.rangeForRelativeWeek(phrase, new Date());
        return this.resultWeek(start, end, this.prettyLabelForWeek(start, end, phrase));
      }
    }

    // 2) "week of <date>" ----------------------------------------------------
    // e.g., "week of Sep 27", "week of 2025-05-12"
    const weekOf = q.match(/week\s+of\s+(.+)/);
    if (weekOf) {
      const ref = this.safeParseDate(weekOf[1]);
      if (ref) {
        const { start, end } = this.weekBounds(ref);
        return this.resultWeek(start, end, this.prettyLabelForWeek(start, end, 'week of'));
      }
    }

    // 3) Explicit day / range via chrono ------------------------------------
    // Supports: "May 12", "May 12–18", "next 2 weeks" (handled above),
    // "June", "June–July"
    const parsed = chrono.parse(q, new Date(), { forwardDate: false });
    if (parsed?.length) {
      const p = parsed[0];
      const start = p.start?.date();
      const end = p.end?.date();

      // month(s)
      if (this.looksLikeMonthQuery(q)) {
        const months = this.extractMonthsFromChrono(parsed);
        const label = this.labelForMonths(months);
        return { window: 'month', months, label };
      }

      // day or range
      if (start && end) {
        // If range is 7 days-ish, treat as week
        const days = Math.round((+end - +start) / 86400000) + 1;
        if (days >= 6 && days <= 9) {
          const { start: ws, end: we } = this.weekBounds(start);
          return this.resultWeek(ws, we, this.prettyLabelForWeek(ws, we, 'range'));
        }
        const label = days > 1
          ? `${start.toDateString()} – ${end.toDateString()}`
          : start.toDateString();
        return { window: 'day', months: [start.getMonth()+1], start, end, label };
      }

      if (start) {
        // single day
        const label = start.toDateString();
        return { window: 'day', months: [start.getMonth()+1], start, end: start, label };
      }
    }

    // 4) Fallback: maybe they typed just a month name
    const tryMonths = this.extractMonthsByRegex(q);
    if (tryMonths.length) {
      const label = this.labelForMonths(tryMonths);
      return { window: 'month', months: tryMonths, label };
    }

    return null;
  }

  // ---------------- helpers ----------------

  private weekBounds(d: Date) {
    const dt = new Date(d); dt.setHours(0,0,0,0);
    const day = dt.getDay(); // 0 Sun..6 Sat
    const diff = this.weekStartsOn === 1
      ? (day === 0 ? -6 : 1 - day)     // Monday start
      : -day;                           // Sunday start
    const start = new Date(dt);
    start.setDate(dt.getDate() + diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }

  private rangeForRelativeWeek(kind: 'last'|'this'|'next', now: Date) {
    const { start } = this.weekBounds(now);
    const s = new Date(start);
    if (kind === 'last') s.setDate(s.getDate() - 7);
    if (kind === 'next') s.setDate(s.getDate() + 7);
    const e = new Date(s); e.setDate(s.getDate() + 6);
    return { start: s, end: e };
  }

  private rangeForLastNWeeks(n: number, now: Date) {
    // n=1 ⇒ last week; n=2 ⇒ last two weeks (contiguous block ending yesterday-week)
    const { start: thisW } = this.weekBounds(now);
    const end = new Date(thisW); end.setDate(end.getDate() - 1); // end is last week's Sunday
    const start = new Date(end); start.setDate(end.getDate() - (n*7 - 1));
    // Snap to week boundaries for clean labels
    const b = this.weekBounds(end);
    return { start: this.weekBounds(start).start, end: b.end };
  }

  private prettyLabelForWeek(start: Date, end: Date, suffix: string) {
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const year = start.getFullYear() === end.getFullYear() ? start.getFullYear() : `${start.getFullYear()}–${end.getFullYear()}`;
    return `${fmt(start)}–${fmt(end)}, ${year}`;
  }

  private resultWeek(start: Date, end: Date, label: string): IntentResult {
    // keep months filled so your existing UI shows month tags if needed
    const uniqMonths = new Set<number>();
    const cur = new Date(start);
    while (cur <= end) { uniqMonths.add(cur.getMonth()+1); cur.setDate(cur.getDate()+1); }
    return { window: 'week', months: [...uniqMonths], start, end, label };
  }

  private looksLikeMonthQuery(q: string) {
    return /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/i.test(q);
  }

  private extractMonthsFromChrono(parsed: chrono.ParsedResult[]) {
    const months = new Set<number>();
    parsed.forEach(p => {
      if (p.start) months.add((p.start.get('month') ?? (p.start.date().getMonth()+1)));
      if (p.end) months.add((p.end.get('month') ?? (p.end.date().getMonth()+1)));
    });
    return [...months].sort((a,b)=>a-b);
  }

  private extractMonthsByRegex(q: string) {
    const map: Record<string, number> = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12 };
    const found = new Set<number>();
    Object.keys(map).forEach(k => { if (q.includes(k)) found.add(map[k]); });
    return [...found].sort((a,b)=>a-b);
  }

  private labelForMonths(months: number[]): string {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (months.length === 0) return '';
    if (months.length === 1) return monthNames[months[0] - 1];
    
    // For multiple months, show range or list
    if (months.length === 2 && months[1] === months[0] + 1) {
      return `${monthNames[months[0] - 1]}–${monthNames[months[1] - 1]}`;
    }
    
    // For non-consecutive months or more than 2, show as list
    return months.map(m => monthNames[m - 1]).join(', ');
  }

  private safeParseDate(fragment: string): Date | null {
    const r = chrono.parse(fragment, new Date(), { forwardDate: true });
    if (r?.length && r[0].start) return r[0].start.date();
    return null;
  }
}
