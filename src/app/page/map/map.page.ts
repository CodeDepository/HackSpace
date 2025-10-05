import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Injectable } from '@angular/core';
import { DemoDataService, ProbOutput } from '../../services/demodata.service';
import { PowerService } from '../../services/power.service';
import { ClimoService } from '../../services/climo.service';
import { ChatBoxComponent } from '../../components/chat-box/chat-box.component';
import { IntentParserService } from '../../services/intent-parser.service';
import { CalendarService } from '../../services/calendar.service';
import { WildfireService } from '../../services/wildfire.service';

import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonInput, IonDatetime, IonDatetimeButton, IonModal, IonIcon,
  IonChip, IonAccordionGroup, IonAccordion, IonItem, IonLabel
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChatBoxComponent,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonInput, IonDatetime, IonDatetimeButton, IonModal, IonIcon,
    IonChip, IonAccordionGroup, IonAccordion, IonItem, IonLabel
  ],
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss']
})
export class MapPage implements AfterViewInit, OnDestroy {
  // --- Leaflet marker icon
  myIcon = L.icon({
    iconUrl: 'assets/pin.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28]
  });

  // --- Simple chat history for your ChatBox
  chat: { role: 'user' | 'bot'; text: string }[] = [
    { role: 'bot', text: 'Tell me a time like "week of May 12", "June–July", or "next 2 weeks".' }
  ];

  // --- State
  map!: L.Map;
  marker?: L.Marker;
  persona: 'farmer' | 'construction' = 'construction';
  window: 'day' | 'week' | 'month' = 'month';
  months: number[] = [5, 6];
  monthOptions = [
    { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
    { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
    { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' }
  ];
  prob?: ProbOutput;
  loading = false;
  uiState: 'landing' | 'results' = 'landing';
  searchDraft = '';
  lastLabel = '';
  comfort?: { tAvg: number; wAvg: number; tLabel: string; wLabel: string };
  intentRange?: { start: Date; end: Date; title?: string; location?: string };
  
  // toggles
  firesRecentOn = true;      // last 7 days (CWFIS)
  firesHistoricOn = true;    // CNFDB perimeters
  useFIRMS = false;          // flip true if you want FIRMS
  private cwfisLayer?: L.TileLayer.WMS;
  private cnfdbLayer?: L.TileLayer.WMS;
  private firmsLayer?: L.TileLayer.WMS;

  // for FIRMS time selection
  firmsStart?: string; // '2025-06-01'
  firmsEnd?: string;   // '2025-06-30'

  constructor(
    private demo: DemoDataService,
    private power: PowerService,
    private climo: ClimoService,
    private intent: IntentParserService,
    private wildfire: WildfireService,
    private cal: CalendarService
  ) {}

  //NEW
  //NEW END




  // -------------------- Map lifecycle --------------------
  ngAfterViewInit() {
    // Init map
    this.map = L.map('map', { attributionControl: true, zoomControl: false })
      .setView([54, -96], 4); // Canada-ish

    // Colorful basemap (Carto Voyager)
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        maxZoom: 19,
        detectRetina: true,
        attribution: '&copy; OpenStreetMap, &copy; CARTO'
      }
    ).addTo(this.map);

    // Subtle hillshade overlay (adds relief)
    L.tileLayer('https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png', {
      opacity: 0.25,
      attribution: 'Hillshade &copy; Wikimedia/OpenTopo'
    }).addTo(this.map);

    // Controls
    L.control.zoom({ position: 'topright' }).addTo(this.map);
    setTimeout(() => this.map.invalidateSize(), 0);

    // Click to add/move marker + compute
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.addOrMoveMarker(e.latlng);
      if (this.uiState === 'results' && this.months?.length) {
        this.computePower(e.latlng.lat, e.latlng.lng);
      }
    });
    // Default: Canada 7-day hotspots + historic perimeters
    this.cwfisLayer = this.wildfire.addCWFISHotspots7d(this.map);
    this.cnfdbLayer = this.wildfire.addCNFDBPerimeters(this.map);

    // Optional: FIRMS (global) if you have MAP_KEY
    // this.firmsLayer = this.wildfire.addFIRMS(this.map, '<YOUR_MAP_KEY>');
  }

  toggleRecent() {
    this.firesRecentOn = !this.firesRecentOn;
    this.wildfire.toggle(this.cwfisLayer, this.map, this.firesRecentOn);
  }

  toggleHistoric() {
    this.firesHistoricOn = !this.firesHistoricOn;
    this.wildfire.toggle(this.cnfdbLayer, this.map, this.firesHistoricOn);
  }

  applyFirmsWindow() {
    if (!this.firmsLayer || !this.firmsStart || !this.firmsEnd) return;
    this.wildfire.setFirmsTimeRange(this.firmsStart, this.firmsEnd);
  }

  // hook ionChange from an IonDatetime (date-range) used for FIRMS
  onFirmsDatePicked(ev: CustomEvent) {
    const v: any = ev.detail?.value;
    if (!v) return;
    const startISO = v.start?.slice(0, 10) || v.slice(0,10);
    const endISO   = v.end?.slice(0, 10)   || v.slice(0,10);
    this.firmsStart = startISO; this.firmsEnd = endISO;
    this.applyFirmsWindow();
  }

  ionViewDidEnter() {
    // ensure Leaflet sizes correctly after view transitions
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnDestroy() {
    if (this.map) this.map.remove();
  }

  // -------------------- Chat + search --------------------
  onChat(text: string) {
    this.chat.push({ role: 'user', text });
    const parsed = this.intent.parse(text);
    if (!parsed) {
      this.chat.push({
        role: 'bot',
        text: 'Sorry, I couldn’t read that. Try: "week of 2025-06-10", "Jun–Sep", or "next 2 weeks".'
      });
      return;
    }

    this.applyParsedIntent(parsed);

    if (!this.marker) {
      this.chat.push({ role: 'bot', text: `Got it (${this.lastLabel}). Now tap the map to choose a location.` });
      return;
    }

    const p = this.marker.getLatLng();
    this.chat.push({
      role: 'bot',
      text: `Analyzing ${this.lastLabel} at (${p.lat.toFixed(3)}, ${p.lng.toFixed(3)})…`
    });
    this.computePower(p.lat, p.lng);
  }

  submitSearch() {
    const parsed = this.intent.parse(this.searchDraft);
    if (!parsed) {
      this.lastLabel = '';
      this.toast('Try: "week of 2025-06-10", "June–July", "next 2 weeks"');
      return;
    }
    this.applyParsedIntent(parsed);
    if (this.marker) {
      const p = this.marker.getLatLng();
      this.computePower(p.lat, p.lng);
    } else {
      this.toast('Now tap the map to choose a location');
    }
  }

  private applyParsedIntent(parsed: any) {
    this.window = parsed.window;
    this.months = parsed.months;
    this.lastLabel = parsed.label || 'selected time';
    this.uiState = 'results';

    if (parsed.start && parsed.end) {
      this.intentRange = {
        start: new Date(parsed.start),
        end: new Date(parsed.end),
        title: `Plan for ${this.lastLabel}`,
        location: this.marker
          ? `${this.marker.getLatLng().lat.toFixed(3)}, ${this.marker.getLatLng().lng.toFixed(3)}`
          : ''
      };
    } else if (parsed.window === 'month' && this.months?.length) {
      const yr = new Date().getFullYear();
      const minM = Math.min(...this.months), maxM = Math.max(...this.months);
      const start = new Date(Date.UTC(yr, minM - 1, 1, 0, 0, 0));
      const end = new Date(Date.UTC(yr, maxM, 0, 23, 59, 59));
      this.intentRange = {
        start, end,
        title: `Plan for ${this.lastLabel}`,
        location: this.marker
          ? `${this.marker.getLatLng().lat.toFixed(3)}, ${this.marker.getLatLng().lng.toFixed(3)}`
          : ''
      };
    } else {
      this.intentRange = undefined;
    }
  }

  // -------------------- Map interactions --------------------
  private addOrMoveMarker(latlng: L.LatLng) {
    if (!this.marker) {
      this.marker = L.marker(latlng, { draggable: true, icon: this.myIcon }).addTo(this.map);
      this.marker.on('dragend', () => {
        const p = this.marker!.getLatLng();
        if (this.intentRange) {
          this.intentRange.location = `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`;
        }
        this.computePower(p.lat, p.lng);
      });
    } else {
      this.marker.setLatLng(latlng);
    }
    if (this.intentRange) {
      this.intentRange.location = `${latlng.lat.toFixed(3)}, ${latlng.lng.toFixed(3)}`;
    }
  }

  // -------------------- POWER / Climo --------------------
  async computePower(lat: number, lon: number) {
    this.loading = true;
    this.prob = undefined;
    this.comfort = undefined;
    try {
      const now = new Date();
      const endYear = now.getUTCFullYear() - 1;
      const startYear = endYear - 9;
      const daily = await this.power.getDaily(lat, lon, `${startYear}0101`, `${endYear}1231`);

      const stats = this.climo.compute(this.months, daily);
      const comfort = this.climo.summarizeComfort(this.months, daily);
      this.comfort = comfort;

      this.prob = {
        wetPct: stats.wetPct,
        snowPct: stats.snowPct,
        notes: [
          ...stats.notes,
          `Avg temp: ${comfort.tAvg}°C (${comfort.tLabel})`,
          `Avg wind: ${comfort.wAvg} m/s (${comfort.wLabel})`
        ]
      } as ProbOutput;

      const html = `<div style="min-width:180px">
        <b>Wet:</b> ${this.prob.wetPct}%<br/>
        <b>Snow:</b> ${this.prob.snowPct}%<br/>
        <b>Temp:</b> ${comfort.tAvg}°C (${comfort.tLabel})<br/>
        <b>Wind:</b> ${comfort.wAvg} m/s (${comfort.wLabel})
      </div>`;
      this.marker?.bindPopup(html, { closeButton: false }).openPopup();

    } catch (err) {
      console.warn('POWER failed, using demo data', err);
      this.prob = this.demo.getProbability({ lat, lon, months: this.months, window: this.window });
    } finally {
      this.loading = false;
    }
  }

  // -------------------- Calendar picker (IonDatetime) --------------------
  onDatePicked(ev: CustomEvent) {
    const v = (ev.detail as any)?.value;
    if (!v) return;

    // IonDatetime returns ISO (string) or {start,end}
    let startISO = '', endISO = '';
    if (typeof v === 'string') {
      startISO = v; endISO = v;
    } else if (v.start && v.end) {
      startISO = v.start; endISO = v.end;
    }

    const start = new Date(startISO);
    const end = new Date(endISO);

    const sameDay = start.toDateString() === end.toDateString();
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    this.lastLabel = sameDay ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;

    // Sync to existing intent + calendar fields
    this.window = sameDay ? 'day' : 'week';
    this.months = this.extractMonthsFromSpan(start, end);
    this.intentRange = {
      start: new Date(start),
      end: new Date(end.getTime() + (sameDay ? 60 * 60 * 1000 : 0)), // +1h if single day
      title: `Plan for ${this.lastLabel}`,
      location: this.marker
        ? `${this.marker.getLatLng().lat.toFixed(3)}, ${this.marker.getLatLng().lng.toFixed(3)}`
        : ''
    };
    this.uiState = 'results';

    if (this.marker) {
      const p = this.marker.getLatLng();
      this.computePower(p.lat, p.lng);
    } else {
      this.toast('Now tap the map to choose a location');
    }
  }

  // -------------------- Calendar actions --------------------
  addToCalendar() {
    if (!this.intentRange) return;
    const { start } = this.intentRange;
    const end = this.intentRange.end && +this.intentRange.end > +start
      ? this.intentRange.end
      : new Date(+start + 60 * 60 * 1000);
    const title = this.intentRange.title ||
      `Plan: ${this.persona === 'farmer' ? 'Field work' : 'Outdoor work'}`;
    const desc =
      `Wet-day chance: ${this.prob?.wetPct ?? '—'}%, Snow: ${this.prob?.snowPct ?? '—'}%. (NASA POWER climatology)`;

    this.cal.downloadIcs({
      title, start, end,
      location: this.intentRange.location || '',
      description: desc
    }, 'rain-parade.ics');
  }

  openGoogleCalendar() {
    if (!this.intentRange) return;
    const { start } = this.intentRange;
    const end = this.intentRange.end && +this.intentRange.end > +start
      ? this.intentRange.end
      : new Date(+start + 60 * 60 * 1000);
    const title = this.intentRange.title || 'Plan';
    const url = this.cal.gcalUrl({
      title, start, end,
      description: `Wet: ${this.prob?.wetPct ?? '—'}%, Snow: ${this.prob?.snowPct ?? '—'}% — NASA POWER`,
      location: this.intentRange.location || ''
    });
    window.open(url, '_blank');
  }

  // -------------------- Helpers --------------------
  resetAll() {
    this.searchDraft = '';
    this.lastLabel = '';
    this.uiState = 'landing';
  }

  private extractMonthsFromSpan(start: Date, end: Date): number[] {
    const months = new Set<number>();
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    while (current <= end) {
      months.add(current.getMonth() + 1);
      current.setDate(current.getDate() + 1);
    }
    return Array.from(months).sort((a, b) => a - b);
  }

  private toast(msg: string) {
    // Replace with Ionic ToastController if desired
    console.log(msg);
  }
}
