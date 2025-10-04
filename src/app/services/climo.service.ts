import { Injectable } from '@angular/core';
import { PowerDailyPoint } from './power.service';

export interface WetStats {
  wetPct:number; snowPct:number; daysWet:number; daysTotal:number; notes:string[];
}

@Injectable({ providedIn: 'root' })
export class ClimoService {

    private mean(nums: number[]): number {
        return nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : 0;
    }
    private tempLabel(c: number): string {
        if (c <= 0) return 'freezing';
        if (c <= 10) return 'cold';
        if (c <= 18) return 'cool';
        if (c <= 26) return 'mild';
        if (c <= 32) return 'warm';
        return 'hot';
    }

    private windLabel(ms: number): string {
        if (ms < 2) return 'calm';
        if (ms < 5) return 'light breeze';
        if (ms < 8) return 'slightly windy';
        if (ms < 13) return 'windy';
        return 'stormy';
    }

  /** Wet day: precip > 1 mm. Snow proxy: wet day with T2M < 0 °C. */
  compute(months:number[], data:PowerDailyPoint): WetStats {
    const p = data.properties.parameter;
    const precip = p['PRECTOTCORR'] || {};
    const t2m    = p['T2M'] || {};
    let daysTotal = 0, daysWet = 0, daysSnowWet = 0;
    

    for (const date of Object.keys(precip)) {
      const m = Number(date.substring(4,6));      // YYYYMMDD
      if (!months.includes(m)) continue;
      const pr = Number(precip[date]);
      const t  = Number(t2m[date] ?? 99);
      daysTotal++;
      if (pr > 1) {
        daysWet++;
        if (t < 0) daysSnowWet++;
      }
    }

    const wetPct  = daysTotal ? Math.round((daysWet/daysTotal)*100) : 0;
    const snowPct = daysWet   ? Math.round((daysSnowWet/daysWet)*100) : 0;

    return {
      wetPct, snowPct, daysWet, daysTotal,
      notes: [
        `Wet day = precip > 1 mm`,
        `Sample: ${daysTotal} days across selected months (last 10y complete)`
      ]
    };
    }

    summarizeComfort(months: number[], data: PowerDailyPoint) {
        const p = data.properties.parameter;
        const t2m = p['T2M'] || {};
        const ws  = p['WS10M'] || {};

        const temps: number[] = [];
        const winds: number[] = [];

        for (const date of Object.keys(t2m)) {
            const m = Number(date.substring(4,6));
            if (!months.includes(m)) continue;
            const t = Number(t2m[date]);
            const w = Number(ws[date] ?? NaN);
            if (!Number.isNaN(t)) temps.push(t);
            if (!Number.isNaN(w)) winds.push(w);
        }

        const tAvg = Math.round(this.mean(temps)*10)/10; // 1 decimal
        const wAvg = Math.round(this.mean(winds)*10)/10;

        return {
            tAvg, wAvg,
            tLabel: this.tempLabel(tAvg),
            wLabel: this.windLabel(wAvg)
        };
    }
}
