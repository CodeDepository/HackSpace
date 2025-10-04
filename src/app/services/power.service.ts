import { Injectable } from '@angular/core';

export interface PowerDailyPoint {
  properties: { parameter: Record<string, Record<string, number>> };
}

@Injectable({ providedIn: 'root' })
export class PowerService {
  private base = 'https://power.larc.nasa.gov/api/temporal/daily/point';

  /**
   * Fetch daily precipitation (mm/day) and air temperature (°C) for a date range.
   * Dates: YYYYMMDD (UTC). We’ll compute wet/snow stats client-side.
   */
  async getDaily(lat:number, lon:number, start:string, end:string): Promise<PowerDailyPoint> {
    const params = new URLSearchParams({
      parameters: 'PRECTOTCORR,T2M,T2M_MIN,T2M_MAX,WS10M',
      community: 'ag',
      latitude: String(lat),
      longitude: String(lon),
      start,
      end,
      format: 'JSON'
    });
    const res = await fetch(`${this.base}?${params.toString()}`);
    if (!res.ok) throw new Error(`POWER error ${res.status}`);
    return res.json();
  }
}
