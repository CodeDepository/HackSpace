// import { Injectable } from '@angular/core';
// import * as L from 'leaflet';

// @Injectable({ providedIn: 'root' })
// export class WildfireService {
//   private cwfisLayer?: L.TileLayer.WMS;
//   private firmsLayer?: L.TileLayer.WMS;

//   /** CWFIS Hotspots last 24h (Canada, no API key) */
//   addCWFIS(map: L.Map) {
//     if (this.cwfisLayer) { map.addLayer(this.cwfisLayer); return this.cwfisLayer; }
//     this.cwfisLayer = L.tileLayer.wms(
//       'https://cwfis.cfs.nrcan.gc.ca/geoserver/public/wms',
//       {
//         layers: 'public:hotspots_last24hrs',
//         format: 'image/png',
//         transparent: true,
//         version: '1.1.1'
//       }
//     );
//     this.cwfisLayer.addTo(map);
//     return this.cwfisLayer;
//   }

//   /** NASA FIRMS VIIRS 375m hotspots via WMS (needs MAP_KEY) */
//   addFIRMS(map: L.Map, mapKey: string, region: 'Global'|'USA'|'Canada' = 'Global') {
//     if (this.firmsLayer) { map.addLayer(this.firmsLayer); return this.firmsLayer; }
//     // Base WMS endpoint per FIRMS doc
//     const base = 'https://firms.modaps.eosdis.nasa.gov/mapserver/wms';
//     // Layer names vary by product/region; VIIRS 375m global example:
//     // See FIRMS WMS-Time docs; you can also pass TIME=YYYY-MM-DD/thru for up to 31 days.
//     const layers = 'fires_viirs_375m'; // good default
//     this.firmsLayer = L.tileLayer.wms(`${base}/?MAP_KEY=${mapKey}`, {
//       layers, format: 'image/png', transparent: true, version: '1.3.0'
//       // You can also include a TIME param via .setParams({TIME:'2025-09-01/2025-09-30'})
//     });
//     this.firmsLayer.addTo(map);
//     return this.firmsLayer;
//   }

//   toggle(layer: L.Layer | undefined, map: L.Map, on: boolean) {
//     if (!layer) return;
//     if (on) map.addLayer(layer); else map.removeLayer(layer);
//   }
// }
import { Injectable } from '@angular/core';
import * as L from 'leaflet';

@Injectable({ providedIn: 'root' })
export class WildfireService {
  private cwfisHotspots?: L.TileLayer.WMS;
  private cnfdbPerims?: L.TileLayer.WMS;
  private firmsHotspots?: L.TileLayer.WMS;

  /** CWFIS hotspots: last 7 days (no key; Canada only) */
  addCWFISHotspots7d(map: L.Map) {
    if (!this.cwfisHotspots) {
      this.cwfisHotspots = L.tileLayer.wms(
        'https://cwfis.cfs.nrcan.gc.ca/geoserver/public/wms', {
          layers: 'public:hotspots_last7days',
          format: 'image/png', transparent: true, version: '1.1.1'
        }
      );
    }
    this.cwfisHotspots.addTo(map);
    return this.cwfisHotspots;
  }

  /** CNFDB historic fire perimeters (polygons, 1980–2020) */
  addCNFDBPerimeters(map: L.Map) {
    if (!this.cnfdbPerims) {
      // Layer name published in CWFIS Datamart metadata as a WMS service
      this.cnfdbPerims = L.tileLayer.wms(
        'https://cwfis.cfs.nrcan.gc.ca/geoserver/public/wms', {
          layers: 'public:NFDB_MRB_1980to2020', // if this 404s, try 'public:NFDB_MRB'
          format: 'image/png', transparent: true, version: '1.1.1'
        }
      );
    }
    this.cnfdbPerims.addTo(map);
    return this.cnfdbPerims;
  }

  /** FIRMS VIIRS 375 m hotspots with WMS-TIME (needs free MAP_KEY) */
  addFIRMS(map: L.Map, mapKey: string) {
    if (!this.firmsHotspots) {
      const base = `https://firms.modaps.eosdis.nasa.gov/mapserver/wms/?MAP_KEY=${mapKey}`;
      this.firmsHotspots = L.tileLayer.wms(base, {
        layers: 'fires_viirs_375m', // good default
        format: 'image/png', transparent: true, version: '1.3.0'
      });
    }
    this.firmsHotspots.addTo(map);
    return this.firmsHotspots;
  }

  /** Set FIRMS time window (max ~31 days per request) */
  setFirmsTimeRange(startISO: string, endISO: string) {
    if (!this.firmsHotspots) return;
    this.firmsHotspots.setParams({ TIME: `${startISO}/${endISO}` } as any);
  }

  toggle(layer: L.Layer | undefined, map: L.Map, on: boolean) {
    if (!layer) return;
    on ? map.addLayer(layer) : map.removeLayer(layer);
  }
}
