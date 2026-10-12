// Paths for tracks, threads and rivers: sampled polylines with arc-length lookup.
import { type V2, clamp, lerp } from '../engine/util';

export class Path {
  pts: V2[];
  L: number[];
  constructor(pts: V2[]) {
    this.pts = pts;
    this.L = [0];
    for (let i = 1; i < pts.length; i++) this.L.push(this.L[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  }
  get length() {
    return this.L[this.L.length - 1]!;
  }
  /** Point and tangent angle at arc length s (clamped). */
  at(s: number): { x: number; y: number; angle: number } {
    const n = this.pts.length;
    s = clamp(s, 0, this.length);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.L[m]! < s) lo = m; else hi = m;
    }
    const a = this.pts[lo]!, b = this.pts[hi]!;
    const seg = this.L[hi]! - this.L[lo]!;
    const u = seg > 0 ? (s - this.L[lo]!) / seg : 0;
    return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  /** Sub-polyline from s0 to s1. */
  slice(s0: number, s1: number): V2[] {
    if (s1 <= s0) return [];
    const out: V2[] = [this.at(s0)];
    for (let i = 0; i < this.pts.length; i++) if (this.L[i]! > s0 && this.L[i]! < s1) out.push(this.pts[i]!);
    out.push(this.at(s1));
    return out;
  }
  /** Offset copy (parallel line) by d world units to the left of the direction of travel. */
  offset(d: number): Path {
    const out: V2[] = this.pts.map((p, i) => {
      const a = this.pts[Math.max(0, i - 1)]!, b = this.pts[Math.min(this.pts.length - 1, i + 1)]!;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      return { x: p.x + Math.sin(ang) * d, y: p.y - Math.cos(ang) * d };
    });
    return new Path(out);
  }
}

export function bezier(p0: V2, p1: V2, p2: V2, p3: V2, n = 40): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

export function arc(cx: number, cy: number, rad: number, a0: number, a1: number, n = 32): V2[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (a1 - a0) * (i / n);
    return { x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad };
  });
}

/** Join polylines, dropping duplicated joints. */
export function join(...parts: V2[][]): V2[] {
  const out: V2[] = [];
  for (const p of parts) for (const q of p) {
    const l = out[out.length - 1];
    if (!l || Math.hypot(l.x - q.x, l.y - q.y) > 1e-6) out.push(q);
  }
  return out;
}

/** Keyed motion along a path: [time, arc length, ease into this key]. */
export type SKey = [number, number, ((u: number) => number)?];
export function sAt(keys: SKey[], t: number) {
  if (t <= keys[0]![0]) return keys[0]![1];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!;
    if (t < k[0]) {
      const p = keys[i - 1]!;
      const u = clamp((t - p[0]) / (k[0] - p[0]));
      return lerp(p[1], k[1], (k[2] ?? ((x: number) => x))(u));
    }
  }
  return keys[keys.length - 1]![1];
}
/** Speed along a keyed path (arc length / s), numeric. */
export function sVel(keys: SKey[], t: number) {
  return (sAt(keys, t + 0.004) - sAt(keys, t - 0.004)) / 0.008;
}
