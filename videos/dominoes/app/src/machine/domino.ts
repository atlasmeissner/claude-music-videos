// Domino chains with a little real geometry: each domino tips about its leading bottom corner,
// accelerates until its top edge meets the next one, then rests against it and follows it down
// (the classic shingled aftermath). Timing is driven from outside: T[i] is the moment domino i is
// hit, so impacts can be put on sung syllables and beats.
import { type R } from '../engine/draw';
import { clamp, ease } from '../engine/util';

export interface Domino {
  /** centre of the base, world x */
  x: number;
  /** ground y (world, y down) */
  y: number;
  /** thickness (along the fall direction) */
  w: number;
  /** height */
  h: number;
  /** text printed along the domino (reads horizontally once it has fallen) */
  label?: string;
  /** pips: draw a centre line + dots like a real domino (when wide enough) */
  pips?: [number, number];
}

export interface ChainOpts {
  dir?: 1 | -1;
  /** fall duration of the last domino (seconds) */
  lastFall?: number;
  /** how long a domino stays orange after it has hit the next */
  glowAfter?: number;
  /** C[i]: when domino i reaches the next one (default T[i+1]); it then rests there until T[i+1] */
  contact?: (number | undefined)[];
}

const PI2 = Math.PI / 2;

export class Chain {
  d: Domino[];
  T: number[];
  dir: 1 | -1;
  lastFall: number;
  glowAfter: number;
  C: (number | undefined)[];
  private thC: number[];

  constructor(d: Domino[], T: number[], o: ChainOpts = {}) {
    this.d = d;
    this.T = T;
    this.dir = o.dir ?? 1;
    this.lastFall = o.lastFall ?? 0.45;
    this.glowAfter = o.glowAfter ?? 0.2;
    this.C = o.contact ?? [];
    if (T.length < d.length) throw new Error('Chain: need a hit time per domino');
    this.thC = d.map((_, i) => (i + 1 < d.length ? this.lean(i, 0) : PI2));
  }

  /** Angle of domino i resting against domino i+1 tilted by phi (both measured from vertical). */
  lean(i: number, phi: number): number {
    const a = this.d[i]!, b = this.d[i + 1]!;
    // work in a frame where the fall goes toward +X and Y is up; pivots at the leading corners
    const dir = this.dir;
    const Pi = { x: dir * a.x + a.w / 2, y: 0 };
    const Pj = { x: dir * b.x + b.w / 2, y: (a.y - b.y) }; // ground difference (y down -> up)
    const Bx = Pj.x - b.w * Math.cos(phi), By = Pj.y + b.w * Math.sin(phi);
    const fx = Math.sin(phi), fy = Math.cos(phi);
    const side = (th: number) => {
      const qx = Pi.x + a.h * Math.sin(th), qy = Pi.y + a.h * Math.cos(th);
      return fx * (qy - By) - fy * (qx - Bx);
    };
    if (side(PI2) > 0) return PI2; // never reaches: falls flat
    let lo = 0, hi = PI2;
    if (side(0) <= 0) return 0;
    for (let k = 0; k < 28; k++) {
      const m = (lo + hi) / 2;
      if (side(m) > 0) lo = m; else hi = m;
    }
    return lo;
  }

  /** Tilt of every domino at time t (radians from vertical, toward the fall direction). */
  angles(t: number): number[] {
    const n = this.d.length;
    const th = new Array<number>(n).fill(0);
    // last domino: accelerating fall to flat, with a small bounce
    const L = n - 1;
    if (t > this.T[L]!) {
      const u = (t - this.T[L]!) / this.lastFall;
      th[L] = u < 1 ? PI2 * u * u : PI2 - 0.06 * Math.exp(-(u - 1) * 7) * Math.abs(Math.sin((u - 1) * 12));
    }
    for (let i = n - 2; i >= 0; i--) {
      const T0 = this.T[i]!, T1 = this.T[i + 1]!;
      const C = this.C[i] ?? T1;
      if (t <= T0) th[i] = 0;
      else if (t < C) {
        const u = clamp((t - T0) / Math.max(1e-3, C - T0));
        th[i] = this.thC[i]! * u * u;
      } else if (t < T1) th[i] = this.thC[i]!;
      else th[i] = Math.max(this.thC[i]!, this.lean(i, th[i + 1]!));
    }
    return th;
  }

  /** 0..1: how "hot" domino i is (orange while it is the moving part). */
  heat(i: number, t: number) {
    const T0 = this.T[i]!, T1 = i + 1 < this.T.length ? this.T[i + 1]! : T0 + this.lastFall;
    if (t < T0) return 0;
    if (t < T1) return 1;
    return Math.max(0, 1 - (t - T1) / this.glowAfter);
  }

  /** Has the whole chain finished? */
  doneAt() {
    return this.T[this.d.length - 1]! + this.lastFall;
  }

  draw(r: R, t: number, o: DrawOpts = {}) {
    const th = this.angles(t);
    const n = this.d.length;
    const order = this.dir > 0 ? [...Array(n).keys()].reverse() : [...Array(n).keys()];
    for (const i of order) {
      const d = this.d[i]!;
      if (o.cull !== false && !r.visible(d.x - d.h - d.w, d.y - d.h - d.w, d.x + d.h + d.w, d.y + d.w, 10)) continue;
      drawDomino(r, d, th[i]!, this.dir, this.heat(i, t), t >= (this.T[i + 1] ?? this.T[i]! + this.lastFall) + this.glowAfter, o, i);
    }
  }
}

export interface DrawOpts {
  cull?: boolean;
  lw?: number;
  font?: (h: number) => string;
  /** colour override (css) */
  color?: (i: number, heat: number, spent: boolean) => string | undefined;
  fill?: boolean;
  /** alpha of spent dominoes' outline vs fg */
  spentRole?: 'dim' | 'mid' | 'fg';
  labelColor?: (i: number, heat: number, spent: boolean) => string | undefined;
}

export function drawDomino(r: R, d: Domino, theta: number, dir: 1 | -1, heat: number, spent: boolean, o: DrawOpts = {}, i = 0) {
  const g = r.g;
  const col = o.color?.(i, heat, spent) ?? (heat > 0.01 ? r.mix(spent ? (o.spentRole ?? 'dim') : 'fg', 'sig', heat) : r.c(spent ? (o.spentRole ?? 'dim') : 'fg'));
  const px = d.x + dir * d.w / 2;
  g.save();
  g.translate(px, d.y);
  g.rotate(dir * theta);
  const x0 = dir > 0 ? -d.w : 0;
  g.beginPath();
  g.rect(x0, -d.h, d.w, d.h);
  if (o.fill !== false) {
    g.fillStyle = r.c('panel');
    g.fill();
  }
  g.strokeStyle = col;
  g.lineWidth = r.px(o.lw ?? 1.4);
  g.stroke();
  const onScreenW = r.onScreen(d.w);
  if (d.pips && onScreenW > 10) {
    // a face-on domino: centre bar and pips
    const cx = x0 + d.w / 2;
    g.beginPath();
    g.moveTo(x0 + d.w * 0.15, -d.h / 2);
    g.lineTo(x0 + d.w * 0.85, -d.h / 2);
    g.lineWidth = r.px(1);
    g.stroke();
    const pip = (n: number, cy: number) => {
      const s = d.w * 0.22;
      const pts: [number, number][] = n === 1 ? [[0, 0]] : n === 2 ? [[-1, -1], [1, 1]] : n === 3 ? [[-1, -1], [0, 0], [1, 1]]
        : n === 4 ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : n === 5 ? [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]]
        : n === 6 ? [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] : [];
      g.fillStyle = col;
      for (const [a, b] of pts) {
        g.beginPath();
        g.arc(cx + a * s, cy + b * s, d.w * 0.07, 0, Math.PI * 2);
        g.fill();
      }
    };
    pip(d.pips[0], -d.h * 0.75);
    pip(d.pips[1], -d.h * 0.25);
  }
  if (d.label && onScreenW > 6) {
    const lc = o.labelColor?.(i, heat, spent) ?? col;
    g.save();
    g.translate(x0 + d.w / 2, -d.h / 2);
    g.rotate(-Math.PI / 2 * dir);
    const fs = d.w * 0.62;
    g.font = (o.font ?? ((h: number) => `700 ${h}px "Archivo-w875-700"`))(fs);
    g.fillStyle = lc;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(d.label, 0, fs * 0.04);
    g.restore();
  }
  g.restore();
}

/** Evenly spaced chain helper: n dominoes from x0 with spacing, hit times from a function. */
export function row(n: number, x0: number, y: number, spacing: number, w: number, h: number | ((i: number) => number)): Domino[] {
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * spacing, y, w, h: typeof h === 'number' ? h : h(i) }));
}

/** Uniform propagation: hit times for a row starting at t0, dt apart. */
export const evenTimes = (n: number, t0: number, dt: number) => Array.from({ length: n }, (_, i) => t0 + i * dt);

export const fallEase = ease.inQuad;
