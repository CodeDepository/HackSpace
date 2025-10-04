import { Injectable } from '@angular/core';


export type Persona = 'farmer' | 'construction';
export interface ProbInput { lat: number; lon: number; months: number[]; window: 'day'|'week'|'month'; }
export interface ProbOutput { wetPct: number; snowPct: number; notes: string[]; }


@Injectable({ providedIn: 'root' })
export class DemoDataService {
// Simple deterministic mock so demos are consistent
getProbability(input: ProbInput): ProbOutput {
const mAvg = input.months.reduce((a,b)=>a+b,0)/Math.max(1,input.months.length);
// Fake seasonality: wetter around month 4–6 & 9–11
const seasonal = [0, 25, 22, 28, 40, 42, 35, 30, 38, 45, 41, 30][Math.round(mAvg)%12];
const latFactor = Math.min(1, Math.abs(input.lat)/60); // higher lat → more snow chance
const wetPct = Math.max(5, Math.min(80, seasonal + (Math.sin(input.lon/30)*5)));
const snowPct = Math.max(0, Math.min(60, wetPct * latFactor * (mAvg<=3 || mAvg>=11 ? 0.8 : 0.2)));
const notes = [
`Estimate from mock climatology for months ${input.months.join(', ')}`,
`Window: ${input.window}.`,
];
return { wetPct: Math.round(wetPct), snowPct: Math.round(snowPct), notes };
}
}