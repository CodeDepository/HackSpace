import { Injectable } from '@angular/core';
import * as chrono from 'chrono-node';

export type TimeWindow = 'day'|'week'|'month';
export interface TimeIntent {
  window: TimeWindow;
  months: number[];         // 1..12
  day?: string;             // 'YYYYMMDD' when window === 'day'
  label: string;            // human-readable summary for UI
}

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

@Injectable({ providedIn: 'root' })
export class IntentParserService {

  parse(text: string, now = new Date()): TimeIntent | null {
    const q = text.trim().toLowerCase();

    // 1) Fast paths for relative phrases
    const rel = this.tryRelative(q, now);
    if (rel) return rel;

    // 2) Month ranges like "june-july", "jun–sep", "Q3"
    const mr = this.tryMonthRange(q);
    if (mr) return mr;

    // 3) "week of May 12", specific dates, "between May 12 and May 20"
    const dayOrWeek = this.tryChrono(q, now);
    if (dayOrWeek) return dayOrWeek;

    // 4) Single month like "June"
    const singleMonth = this.trySingleMonth(q);
    if (singleMonth) return singleMonth;

    return null;
  }

  // ----- helpers -----

  private tryRelative(q: string, now: Date): TimeIntent | null {
    // next/this week
    if (/\b(this|current)\s+week\b/.test(q)) {
      return this.weekFromDate(now, 'This week');
    }
    if (/\bnext\s+week\b/.test(q)) {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      return this.weekFromDate(d, 'Next week');
    }
    // today / tomorrow
    if (/\b(today)\b/.test(q)) return this.dayIntent(now, 'Today');
    if (/\b(tomorrow)\b/.test(q)) {
      const d = new Date(now); d.setDate(d.getDate()+1);
      return this.dayIntent(d, 'Tomorrow');
    }
    // "next 2 weeks", "next 3 months"
    const m = q.match(/\bnext\s+(\d{1,2})\s+(week|weeks|month|months)\b/);
    if (m) {
      const n = Number(m[1]);
      const unit = m[2].startsWith('week') ? 'week' : 'month';
      if (unit === 'week') {
        // treat as 'week' window starting now (we’ll compute with months that overlap)
        return { window: 'week', months: this.monthsForRange(now, n*7), label: `Next ${n} week(s)` };
      } else {
        return { window: 'month', months: this.monthsForRange(now, n*30), label: `Next ${n} month(s)` };
      }
    }
    // "this month" / "next month"
    if (/\b(this|current)\s+month\b/.test(q)) {
      const m1 = now.getMonth()+1;
      return { window: 'month', months: [m1], label: 'This month' };
    }
    if (/\bnext\s+month\b/.test(q)) {
      const m2 = ((now.getMonth()+1) % 12) + 1;
      return { window: 'month', months: [m2], label: 'Next month' };
    }
    // "this weekend" (Sat-Sun of this week → treat as 'day' but we’ll compute week-level)
    if (/\bthis\s+weekend\b/.test(q)) {
      const d = new Date(now);
      const day = d.getDay(); // 0 Sun..6 Sat
      const sat = new Date(d); sat.setDate(d.getDate() + ((6 - day + 7) % 7));
      return this.weekFromDate(sat, 'This weekend'); // using week window is simpler for stats
    }
    return null;
  }

  private tryMonthRange(q: string): TimeIntent | null {
    // Q1/Q2/Q3/Q4
    const qx = q.match(/\bq([1-4])\b/);
    if (qx) {
      const qn = Number(qx[1]);
      const ranges = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]};
      return { window: 'month', months: ranges[qn as 1|2|3|4], label: `Q${qn}` };
    }
    // "jun-sep", "june–july"
    const m = q.match(/\b([a-z]{3,})\s*[–-]\s*([a-z]{3,})\b/);
    if (m) {
      const a = this.monthNumber(m[1]); const b = this.monthNumber(m[2]);
      if (a && b) {
        const months = this.spanMonths(a, b);
        return { window: 'month', months, label: `${this.name(a)}–${this.name(b)}` };
      }
    }
    return null;
  }

  private trySingleMonth(q: string): TimeIntent | null {
    for (let i=0;i<12;i++) {
      const name = MONTHS[i];
      if (new RegExp(`\\b${name}`).test(q)) {
        return { window: 'month', months: [i+1], label: this.name(i+1) };
      }
    }
    return null;
  }

  private tryChrono(q: string, now: Date): TimeIntent | null {
    // week of <date> → week window
    if (/\bweek of\b/.test(q)) {
      const parsed = chrono.parse(q, now);
      if (parsed.length) {
        const d = parsed[0].start?.date();
        if (d) return this.weekFromDate(d, `Week of ${d.toDateString()}`);
      }
    }
    // explicit date or date range
    const results = chrono.parse(q, now);
    if (results.length) {
      const r = results[0];
      if (r.start && !r.end) {
        // single date → 'day'
        return this.dayIntent(r.start.date(), r.text);
      }
      if (r.start && r.end) {
        // date range → choose 'week' if ≤14d, else month(s)
        const start = r.start.date(), end = r.end.date();
        const ms = Math.max(1, Math.round((end.getTime()-start.getTime())/86400000));
        if (ms <= 14) {
          return { window: 'week', months: this.monthsForExplicitRange(start, end), label: r.text };
        } else {
          return { window: 'month', months: this.monthsForExplicitRange(start, end), label: r.text };
        }
      }
    }
    return null;
  }

  // ----- tiny utils -----
  private dayIntent(d: Date, label: string): TimeIntent {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth()+1).padStart(2,'0');
    const day = String(d.getUTCDate()).padStart(2,'0');
    return { window: 'day', months: [Number(m)], day: `${y}${m}${day}`, label };
  }

  private weekFromDate(d: Date, label: string): TimeIntent {
    return { window: 'week', months: this.monthsForRange(d, 7), label };
  }

  private monthsForRange(start: Date, days: number): number[] {
    const end = new Date(start); end.setDate(end.getDate()+days);
    return this.monthsForExplicitRange(start, end);
  }

  private monthsForExplicitRange(a: Date, b: Date): number[] {
    const out = new Set<number>();
    const s = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1));
    const e = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1));
    while (s <= e) {
      out.add(s.getUTCMonth()+1);
      s.setUTCMonth(s.getUTCMonth()+1);
    }
    return Array.from(out.values());
  }

  private monthNumber(tok: string): number | null {
    const i = MONTHS.findIndex(m => tok.startsWith(m));
    return i>=0 ? i+1 : null;
  }
  private spanMonths(a:number, b:number): number[] {
    const res: number[] = [];
    for (let m=a; ; m = m % 12 + 1) {
      res.push(m); if (m===b) break;
    }
    return res;
  }
  private name(n:number){ return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][n-1]; }
}
