// The one place every plate looks at. Maps & Territory is set in a single invented country: a 100 × 100 km
// sheet (x east, y south, km) with a mountain spine, a lake, hills, a coast running north–south on the east
// side and, off that coast, one small islet that is not on the map. Every plate shows part of this world,
// either as the MAP (bone paper, ruled roads, contour lines) or as the TERRITORY (the shaded relief itself).
//
//  - heightAt(x, y): the territory (km above sea level; sea < 0), a pure function.
//  - the height field is baked once per page into a texture (R = height, G/B = gradient) for the shaders.
//  - PLAN: the life as drawn — straight ruled roads between named places, with a year tick every 10 km.
//  - TRACK: the life as walked (Mara's) — a least-cost path through the valleys between waypoints that are
//    never the planned ones, ending off the shore on the islet.
import * as THREE from 'three';

// ------------------------------------------------------------------ noise (deterministic, fast)
const PERM = new Uint8Array(512);
{
  let s = 0x9e3779b9;
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]!;
}
const GX = new Float32Array(256), GY = new Float32Array(256);
for (let i = 0; i < 256; i++) { const a = (i / 256) * Math.PI * 2 + 0.37; GX[i] = Math.cos(a); GY[i] = Math.sin(a); }
/** 2D gradient noise, roughly −0.7..0.7. */
export function gnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const X = xi & 255, Y = yi & 255;
  const g = (ix: number, iy: number, dx: number, dy: number) => { const h = PERM[ix + PERM[iy]!]!; return GX[h]! * dx + GY[h]! * dy; };
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const n00 = g(X, Y, xf, yf), n10 = g(X + 1, Y, xf - 1, yf), n01 = g(X, Y + 1, xf, yf - 1), n11 = g(X + 1, Y + 1, xf - 1, yf - 1);
  return n00 + (n10 - n00) * u + (n01 - n00) * v + (n00 - n10 - n01 + n11) * u * v;
}
export function fbm(x: number, y: number, oct = 5): number {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * gnoise(x * f + i * 17.3, y * f - i * 9.1); f *= 2.03; a *= 0.5; }
  return s;
}
function ridge(x: number, y: number, oct = 5): number {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(gnoise(x * f + i * 31.7, y * f + i * 5.3) * 1.4); s += a * n * n; f *= 2.07; a *= 0.5; }
  return s;
}
const sst = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ the territory
export const WORLD = 100; // km
/** Coast x (km) at latitude y: land lies west of it. */
export function coastX(y: number): number {
  return 70 + 24 * gnoise(y * 0.035, 3.1) + 9 * gnoise(y * 0.12, 7.7) + 3 * gnoise(y * 0.45, 1.3);
}
export const ISLET = { x: coastX(57) + 4.6, y: 57 };
export const LAKE = { x: 47, y: 37, r: 4.2 };
/** Height in km (sea < 0). */
export function heightAt(x: number, y: number): number {
  const land = (coastX(y) - x) / 6; // >0 on land, ~1 per 6 km inland
  const inland = sst(-0.3, 2.5, land);
  // the mountain spine, running roughly north–south west of centre
  const spineX = 33 + 7 * gnoise(y * 0.03, 11.0);
  const spine = Math.exp(-(((x - spineX) / 11) ** 2)) * (0.6 + 0.4 * sst(5, 30, y) * sst(98, 70, y));
  let h = 0.04 + 0.16 * inland;
  h += spine * 1.6 * ridge(x * 0.07, y * 0.07);
  h += 0.22 * inland * (fbm(x * 0.06, y * 0.06, 5) + 0.25);
  // a second, lower range of hills toward the coast
  h += 0.25 * Math.exp(-(((x - 58 - 3 * gnoise(y * 0.05, 2)) / 6) ** 2)) * ridge(x * 0.11 + 4, y * 0.11, 4) * inland;
  // the lake: a basin
  const dl = Math.hypot((x - LAKE.x) / 1.35, y - LAKE.y) / (LAKE.r * (1 + 0.35 * gnoise(4.4 + Math.cos(Math.atan2(y - LAKE.y, x - LAKE.x)) * 1.3, 2.2 + Math.sin(Math.atan2(y - LAKE.y, x - LAKE.x)) * 1.3)));
  h = h * sst(0.85, 1.9, dl) + (0.06 * dl - 0.05) * (1 - sst(0.85, 1.9, dl));
  // the sea: falls away east of the coast
  if (land < 0.4) h = Math.min(h, h * sst(-0.25, 0.4, land) + (land - 0.1) * 0.06 + 0.012 * gnoise(x * 0.5, y * 0.5));
  // the islet, off the shore
  const di = Math.hypot(x - ISLET.x, (y - ISLET.y) * 1.3);
  h = Math.max(h, 0.07 * Math.exp(-di * di / 1.6) - 0.02 + 0.006 * gnoise(x * 3, y * 3));
  return h;
}
/** Contour interval used on the paper map (km). */
export const CONTOUR = 0.05;

// ------------------------------------------------------------------ the baked height texture
export const HM = 1280; // texels per side
/** The baked domain is larger than the sheet: the territory goes on past the map's edge. */
export const DMIN = -60, DSIZE = 220;
/** GLSL: world km -> height-texture uv. */
export const HM_UV = `((w - vec2(${DMIN.toFixed(1)})) / ${DSIZE.toFixed(1)})`;
let hmData: Float32Array | null = null;
let hmTex: THREE.DataTexture | null = null;
export function heights(): Float32Array {
  if (!hmData) {
    const d = new Float32Array(HM * HM);
    for (let j = 0; j < HM; j++) for (let i = 0; i < HM; i++) d[j * HM + i] = heightAt(DMIN + ((i + 0.5) / HM) * DSIZE, DMIN + ((j + 0.5) / HM) * DSIZE);
    hmData = d;
  }
  return hmData;
}
/** Bilinear height from the baked grid (fast; for CPU-side queries in scenes). */
export function hAt(x: number, y: number): number {
  const d = heights();
  const fx = Math.min(HM - 1.001, Math.max(0, ((x - DMIN) / DSIZE) * HM - 0.5)), fy = Math.min(HM - 1.001, Math.max(0, ((y - DMIN) / DSIZE) * HM - 0.5));
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
  const a = d[j * HM + i]!, b = d[j * HM + i + 1]!, c = d[(j + 1) * HM + i]!, e = d[(j + 1) * HM + i + 1]!;
  return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
}
/** RGBA half-float texture: R height (km), G dh/dx, B dh/dy (km per km), A unused. Shared by all plates. */
export function heightTexture(): THREE.DataTexture {
  if (hmTex) return hmTex;
  const d = heights();
  const px = new Uint16Array(HM * HM * 4);
  const cell = DSIZE / HM;
  const H = THREE.DataUtils.toHalfFloat;
  for (let j = 0; j < HM; j++) for (let i = 0; i < HM; i++) {
    const k = j * HM + i;
    const l = d[j * HM + Math.max(0, i - 1)]!, r = d[j * HM + Math.min(HM - 1, i + 1)]!;
    const u = d[Math.max(0, j - 1) * HM + i]!, b = d[Math.min(HM - 1, j + 1) * HM + i]!;
    px[k * 4] = H(d[k]!); px[k * 4 + 1] = H((r - l) / (2 * cell)); px[k * 4 + 2] = H((b - u) / (2 * cell)); px[k * 4 + 3] = H(1);
  }
  const t = new THREE.DataTexture(px, HM, HM, THREE.RGBAFormat, THREE.HalfFloatType);
  t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.flipY = false;
  t.needsUpdate = true;
  hmTex = t;
  return t;
}

// ------------------------------------------------------------------ the plan (the life as drawn)
export interface Place { name: string; x: number; y: number; year: number }
/** The planned life: named places on ruled roads, a year on each. (Deadpan milestone names.) */
export const PLAN: Place[] = [
  { name: 'HOME', x: 9, y: 62, year: 1990 },
  { name: 'SCHOOL', x: 20, y: 54, year: 2008 },
  { name: 'MEDICAL SCHOOL', x: 34, y: 47, year: 2014 },
  { name: 'THE CLINIC', x: 47, y: 37, year: 2016 }, // (in the middle of the lake)
  { name: 'MARRIED', x: 56, y: 30, year: 2018 },
  { name: 'THE HOUSE', x: 64, y: 22, year: 2020 },
  { name: 'RETIREMENT', x: 69, y: 11, year: 2055 },
];
/** The plan's road as one polyline (km). */
export const PLAN_PTS = PLAN.map((p) => ({ x: p.x, y: p.y }));

// ------------------------------------------------------------------ the track (the life as walked)
/**
 * The life as walked (Mara's): the waypoints the trail actually reaches, each one a life event. The trail starts
 * on the plan's road (HOME) and leaves it for good at the lake. `straight`: the leg that ends at this waypoint is
 * walked straight (across water) instead of by least cost.
 */
export const WAY: { x: number; y: number; name?: string; straight?: boolean }[] = [
  { x: 9, y: 62, name: 'HOME' },
  { x: 20, y: 54 }, // on the plan's road (tracing someone else's story)
  { x: 28.5, y: 50.2 },
  { x: 41.6, y: 37.2, name: 'THE FERRY' }, // the west shore of the lake
  { x: 52.4, y: 37.4, straight: true }, // across the water: off the shore
  { x: 55.6, y: 41.6, name: 'THE BAKERY' },
  { x: 54.2, y: 50.6, name: 'THE FEAST' },
  { x: 58.4, y: 56.2, name: 'IDA' },
  { x: 63.2, y: 49.2, name: "MARA'S" },
  { x: 60.2, y: 44.2, name: 'HER FATHER' },
  // lost: the trail loops back over itself before it finds anything
  { x: 57.2, y: 47.8 }, { x: 55.6, y: 52.8 }, { x: 59.9, y: 52.2 }, { x: 58.1, y: 48.9 }, { x: 56.8, y: 54.8 },
  { x: 61.8, y: 57.8, name: 'WANDERING' },
  { x: 66, y: 62, name: 'THE SEASIDE' },
  { x: 68.6, y: 63.2, name: 'THE JETTY' },
  { x: ISLET.x - 0.2, y: ISLET.y + 0.3, name: 'HERE', straight: true },
];
/** The lighthouse on the islet (a little north of where the trail lands). */
export const LIGHT = { x: ISLET.x + 0.35, y: ISLET.y - 0.45 };
/** Index of a named waypoint. */
export const wayIx = (name: string) => WAY.findIndex((w) => w.name === name);

export interface Track { pts: { x: number; y: number }[]; len: Float32Array; total: number; wayAt: number[] }
let trackCache: Track | null = null;
/** Least-cost path through the valleys between the waypoints (A* on a 200² grid), lightly smoothed. */
export function track(): Track {
  if (trackCache) return trackCache;
  const N = 200, cell = WORLD / N;
  const H = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = hAt((i + 0.5) * cell, (j + 0.5) * cell);
  const cost = (a: number, b: number) => {
    const ha = H[a]!, hb = H[b]!;
    const slope = Math.abs(hb - ha) / cell;
    const water = hb < 0 ? 6 : 0;
    return 1 + slope * 22 + hb * 0.8 + water;
  };
  const pts: { x: number; y: number }[] = [];
  const wayAt: number[] = [0];
  for (let w = 0; w + 1 < WAY.length; w++) {
    const s = WAY[w]!, g = WAY[w + 1]!;
    if (g.straight) {
      const L = Math.hypot(g.x - s.x, g.y - s.y), n = Math.max(2, Math.ceil(L / cell));
      for (let k = w === 0 ? 0 : 1; k <= n; k++) pts.push({ x: s.x + ((g.x - s.x) * k) / n, y: s.y + ((g.y - s.y) * k) / n });
      wayAt.push(pts.length - 1);
      continue;
    }
    const si = Math.min(N - 1, Math.floor(s.x / cell)) + Math.min(N - 1, Math.floor(s.y / cell)) * N;
    const gi = Math.min(N - 1, Math.floor(g.x / cell)) + Math.min(N - 1, Math.floor(g.y / cell)) * N;
    const dist = new Float32Array(N * N).fill(Infinity), prev = new Int32Array(N * N).fill(-1);
    // binary heap
    const heap: [number, number][] = [];
    const push = (f: number, n: number) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p]![0] <= heap[i]![0]) break; [heap[p], heap[i]] = [heap[i]!, heap[p]!]; i = p; } };
    const pop = () => { const top = heap[0]!; const last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l; if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i]!, heap[m]!]; i = m; } } return top; };
    const gx = gi % N, gy = Math.floor(gi / N);
    const hcost = (n: number) => Math.hypot((n % N) - gx, Math.floor(n / N) - gy);
    dist[si] = 0; push(hcost(si), si);
    while (heap.length) {
      const [, n] = pop();
      if (n === gi) break;
      const x = n % N, y = Math.floor(n / N);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const m = ny * N + nx;
        const d = dist[n]! + cost(n, m) * (dx && dy ? Math.SQRT2 : 1);
        if (d < dist[m]!) { dist[m] = d; prev[m] = n; push(d + hcost(m), m); }
      }
    }
    const seg: number[] = [];
    for (let n = gi; n !== -1 && n !== si; n = prev[n]!) seg.push(n);
    seg.push(si);
    seg.reverse();
    const start = w === 0 ? 0 : 1;
    for (let k = start; k < seg.length; k++) pts.push({ x: ((seg[k]! % N) + 0.5) * cell, y: (Math.floor(seg[k]! / N) + 0.5) * cell });
    wayAt.push(pts.length - 1);
  }
  // pin the waypoints exactly, smooth (Chaikin ×2 keeps the walk loose), add a small hand wobble
  pts[0] = { x: WAY[0]!.x, y: WAY[0]!.y };
  wayAt.forEach((k, w) => { pts[k] = { x: WAY[w]!.x, y: WAY[w]!.y }; });
  let P = pts;
  let wa = wayAt.slice();
  for (let it = 0; it < 2; it++) {
    const Q: { x: number; y: number }[] = [P[0]!];
    const nwa: number[] = [0];
    let wi = 1;
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i]!, b = P[i + 1]!;
      Q.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      if (wi < wa.length && i + 1 === wa[wi]) { Q.push({ x: b.x, y: b.y }); nwa.push(Q.length - 1); wi++; }
    }
    P = Q; wa = nwa;
  }
  P = P.map((p, i) => ({ x: p.x + 0.12 * gnoise(i * 0.21, 5.5), y: p.y + 0.12 * gnoise(i * 0.21, 9.5) }));
  const len = new Float32Array(P.length);
  for (let i = 1; i < P.length; i++) len[i] = len[i - 1]! + Math.hypot(P[i]!.x - P[i - 1]!.x, P[i]!.y - P[i - 1]!.y);
  trackCache = { pts: P, len, total: len[len.length - 1]!, wayAt: wa };
  return trackCache;
}
/** Point (and heading) at arc length s along the track. */
export function trackAt(s: number) {
  const T = track();
  const P = T.pts, L = T.len;
  s = Math.max(0, Math.min(T.total, s));
  let lo = 0, hi = P.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m]! <= s) lo = m; else hi = m; }
  const a = P[lo]!, b = P[hi]!;
  const u = (s - L[lo]!) / Math.max(1e-6, L[hi]! - L[lo]!);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, angle: Math.atan2(b.y - a.y, b.x - a.x), i: lo };
}
/** Arc length of waypoint w. */
export const waySAt = (w: number) => { const T = track(); return T.len[T.wayAt[Math.min(w, T.wayAt.length - 1)]!]!; };
