import { Component } from '@angular/core';
import {
  IonContent, IonButton, IonIcon
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { DotGridComponent } from 'src/app/components/dot-grid/dot-grid.component';

@Component({
  selector: 'app-intro',
  standalone: true,
  imports: [IonContent, IonButton, IonIcon, DotGridComponent],
  template: `
<ion-content [fullscreen]="true" class="intro-content">
  <!-- Animated background -->
  <div class="hero-bg">
    <app-dot-grid
      [dotSize]="10"
      [gap]="16"
      baseColor="#5227FF"
      activeColor="#5227FF"
      [proximity]="140"
      [shockRadius]="260"
      [shockStrength]="5"
      [resistance]="750"
      [returnDuration]="1.4">
    </app-dot-grid>
  </div>

  <!-- Foreground glass section -->
  <div class="hero-fore">
    <div class="glass-box">
      <div class="brand">NASA SPACE APPS</div>
      <h1 class="title">DRY SOCKS</h1>
      <p class="subtitle">
        Will It Rain On My Parade ?
      </p>

      <div class="cta-row">
        <ion-button size="large" (click)="go()" class="cta">Enter app</ion-button>
      </div>

      <div class="foot">
        <span class="chip">Built with NASA POWER</span>
        <span class="chip">FIRMS / CWFIS wildfire overlays</span>
      </div>
    </div>
  </div>
</ion-content>
`,

  styles: [`
:host { display:block; }

/* Light background gradient */
.intro-content {
  --background: linear-gradient(180deg,#eef6ff 0%, #f7fbff 60%, #ffffff 100%);
  position: relative;
  color: #0f172a;
  font-family: 'Inter', system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
}

/* Background animation layer */
.hero-bg { position:absolute; inset:0; z-index:0; overflow:hidden; }
:host ::ng-deep .dot-grid__canvas { filter: brightness(1.1) saturate(1.1) opacity(.7); }

/* Foreground text container with glass effect */
.hero-fore {
  position:absolute; inset:0; z-index:1;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding: clamp(20px, 4vw, 40px);
  text-align:center;
}

/* Frosted glass panel */
.glass-box {
  background: rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 24px;
  border: 29px solid rgba(255,255,255,0.7);
  padding: clamp(24px, 3vw, 48px);
  box-shadow: 0 16px 40px rgba(15,23,42,.1);
  max-width: 950px;
}

/* Branding */
.brand {
  color:#2563eb;
  font-weight:700;
  letter-spacing:.2em;
  margin-bottom: 14px;
  font-size: .95rem;
}

/* Title */
.title {
  margin:0;
  font-size: clamp(48px, 9vw, 100px);
  font-weight: 900;
  line-height: .92;
  color: #0f172a;
  text-shadow: 0 3px 12px rgba(37,99,235,.15);
}

/* Subtitle */
.subtitle {
  margin: 18px auto 28px;
  max-width: 780px;
  font-size: clamp(18px, 2.1vw, 22px);
  line-height: 1.5;
  color:#1e293b;
}

/* CTA */
.cta {
  --background: #5227FF; /* vivid blue */
  --border-radius: 9999px;
  --padding-start: 24px;
  --padding-end: 24px;
  --color: #fff;
  font-weight: 700;
  letter-spacing: 0.5px;
  box-shadow: 0 0 0 rgba(0, 0, 0, 0); /* remove white glow */
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0); /* subtle glow only on hover */
}

/* Footer chips */
.foot { margin-top: 30px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
.chip {
  color:#0f172a;
  background: rgba(255,255,255,0.8);
  border:1px solid rgba(0,0,0,0.1);
  padding:8px 14px;
  border-radius:999px;
  font-size:.9rem;
  box-shadow: 0 4px 12px rgba(0,0,0,.05);
}

/* Mobile */
@media (max-width: 480px) {
  .glass-box { padding: 24px 16px; }
  .title { font-size: 2.2rem; }
  .subtitle { font-size: 1rem; }
}
`]


})
export class IntroPage {
  constructor(private router: Router) {}
  go(path: 'map' | '' = '') {
    this.router.navigateByUrl(path || '/map', { replaceUrl: true });
  }
}
