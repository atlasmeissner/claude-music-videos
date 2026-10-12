// A small plotter for the engraved figure plates: polylines with a hand wobble, hatching clipped to polygons,
// stroke-font text, all collected in drawing order so a plate can be drawn stroke by stroke (draw(c, k) with k the
// fraction of the drawing done). Bright lines on a dark plate, like the territory's engraving.
import { rgba } from '../engine/palette';
import { hash, noise1, TAU } from '../engine/util';
import type { StrokeText } from '../engine/stroke';

export type Pt = [number, number];
export interface PStyle { w: number; a: number; col: string; wobble: number; speed: number }
interface Stroke { pts: Float32Array; len: Float32Array; total: number; st: PStyle; c0: number; cost: number }

export class Plot {
  strokes: Stroke[] = [];
  total = 0;
  style: PStyle = { w: 1.2, a: 0.9, col: 'bone', wobble: 0.35, speed: 1 };
  private seed = 1;
  set(o: Partial<PStyle>) { this.style = { ...this.style, ...o }; return this; }
  with(o: Partial<PStyle>, f: () => void) { const s = this.style; this.set(o); f(); this.style = s; return this; }

  /** A polyline (optionally closed), subdivided and wobbled by hand. */
  path(p: Pt[], closed = false) {
    if (p.length < 2) return this;
    const P = closed ? [...p, p[0]!] : p;
    const out: number[] = [];
    const sd = (this.seed += 7.31);
    const wob = this.style.wobble;
    let acc = 0;
    for (let i = 0; i + 1 < P.length; i++) {
      const [x0, y0] = P[i]!, [x1, y1] = P[i + 1]!;
      const L = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.ceil(L / 7));
      const nx = -(y1 - y0) / (L || 1), ny = (x1 - x0) / (L || 1);
      for (let k = i === 0 ? 0 : 1; k <= n; k++) {
        const u = k / n, d = acc + L * u;
        const j = wob ? wob * noise1(d * 0.045, sd) : 0;
        out.push(x0 + (x1 - x0) * u + nx * j, y0 + (y1 - y0) * u + ny * j);
      }
      acc += L;
    }
    this.push(out);
    return this;
  }
  private push(out: number[]) {
    const pts = new Float32Array(out);
    const n = pts.length / 2;
    const len = new Float32Array(n);
    for (let i = 1; i < n; i++) len[i] = len[i - 1]! + Math.hypot(pts[2 * i]! - pts[2 * i - 2]!, pts[2 * i + 1]! - pts[2 * i - 1]!);
    const total = len[n - 1]!;
    if (total < 0.01) return;
    const cost = total / this.style.speed;
    this.strokes.push({ pts, len, total, st: { ...this.style }, c0: this.total, cost });
    this.total += cost;
  }
  line(x0: number, y0: number, x1: number, y1: number) { return this.path([[x0, y0], [x1, y1]]); }
  rect(x: number, y: number, w: number, h: number) { return this.path([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true); }
  /** An ellipse arc (centre, radii, angles). */
  arc(cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = TAU) {
    const n = Math.max(8, Math.ceil((Math.abs(a1 - a0) * Math.max(rx, ry)) / 5));
    const p: Pt[] = [];
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return this.path(p);
  }
  circle(cx: number, cy: number, r: number) { return this.arc(cx, cy, r, r); }
  /** Cubic Bézier. */
  bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 24) {
    const p: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, v = 1 - u;
      p.push([v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1]]);
    }
    return this.path(p);
  }
  /** A wavy line from x0 to x1 at height y. */
  wave(x0: number, x1: number, y: number, amp: number, period: number, phase = 0) {
    const p: Pt[] = [];
    for (let x = x0; x <= x1 + 0.01; x += Math.max(2, period / 8)) p.push([x, y + amp * Math.sin(((x - x0) / period) * TAU + phase)]);
    return this.path(p);
  }
  /**
   * Parallel hatching clipped to a polygon: lines at `angle`, `gap` px apart. `keep(x, y)` (0..1) thins it where
   * it is low (light / shade): the line is broken into dashes where keep falls under a per-line threshold.
   */
  hatch(poly: Pt[], angle: number, gap: number, keep?: (x: number, y: number) => number) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    // rotate the polygon so the hatch lines are horizontal
    const R = poly.map(([x, y]) => [x * ca + y * sa, -x * sa + y * ca] as Pt);
    let y0 = Infinity, y1 = -Infinity;
    for (const p of R) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    let li = 0;
    for (let y = y0 + gap * 0.5; y < y1; y += gap, li++) {
      const xs: number[] = [];
      for (let i = 0; i < R.length; i++) {
        const a = R[i]!, b = R[(i + 1) % R.length]!;
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      const back = (x: number): Pt => [x * ca - y * sa, x * sa + y * ca];
      const flip = li % 2 === 1; // boustrophedon, like a plotter
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = xs[k]! + 0.6, xb = xs[k + 1]! - 0.6;
        if (xb <= xa) continue;
        if (!keep) { const a = back(xa), b = back(xb); this.path(flip ? [b, a] : [a, b]); continue; }
        const thr = 0.25 + 0.5 * hash(li, 7.7);
        let run: Pt[] = [];
        const step = 4;
        for (let x = xa; x <= xb + 0.01; x += step) {
          const p = back(Math.min(x, xb));
          if (keep(p[0], p[1]) > thr) run.push(p);
          else { if (run.length > 1) this.path(flip ? run.reverse() : run); run = []; }
        }
        if (run.length > 1) this.path(flip ? run.reverse() : run);
      }
    }
    return this;
  }
  /** Stroke-font text with its left baseline at (x, y). */
  text(st: StrokeText, x: number, y: number, scale = 1) {
    for (const s of st.strokes) {
      const out: number[] = [];
      for (const p of s) out.push(x + p.x * scale, y + p.y * scale);
      if (out.length >= 4) this.push(out);
    }
    return this;
  }

  /**
   * Draw the first fraction k of the drawing into c (already in plate coordinates). Returns the pen position
   * (or null when done / nothing drawn).
   */
  draw(c: CanvasRenderingContext2D, k: number, alpha = 1): Pt | null {
    const lim = this.total * k;
    let head: Pt | null = null;
    let cur = '';
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of this.strokes) {
      if (s.c0 >= lim) break;
      const key = `${s.st.col}|${s.st.a}|${s.st.w}`;
      if (key !== cur) {
        if (cur) c.stroke();
        cur = key;
        c.strokeStyle = rgba(s.st.col, s.st.a * alpha); c.lineWidth = s.st.w;
        c.beginPath();
      }
      const P = s.pts, L = s.len;
      const remain = ((lim - s.c0) / s.cost) * s.total;
      c.moveTo(P[0]!, P[1]!);
      const n = L.length;
      let j = 1;
      for (; j < n && L[j]! <= remain; j++) c.lineTo(P[2 * j]!, P[2 * j + 1]!);
      if (j < n) {
        const u = (remain - L[j - 1]!) / Math.max(1e-6, L[j]! - L[j - 1]!);
        const x = P[2 * j - 2]! + (P[2 * j]! - P[2 * j - 2]!) * u, y = P[2 * j - 1]! + (P[2 * j + 1]! - P[2 * j - 1]!) * u;
        c.lineTo(x, y);
        head = [x, y];
      }
    }
    if (cur) c.stroke();
    return k >= 1 ? null : head;
  }
}
