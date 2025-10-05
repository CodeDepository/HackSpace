import {
  Component, ElementRef, ViewChild, Input,
  AfterViewInit, OnDestroy, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { gsap } from 'gsap';
import { InertiaPlugin } from 'gsap/InertiaPlugin';

gsap.registerPlugin(InertiaPlugin);

@Component({
  selector: 'app-dot-grid',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <section class="dot-grid" [ngStyle]="style">
    <div #wrap class="dot-grid__wrap">
      <canvas #canvas class="dot-grid__canvas"></canvas>
    </div>
  </section>
  `,
  styles: [`
  .dot-grid{
    display:flex; align-items:center; justify-content:center;
    width:100%; height:100%; position:relative;
  }
  .dot-grid__wrap{ width:100%; height:100%; position:relative; }
  .dot-grid__canvas{ position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
  `]
})
export class DotGridComponent implements AfterViewInit, OnDestroy {

  /* ===== Inputs (mirror your React props) ===== */
  @Input() dotSize = 16;
  @Input() gap = 32;
  @Input() baseColor = '#5227FF';
  @Input() activeColor = '#5227FF';
  @Input() proximity = 150;
  @Input() speedTrigger = 100;
  @Input() shockRadius = 250;
  @Input() shockStrength = 5;
  @Input() maxSpeed = 5000;
  @Input() resistance = 750;
  @Input() returnDuration = 1.5;
  @Input() style: any;

  @ViewChild('wrap',   { static: true }) wrapRef!: ElementRef<HTMLDivElement>;
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private dots: Array<{cx:number; cy:number; xOffset:number; yOffset:number; _inertiaApplied:boolean}> = [];
  private rafId: number | null = null;
  private resizeObs?: ResizeObserver;

  private pointer = { x:0, y:0, vx:0, vy:0, speed:0, lastTime:0, lastX:0, lastY:0 };
  private circlePath?: Path2D;
  private baseRGB = { r:82, g:39, b:255 };
  private activeRGB = { r:82, g:39, b:255 };

  ngAfterViewInit() {
    this.baseRGB = this.hexToRgb(this.baseColor);
    this.activeRGB = this.hexToRgb(this.activeColor);
    this.circlePath = new Path2D();
    this.circlePath.arc(0, 0, this.dotSize / 2, 0, Math.PI * 2);

    this.buildGrid();
    this.bindEvents();
    this.drawLoop();
  }

  ngOnDestroy() {
    this.unbindEvents();
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  /* ===== Core ===== */
  private buildGrid = () => {
    const wrap = this.wrapRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const rect = wrap.getBoundingClientRect();
    const { width, height } = rect;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cell = this.dotSize + this.gap;
    const cols = Math.max(1, Math.floor((width + this.gap) / cell));
    const rows = Math.max(1, Math.floor((height + this.gap) / cell));

    const gridW = cell * cols - this.gap;
    const gridH = cell * rows - this.gap;
    const startX = (width - gridW) / 2 + this.dotSize / 2;
    const startY = (height - gridH) / 2 + this.dotSize / 2;

    const dots = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cx = startX + x * cell;
        const cy = startY + y * cell;
        dots.push({ cx, cy, xOffset:0, yOffset:0, _inertiaApplied:false });
      }
    }
    this.dots = dots;
  };

  private drawLoop = () => {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const proxSq = this.proximity * this.proximity;
    const px = this.pointer.x;
    const py = this.pointer.y;

    for (const dot of this.dots) {
      const ox = dot.cx + dot.xOffset;
      const oy = dot.cy + dot.yOffset;
      const dx = dot.cx - px;
      const dy = dot.cy - py;
      const dsq = dx*dx + dy*dy;

      let style = this.baseColor;
      if (dsq <= proxSq) {
        const dist = Math.sqrt(dsq);
        const t = 1 - dist / this.proximity;
        const r = Math.round(this.baseRGB.r + (this.activeRGB.r - this.baseRGB.r) * t);
        const g = Math.round(this.baseRGB.g + (this.activeRGB.g - this.baseRGB.g) * t);
        const b = Math.round(this.baseRGB.b + (this.activeRGB.b - this.baseRGB.b) * t);
        style = `rgb(${r},${g},${b})`;
      }

      ctx.save();
      ctx.translate(ox, oy);
      ctx.fillStyle = style;
      if (this.circlePath) ctx.fill(this.circlePath);
      else {
        ctx.beginPath();
        ctx.arc(0,0, this.dotSize/2, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }

    this.rafId = requestAnimationFrame(this.drawLoop);
  };

  /* ===== Events ===== */
  private bindEvents() {
    const canvas = this.canvasRef.nativeElement;

    const throttledMove = this.throttle((e: MouseEvent) => {
      const now = performance.now();
      const dt = this.pointer.lastTime ? (now - this.pointer.lastTime) : 16;
      const dx = e.clientX - this.pointer.lastX;
      const dy = e.clientY - this.pointer.lastY;

      let vx = (dx / dt) * 1000;
      let vy = (dy / dt) * 1000;
      let speed = Math.hypot(vx, vy);
      if (speed > this.maxSpeed) {
        const s = this.maxSpeed / speed;
        vx *= s; vy *= s; speed = this.maxSpeed;
      }

      this.pointer.lastTime = now;
      this.pointer.lastX = e.clientX;
      this.pointer.lastY = e.clientY;
      this.pointer.vx = vx; this.pointer.vy = vy; this.pointer.speed = speed;

      const rect = canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - rect.left;
      this.pointer.y = e.clientY - rect.top;

      for (const dot of this.dots) {
        const dist = Math.hypot(dot.cx - this.pointer.x, dot.cy - this.pointer.y);
        if (speed > this.speedTrigger && dist < this.proximity && !dot._inertiaApplied) {
          dot._inertiaApplied = true;
          gsap.killTweensOf(dot);
          const pushX = dot.cx - this.pointer.x + vx * 0.005;
          const pushY = dot.cy - this.pointer.y + vy * 0.005;
          gsap.to(dot, {
            inertia: { xOffset: pushX, yOffset: pushY, resistance: this.resistance },
            onComplete: () => {
              gsap.to(dot, {
                xOffset: 0, yOffset: 0,
                duration: this.returnDuration, ease: 'elastic.out(1,0.75)'
              });
              dot._inertiaApplied = false;
            }
          });
        }
      }
    }, 50);

    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      for (const dot of this.dots) {
        const dist = Math.hypot(dot.cx - cx, dot.cy - cy);
        if (dist < this.shockRadius && !dot._inertiaApplied) {
          dot._inertiaApplied = true;
          gsap.killTweensOf(dot);
          const fall = Math.max(0, 1 - dist / this.shockRadius);
          const pushX = (dot.cx - cx) * this.shockStrength * fall;
          const pushY = (dot.cy - cy) * this.shockStrength * fall;
          gsap.to(dot, {
            inertia: { xOffset: pushX, yOffset: pushY, resistance: this.resistance },
            onComplete: () => {
              gsap.to(dot, {
                xOffset:0, yOffset:0,
                duration: this.returnDuration, ease: 'elastic.out(1,0.75)'
              });
              dot._inertiaApplied = false;
            }
          });
        }
      }
    };

    window.addEventListener('mousemove', throttledMove, { passive: true });
    window.addEventListener('click', onClick);

    // Resize
    const resizeHandler = () => this.buildGrid();
    if ('ResizeObserver' in window) {
      this.resizeObs = new ResizeObserver(() => this.buildGrid());
      this.resizeObs.observe(this.wrapRef.nativeElement);
    } else {
      (window as any).addEventListener('resize', resizeHandler);
    }

    // Store unbinders
    (this as any)._unbind = () => {
      window.removeEventListener('mousemove', throttledMove);
      window.removeEventListener('click', onClick);
      if (this.resizeObs) this.resizeObs.disconnect();
      else (window as any).removeEventListener('resize', resizeHandler);
    };
  }

  private unbindEvents() {
    (this as any)._unbind && (this as any)._unbind();
  }

  /* ===== Utils ===== */
  private throttle<T extends (...args:any[])=>void>(fn:T, limit=50):T {
    let last = 0;
    return function(this: any, ...args:any[]) {
      const now = performance.now();
      if (now - last >= limit) { last = now; fn.apply(this, args); }
    } as T;
  }

  private hexToRgb(hex:string){
    const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (!m) return { r:0, g:0, b:0 };
    return { r: parseInt(m[1],16), g: parseInt(m[2],16), b: parseInt(m[3],16) };
  }
}
