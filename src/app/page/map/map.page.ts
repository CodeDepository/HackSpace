import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonAccordionGroup} from '@ionic/angular';
import { DemoDataService, ProbOutput } from '../../services/demodata.service';
import { PowerService } from '../../services/power.service';
import { ClimoService } from '../../services/climo.service';
import { ChatBoxComponent } from '../../components/chat-box/chat-box.component';
import { IntentParserService } from '../../services/intent-parser.service';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ChatBoxComponent],
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss']
})

export class MapPage implements AfterViewInit, OnDestroy {
  myIcon = L.icon({
    iconUrl: 'assets/pin.png',
    iconSize: [32, 32],       // adjust to your PNG
    iconAnchor: [16, 32],     // bottom center at the point
    popupAnchor: [0, -28]
  });
  chat: {role:'user'|'bot', text:string}[] = [
    { role:'bot', text:'Tell me a time like "week of May 12", "June–July", "next 2 weeks".' }
  ];
  map!: L.Map;
  marker?: L.Marker;
  persona: 'farmer'|'construction' = 'construction';
  window: 'day'|'week'|'month' = 'month';
  months: number[] = [5,6];
  monthOptions = [
    { value:1, label:'Jan'},{value:2,label:'Feb'},{value:3,label:'Mar'},{value:4,label:'Apr'},
    { value:5, label:'May'},{value:6,label:'Jun'},{value:7,label:'Jul'},{value:8,label:'Aug'},
    { value:9, label:'Sep'},{value:10,label:'Oct'},{value:11,label:'Nov'},{value:12,label:'Dec'},
  ];
  prob?: ProbOutput;
  loading = false;
  uiState: 'landing' | 'results' = 'landing';
  searchDraft = '';
  lastLabel = '';
  comfort?: { tAvg:number; wAvg:number; tLabel:string; wLabel:string };
  

  constructor(
    private demo: DemoDataService,
    private power: PowerService,
    private climo: ClimoService,
    private intent: IntentParserService,
  ) {}

  onChat(text: string){
  this.chat.push({ role:'user', text });
    const parsed = this.intent.parse(text);
    if (!parsed) {
      this.chat.push({ role:'bot', text: 'Sorry, I couldn’t read that. Try: "week of 2025-06-10", "Jun–Sep", "next 2 weeks", "Q3".' });
      return;
    }
    this.window = parsed.window;
    this.months = parsed.months;
    const label = parsed.label || 'selected time';
    if (!this.marker) {
      this.chat.push({ role:'bot', text: `Got it (${label}). Now tap the map to choose a location.` });
      return;
    }
    const p = this.marker.getLatLng();
    this.chat.push({ role:'bot', text: `Analyzing ${label} at (${p.lat.toFixed(3)}, ${p.lng.toFixed(3)})…` });
    this.computePower(p.lat, p.lng);
  }
  ngAfterViewInit() {

    this.map = L.map('map', { attributionControl: true, zoomControl: false })
      .setView([43.6532, -79.3832], 9);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      detectRetina: true,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Click to analyze this point
     this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.addOrMoveMarker(e.latlng);
      if (this.uiState === 'results' && this.months?.length) {
        this.computePower(e.latlng.lat, e.latlng.lng);
      }
    });
  }
  submitSearch() {
    const parsed = this.intent.parse(this.searchDraft);
    if (!parsed) {
      this.lastLabel = '';
      this.toast('Try: "week of 2025-06-10", "June–July", "next 2 weeks"');
      return;
    }
    this.window = parsed.window;
    this.months = parsed.months;
    this.lastLabel = parsed.label;
    // If we already have a marker, compute; otherwise prompt to tap map
    if (this.marker) {
      const p = this.marker.getLatLng();
      this.computePower(p.lat, p.lng);
      this.uiState = 'results';
    } else {
      this.toast('Now tap the map to choose a location');
      this.uiState = 'results';
    }
  }

  private addOrMoveMarker(latlng: L.LatLng) {
    if (!this.marker) {
      this.marker = L.marker(latlng, { draggable: true,icon: this.myIcon }).addTo(this.map);
      this.marker.on('dragend', () => {
        const p = this.marker!.getLatLng();
        this.computePower(p.lat, p.lng);
      });
    } else {
      this.marker.setLatLng(latlng);
    }
  }

  
  async computePower(lat:number, lon:number) {
    this.loading = true; this.prob = undefined; this.comfort = undefined;
    try {
      const now = new Date();
      const endYear = now.getUTCFullYear() - 1;
      const startYear = endYear - 9;
      const daily = await this.power.getDaily(lat, lon, `${startYear}0101`, `${endYear}1231`);

      const stats = this.climo.compute(this.months, daily);
      const comfort = this.climo.summarizeComfort(this.months, daily);
      this.comfort = comfort;

      this.prob = { wetPct: stats.wetPct, snowPct: stats.snowPct, notes: [
        ...stats.notes,
        `Avg temp: ${comfort.tAvg}°C (${comfort.tLabel})`,
        `Avg wind: ${comfort.wAvg} m/s (${comfort.wLabel})`
      ] } as ProbOutput;

      // compact popup on marker
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
      this.comfort = undefined; // demo data might not include comfort
    } finally {
      this.loading = false;
    }
  }

  resetAll() {
    this.searchDraft = '';
    this.lastLabel = '';
    this.uiState = 'landing';
  }

  private toast(msg: string) {
    // super light inline toast (replace with Ionic ToastController if you want)
    console.log(msg);
  }

  ionViewDidEnter() { setTimeout(() => this.map?.invalidateSize(), 0); }
  ngOnDestroy() { if (this.map) this.map.remove(); }
}
