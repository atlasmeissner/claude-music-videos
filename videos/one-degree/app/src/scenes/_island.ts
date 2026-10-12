// The island (revision 4): the whole world is one small flat island balanced on the point of the needle, seen from a
// little above. At first it is level: a still lake on the left, the rest dry and dead, two people. On the first sung
// "degree" it tips by exactly one degree (right side down) and stays there: one degree, once, for the whole song.
// That is enough for the lake to spill. Every later "degree" sends another surge down the river, and the land comes
// alive behind the water (grass, trees, fields, houses, people, lights), spreading out from the river as it goes.
// By the end of the final chorus the river reaches the far edge and falls off the world.
import type { LineBatch } from '../engine/lines';
import type { Lyrics } from '../engine/lyrics';
import { W, H } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, lerp, noise1, prog, TAU } from '../engine/util';
import { degreeTimes } from './_od';

type RGB = [number, number, number];
export const A = 700, B = 230, THICK = 30, DEPTH = 330; // the disc's half-axes, rim thickness and underside depth (px)
export const PIVOT = { x: 0, y: DEPTH + 6 };
export const RIVER_KM = 120;

// ------------------------------------------------------------------ time: the tilt and the spread
/** The world's tilt (degrees) at t: 0 until the first "degree", then one degree, eased over the word. */
export function tiltAt(ly: Lyrics, t: number) {
  const d1 = degreeTimes(ly)[0]!;
  return prog(t, d1 - 0.05, d1 + 1.6, (x) => ease.outBack(ease.inOutCubic(x), 1.4));
}
/** How far life has spread (path units; the water front is min(1, S)) after n degrees. */
const STEP = [0, 0, 0.05, 0.11, 0.17, 0.23, 0.29, 0.35, 0.41, 0.47, 0.53, 0.6, 0.66, 0.72, 0.78, 0.86, 0.95, 1.04, 1.12, 1.24, 1.36, 1.48, 1.6, 1.72, 1.84];
const SURGE = 2.4; // seconds for a degree's surge to arrive
export function spreadAt(ly: Lyrics, t: number) {
  const ds = degreeTimes(ly);
  let S = -0.03;
  ds.forEach((d, i) => {
    const inc = STEP[i + 1]! - STEP[i]!;
    S += inc * prog(t, d + 0.15, d + 0.15 + SURGE, ease.inOutQuad);
  });
  // a slow creep between the degrees, once the water runs
  if (ds[1] !== undefined) S += 0.0012 * Math.max(0, t - ds[1]);
  return S;
}

// ------------------------------------------------------------------ geometry
const CTRL: [number, number][] = [[-0.33, 0.06], [-0.2, 0.27], [0.0, 0.2], [0.17, -0.13], [0.38, -0.12], [0.53, 0.18], [0.68, 0.44], [Math.cos(0.56), Math.sin(0.56)]];
const NP = 240;
export const PATH: { x: number; z: number }[] = [];
const PL: number[] = [];
{
  const pts: { x: number; z: number }[] = [];
  const P = (i: number) => CTRL[Math.max(0, Math.min(CTRL.length - 1, i))]!;
  for (let i = 0; i < CTRL.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < 40; k++) {
      const u = k / 40, u2 = u * u, u3 = u2 * u;
      const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      pts.push({ x: cr(p0[0], p1[0], p2[0], p3[0]), z: cr(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  pts.push({ x: CTRL[CTRL.length - 1]![0], z: CTRL[CTRL.length - 1]![1] });
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z));
  const tot = L[L.length - 1]!;
  // resample evenly
  let j = 0;
  for (let i = 0; i <= NP; i++) {
    const s = (i / NP) * tot;
    while (j < L.length - 2 && L[j + 1]! < s) j++;
    const u = (s - L[j]!) / Math.max(1e-9, L[j + 1]! - L[j]!);
    PATH.push({ x: lerp(pts[j]!.x, pts[j + 1]!.x, u), z: lerp(pts[j]!.z, pts[j + 1]!.z, u) });
    PL.push(i / NP);
  }
}
export function pathAt(s: number) {
  const f = clamp(s) * NP, i = Math.min(NP - 1, Math.floor(f)), u = f - i;
  return { x: lerp(PATH[i]!.x, PATH[i + 1]!.x, u), z: lerp(PATH[i]!.z, PATH[i + 1]!.z, u) };
}
export const LAKE = { x: -0.6, z: 0.02, rx: 0.27, rz: 0.4 };
const inLake = (x: number, z: number, m = 0) => ((x - LAKE.x) / (LAKE.rx + m)) ** 2 + ((z - LAKE.z) / (LAKE.rz + m)) ** 2 < 1;
function nearest(x: number, z: number) {
  let best = 1e9, bs = 0;
  for (let i = 0; i <= NP; i++) { const d = (PATH[i]!.x - x) ** 2 + (PATH[i]!.z - z) ** 2; if (d < best) { best = d; bs = i / NP; } }
  return { s: bs, d: Math.sqrt(best) };
}

type Kind = 'grass' | 'shrub' | 'tree' | 'house' | 'field';
/** Villages: clusters of houses beside the river (path position, side offset). */
export const VILLAGES = [[0.1, 0.11], [0.28, -0.1], [0.46, 0.11], [0.62, -0.1], [0.78, 0.1], [0.9, -0.09]].map(([s0, off]) => {
  const p = pathAt(s0!), q = pathAt(s0! + 0.01);
  const nx = -(q.z - p.z), nz = q.x - p.x, nl = Math.hypot(nx, nz) || 1;
  return { x: p.x + (nx / nl) * off!, z: p.z + (nz / nl) * off!, s: s0! };
});
interface Item { x: number; z: number; kind: Kind; k: number; seed: number; dead: boolean; size: number }
export const ITEMS: Item[] = [];
{
  let n = 0;
  for (let i = 0; n < 1700 && i < 12000; i++) {
    const r = Math.sqrt(hash(i, 11)) * 0.93, a = hash(i, 12) * TAU;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inLake(x, z, 0.05)) continue;
    const { s, d } = nearest(x, z);
    if (d < 0.03) continue;
    const h = hash(i, 13);
    const vd = Math.min(...VILLAGES.map((vl) => Math.hypot((vl.x - x) * 1.0, (vl.z - z) * 1.3)));
    let kind: Kind = 'grass';
    if (vd < 0.085 && d > 0.035) kind = h < 0.75 ? 'house' : 'grass';
    else if (d > 0.07 && d < 0.32 && h < 0.03) kind = 'house';
    else if (d > 0.06 && d < 0.2 && h < 0.09) kind = 'field';
    else if (h < 0.165) kind = 'tree';
    else if (h < 0.3) kind = 'shrub';
    const k = s + 0.8 * d + (kind === 'house' ? 0.1 : kind === 'field' ? 0.08 : kind === 'tree' ? 0.03 : 0);
    ITEMS.push({ x, z, kind, k, seed: i, dead: kind === 'tree' && hash(i, 14) < 0.3, size: 0.8 + 0.4 * hash(i, 15) });
    n++;
  }
  ITEMS.sort((a, b) => a.z - b.z);
}
/** Two people waiting on the dry land at the start. */
const FIRST_PEOPLE = [{ x: 0.3, z: 0.42 }, { x: 0.34, z: 0.44 }];

// underside: the union of shrinking cross-sections, as fill rows (pre-transform coords, disc centre at 0,0)
const SECTIONS: { y: number; r: number }[] = [];
for (let k = 0; k <= 40; k++) {
  const u = k / 40;
  const y = k === 0 ? 0 : THICK + (DEPTH - THICK) * Math.pow(u, 1.15);
  const r = k === 0 ? 1 : Math.pow(1 - u, 0.62) * (0.97 + 0.03 * noise1(u * 9, 4));
  SECTIONS.push({ y, r });
}
SECTIONS.splice(1, 0, { y: THICK, r: 1 });
const ROWS: { y: number; x0: number; x1: number }[] = [];
for (let Y = -B; Y <= DEPTH + 4; Y += 5) {
  let hw = 0;
  for (const sct of SECTIONS) {
    const dy = (Y - sct.y) / Math.max(1e-6, sct.r * B);
    if (Math.abs(dy) <= 1) hw = Math.max(hw, sct.r * A * Math.sqrt(1 - dy * dy));
  }
  if (hw > 0) ROWS.push({ y: Y, x0: -hw, x1: hw });
}

// ------------------------------------------------------------------ view
export interface Cam { ax: number; ay: number; fx: number; fy: number; zoom: number }
export const WIDE: Cam = { ax: 1010, ay: 610, fx: 0, fy: 0, zoom: 1 };
export class View {
  th = 0; c = 1; s = 0; cam: Cam = WIDE; zw = 1;
  set(tiltDeg: number, cam: Cam) {
    this.th = (tiltDeg * Math.PI) / 180; this.c = Math.cos(this.th); this.s = Math.sin(this.th); this.cam = cam;
    this.zw = Math.pow(cam.zoom, 0.72);
  }
  /** pre-transform px -> rotated about the pivot */
  rot(px: number, py: number) {
    const dx = px - PIVOT.x, dy = py - PIVOT.y;
    return { x: PIVOT.x + dx * this.c - dy * this.s, y: PIVOT.y + dx * this.s + dy * this.c };
  }
  /** pre-transform px -> screen */
  sp(px: number, py: number) {
    const r = this.rot(px, py), k = this.cam;
    return { x: k.ax + (r.x - k.fx) * k.zoom, y: k.ay + (r.y - k.fy) * k.zoom };
  }
  /** world (x, z on the disc, h px up) -> screen */
  w(x: number, z: number, h = 0) { return this.sp(x * A, z * B - h); }
  /** focus point (pre-camera, rotated) for a world point */
  focusOf(x: number, z: number, h = 0) { return this.rot(x * A, z * B - h); }
}

// ------------------------------------------------------------------ drawing
const sc = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const DARK: RGB = [0.0052, 0.0058, 0.007];
const TOP: RGB = [0.0105, 0.0115, 0.013];
const SIDE: RGB = [0.0068, 0.0074, 0.0085];

export interface IslandState { t: number; S: number; tilt: number; night: number; surge: number[]; alpha?: number; level?: boolean }

/** Draw the whole island into a 'normal'-blend LineBatch, back to front. */
export function drawIsland(lb: LineBatch, v: View, st: IslandState) {
  const z = v.zw, al = st.alpha ?? 1, t = st.t;
  const F = clamp(st.S), nt = st.night;
  const lineK = 1 - 0.35 * nt;
  const bone = LIN.bone, gr = LIN.graphite, ash = LIN.ash;
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }, w: number, c: RGB, alpha: number) => {
    if ((a.x < -60 && b.x < -60) || (a.x > W + 60 && b.x > W + 60) || (a.y < -60 && b.y < -60) || (a.y > H + 60 && b.y > H + 60)) return;
    lb.seg2(a.x, a.y, b.x, b.y, w, c, alpha * al);
  };
  const pseg = (x0: number, y0: number, x1: number, y1: number, w: number, c: RGB, alpha: number) => seg(v.sp(x0, y0), v.sp(x1, y1), w, c, alpha);
  // stars (screen space, fixed)
  if (nt > 0.02) for (let i = 0; i < 160; i++) {
    const x = hash(i, 51) * W, y = hash(i, 52) * H * 0.75;
    lb.seg2(x, y, x + 0.01, y, 1.2 + 1.6 * hash(i, 53) ** 3, bone, nt * (0.25 + 0.5 * hash(i, 54)) * al);
  }
  // underside + rim wall: dark fill rows, strata arcs, silhouette
  const zy = v.cam.zoom;
  for (const r of ROWS) pseg(r.x0, r.y, r.x1, r.y, 5 * zy + 1.5, r.y < THICK - B ? SIDE : SIDE, 1);
  for (let k = 2; k < SECTIONS.length; k += 4) {
    const s = SECTIONS[k]!;
    const n = 48;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI;
      const j0 = 2 * noise1(a0 * 4 + k, 9), j1 = 2 * noise1(a1 * 4 + k, 9);
      pseg(Math.cos(a0) * s.r * A, s.y + Math.sin(a0) * s.r * B + j0, Math.cos(a1) * s.r * A, s.y + Math.sin(a1) * s.r * B + j1, 1 * z, sc(gr, lineK), 0.75);
    }
  }
  // rock texture: short engraved strokes on the front of the underside
  for (let i = 0; i < 220; i++) {
    const k = 2 + Math.floor(hash(i, 61) * (SECTIONS.length - 4));
    const s = SECTIONS[k]!, a = 0.12 + hash(i, 62) * (Math.PI - 0.24);
    const x = Math.cos(a) * s.r * A, y = s.y + Math.sin(a) * s.r * B;
    const l = 5 + 9 * hash(i, 63);
    pseg(x, y, x + l * 0.3, y + l, 1 * z, sc(gr, lineK), 0.6);
  }
  // silhouette of the underside (the extremes of the fill rows below the rim) and the rim wall's front edge
  {
    let prev: { y: number; x0: number; x1: number } | null = null;
    for (const r of ROWS) {
      if (r.y < 0) continue;
      if (prev) { pseg(prev.x0, prev.y, r.x0, r.y, 1.3 * z, sc(bone, lineK), 0.75); pseg(prev.x1, prev.y, r.x1, r.y, 1.3 * z, sc(bone, lineK), 0.75); }
      prev = r;
    }
    if (prev) pseg(prev.x0, prev.y, prev.x1, prev.y, 1.3 * z, sc(bone, lineK), 0.75);
    const n = 96;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI;
      pseg(Math.cos(a0) * A, THICK + Math.sin(a0) * B, Math.cos(a1) * A, THICK + Math.sin(a1) * B, 1.2 * z, sc(bone, lineK), 0.6);
    }
  }
  // the waterfall over the front-right rim, once the river gets there
  const end = PATH[NP]!;
  const fall = clamp((st.S - 1) / 0.12);
  if (fall > 0) {
    const e = { x: end.x * A, y: end.z * B };
    const len = (DEPTH * 0.9 + 300) * ease.outCubic(fall);
    for (let k = 0; k < 11; k++) {
      const off = (k - 5) * 2.4 * (1 + 0.6 * 0);
      const step = 7;
      for (let y = 0; y < len; y += step) {
        const spread = 1 + (y / len) * 1.6;
        const fl = 0.55 + 0.45 * Math.sin(y * 0.045 - t * 9 + k * 1.9);
        const fade = Math.pow(1 - y / len, 1.4);
        pseg(e.x + off * spread, e.y + y, e.x + off * spread, e.y + Math.min(len, y + step), 1.3 * z, sc(LIN.signal, 0.8 + 0.9 * fl), 0.8 * fade);
      }
    }
  }
  // the top: a dark fill, the rim ellipse
  for (let y = -B; y <= B; y += 4) {
    const hw = A * Math.sqrt(Math.max(0, 1 - (y / B) ** 2));
    pseg(-hw, y, hw, y, 4 * zy + 1.5, TOP, 1);
  }
  {
    const n = 160;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
      pseg(Math.cos(a0) * A, Math.sin(a0) * B, Math.cos(a1) * A, Math.sin(a1) * B, 1.5 * z, sc(bone, lineK), 0.9);
    }
  }
  // the lake: shore, level water strokes (signal), a few ripples
  {
    const n = 64;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
      const r0 = 1 + 0.03 * Math.sin(a0 * 3) + 0.015 * Math.sin(a0 * 5 + 1), r1 = 1 + 0.03 * Math.sin(a1 * 3) + 0.015 * Math.sin(a1 * 5 + 1);
      seg(v.w(LAKE.x + Math.cos(a0) * LAKE.rx * r0, LAKE.z + Math.sin(a0) * LAKE.rz * r0), v.w(LAKE.x + Math.cos(a1) * LAKE.rx * r1, LAKE.z + Math.sin(a1) * LAKE.rz * r1), 1.3 * z, sc(bone, lineK), 0.85);
    }
    for (let k = -9; k <= 9; k++) {
      const zz = (k / 10) * 0.92;
      const hw = Math.sqrt(Math.max(0, 1 - zz * zz)) * 0.86;
      if (hw <= 0) continue;
      const shim = 0.5 + 0.5 * Math.sin(t * 1.4 + k * 1.7);
      seg(v.w(LAKE.x - hw * LAKE.rx, LAKE.z + zz * LAKE.rz), v.w(LAKE.x + hw * LAKE.rx, LAKE.z + zz * LAKE.rz), 1.4 * z, sc(LIN.signal, 0.8 + 0.4 * nt), 0.35 + 0.25 * shim);
    }
  }
  // items, back to front (the river is drawn in its depth band between them)
  const riverDrawnAt = 0.0; // draw the river after items with z < this (the river spans the middle)
  let riverDone = false;
  const drawRiver = () => {
    riverDone = true;
    if (F <= 0) return;
    const n = Math.max(1, Math.floor(F * NP));
    for (let i = 0; i < n; i++) {
      const s0 = i / NP, s1 = Math.min(F, (i + 1) / NP);
      const age = clamp((st.S - s0) / 0.45);
      const p = v.w(PATH[i]!.x, PATH[i]!.z), q = v.w(pathAt(s1).x, pathAt(s1).z);
      const wdt = (1.6 + 5.5 * age) * z;
      seg(p, q, wdt + 2.5 * z, DARK, 1);
      seg(p, q, wdt, sc(LIN.signal, 1.05 + 0.5 * nt), 0.95);
    }
    // flow: bright dashes running downstream
    for (let k = 0; k < 40; k++) {
      const s = ((k / 40 + t * 0.035) % 1);
      if (s > F - 0.01) continue;
      const a = v.w(pathAt(s).x, pathAt(s).z), b = v.w(pathAt(s + 0.008).x, pathAt(s + 0.008).z);
      seg(a, b, 1.6 * z, sc(LIN.ember, 1.8), 0.7);
    }
    // each degree's surge: a hot pulse from the lake down to the front
    for (const sg of st.surge) {
      if (sg <= 0 || sg >= 1.2) continue;
      const head = sg * Math.max(F, 0.02);
      for (let j = 0; j < 10; j++) {
        const s = head - j * 0.006;
        if (s < 0 || s > F) continue;
        const a = v.w(pathAt(s).x, pathAt(s).z), b = v.w(pathAt(s + 0.006).x, pathAt(s + 0.006).z);
        seg(a, b, (7 - j * 0.4) * z, sc(LIN.ember, 2.6 * (1 - j / 10)), 0.95 * (1 - sg / 1.2));
      }
    }
    // the front
    if (F < 1) {
      const p = v.w(pathAt(F).x, pathAt(F).z);
      lb.seg2(p.x, p.y, p.x + 0.01, p.y, 12 * z, sc(LIN.signal, 0.5), 0.5 * al);
      lb.seg2(p.x, p.y, p.x + 0.01, p.y, 5 * z, sc(LIN.ember, 2.4), 0.95 * al);
    }
  };
  for (const it of ITEMS) {
    if (!riverDone && it.z > riverDrawnAt) drawRiver();
    drawItem(lb, v, it, st, seg, lineK);
  }
  if (!riverDone) drawRiver();
  // people
  drawPeople(lb, v, st, seg, lineK);
}

type SegFn = (a: { x: number; y: number }, b: { x: number; y: number }, w: number, c: RGB, alpha: number) => void;

function drawItem(lb: LineBatch, v: View, it: Item, st: IslandState, seg: SegFn, lineK: number) {
  const z = v.zw, zy = v.cam.zoom, t = st.t;
  const span = it.kind === 'grass' ? 0.04 : it.kind === 'shrub' ? 0.07 : it.kind === 'tree' ? 0.16 : 0.12;
  const live = clamp((st.S - it.k) / span);
  const bone = sc(LIN.bone, lineK), gr = sc(LIN.graphite, lineK);
  const b = v.w(it.x, it.z);
  if (b.x < -80 || b.x > W + 80 || b.y < -150 || b.y > H + 80) return;
  const up = (h: number) => v.w(it.x, it.z, h);
  const H0 = (dx: number, h: number) => { const p = v.w(it.x, it.z, h); return { x: p.x + dx * zy * v.c, y: p.y + dx * zy * v.s }; };
  switch (it.kind) {
    case 'grass': {
      if (live < 1) {
        // dry: a short crack
        const a = H0(-3 * it.size, 0), m = H0(0, 0.6), c = H0(3 * it.size, -0.4);
        seg(a, m, 0.9 * z, gr, 0.55 * (1 - live)); seg(m, c, 0.9 * z, gr, 0.55 * (1 - live));
      }
      if (live > 0) {
        const h = (4 + 4 * it.size) * live;
        for (let k = -1; k <= 1; k++) seg(H0(k * 1.5, 0), H0(k * 3.2, h * (k === 0 ? 1 : 0.75)), 1 * z, bone, 0.6 * live);
      }
      break;
    }
    case 'shrub': {
      if (live <= 0) break;
      const r = 6 * it.size * live;
      for (let k = 0; k < 7; k++) {
        const a0 = Math.PI + (k / 7) * Math.PI, a1 = Math.PI + ((k + 1) / 7) * Math.PI;
        seg(H0(Math.cos(a0) * r, -Math.sin(a0) * r * 0.8), H0(Math.cos(a1) * r, -Math.sin(a1) * r * 0.8), 1.1 * z, bone, 0.75);
      }
      break;
    }
    case 'tree': {
      const g = ease.outCubic(live);
      if (!it.dead && g <= 0) break;
      const hgt = (it.dead ? 22 : 10 + 20 * g) * it.size;
      seg(b, up(hgt), 1.5 * z, bone, it.dead ? 0.55 + 0.35 * g : 0.9);
      // branches (bare)
      for (let k = 0; k < 3; k++) {
        const hy = hgt * (0.5 + k * 0.17), dir = k % 2 ? 1 : -1;
        seg(up(hy), H0(dir * (7 - k * 1.5) * it.size, hy + 6), 1 * z, bone, (it.dead ? 0.55 : 0.8) * (1 - g * 0.6));
      }
      if (g > 0) {
        const cr = (6 + 6 * it.size) * g, c0 = { x: 0, h: hgt + cr * 0.5 };
        const cc = H0(c0.x, c0.h);
        lb.seg2(cc.x, cc.y, cc.x + 0.01, cc.y, cr * 1.9 * zy, DARK, 1);
        const n = 18;
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU;
          const r0 = cr * (1 + 0.1 * Math.sin(a0 * 5 + it.seed)), r1 = cr * (1 + 0.1 * Math.sin(a1 * 5 + it.seed));
          seg(H0(Math.cos(a0) * r0, c0.h - Math.sin(a0) * r0 * 0.9), H0(Math.cos(a1) * r1, c0.h - Math.sin(a1) * r1 * 0.9), 1.1 * z, bone, 0.9);
        }
        for (let k = -2; k <= 2; k++) {
          const yy = c0.h + k * cr * 0.3, hw = Math.sqrt(Math.max(0, 1 - (k * 0.3) ** 2)) * cr * 0.75;
          seg(H0(-hw * 0.3, yy - hw * 0.25), H0(hw, yy + hw * 0.25), 0.9 * z, bone, 0.4);
        }
      }
      break;
    }
    case 'field': {
      if (live <= 0) break;
      // furrows: short parallel strokes on the ground, ember
      for (let r = 0; r < 5; r++) {
        const dz = (r - 2) * 0.012;
        const n = Math.ceil(live * 6);
        for (let k = 0; k < n; k++) {
          const x0 = it.x - 0.035 + k * 0.012, x1 = x0 + 0.009;
          seg(v.w(x0, it.z + dz), v.w(x1, it.z + dz), 1.1 * z, sc(LIN.ember, 0.75 * lineK + 0.2), 0.7);
        }
      }
      break;
    }
    case 'house': {
      if (live <= 0) break;
      const g = ease.outCubic(clamp(live * 1.4));
      const w2 = 11 * it.size, hh = 13 * it.size * g, roof = 9 * it.size * g;
      const L0 = H0(-w2, 0), R0 = H0(w2, 0), L1 = H0(-w2, hh), R1 = H0(w2, hh), Rt = H0(0, hh + roof);
      // dark body so what is behind doesn't show through
      const mid = H0(0, (hh + roof) * 0.45);
      lb.seg2(mid.x, mid.y - 1, mid.x + 0.01, mid.y - 1, Math.max(1, 2 * w2 * zy * 0.95), DARK, 1);
      seg(L0, L1, 1.2 * z, bone, 0.95); seg(R0, R1, 1.2 * z, bone, 0.95); seg(L0, R0, 1.2 * z, bone, 0.95);
      seg(H0(-w2 - 2, hh), Rt, 1.2 * z, bone, 0.95); seg(Rt, H0(w2 + 2, hh), 1.2 * z, bone, 0.95);
      // the window: faintly warm by day, lit at night (not all at once)
      const on = clamp(live * 2 - 1) * clamp(0.22 + st.night * 1.2 - hash(it.seed, 33) * 0.35);
      if (on > 0) {
        const wc = H0(-w2 * 0.3, hh * 0.45);
        lb.seg2(wc.x, wc.y, wc.x + 0.01, wc.y, 5 * zy, sc(LIN.ember, 2.4 * on), 1 * (st.alpha ?? 1));
        if (st.night > 0.3) lb.seg2(wc.x, wc.y, wc.x + 0.01, wc.y, 16 * zy, sc(LIN.ember, 0.5 * on * st.night), 0.35 * (st.alpha ?? 1));
      }
      break;
    }
  }
}

function drawPeople(lb: LineBatch, v: View, st: IslandState, seg: SegFn, lineK: number) {
  const zy = v.cam.zoom, z = v.zw, t = st.t;
  const bone = sc(LIN.bone, lineK);
  const fig = (x: number, zz: number, ph: number, walk: number) => {
    const b = v.w(x, zz);
    if (b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) return;
    const P = (dx: number, h: number) => { const p = v.w(x, zz, h * 1); return { x: p.x + dx * zy * v.c, y: p.y + dx * zy * v.s }; };
    const s = 0.85, sw = Math.sin(ph) * 2.2 * walk;
    seg(P(0, 7 * s), P(0, 12 * s), 1.4 * z, bone, 0.95);
    seg(P(0, 7 * s), P(-sw, 0), 1.2 * z, bone, 0.95); seg(P(0, 7 * s), P(sw, 0), 1.2 * z, bone, 0.95);
    seg(P(0, 11 * s), P(-2.5 - sw * 0.5, 7.5 * s), 1 * z, bone, 0.85); seg(P(0, 11 * s), P(2.5 + sw * 0.5, 7.5 * s), 1 * z, bone, 0.85);
    const hd = P(0, 14 * s);
    lb.seg2(hd.x, hd.y, hd.x + 0.01, hd.y, 3.6 * zy * s, bone, 0.95 * (st.alpha ?? 1));
  };
  for (const p of FIRST_PEOPLE) fig(p.x, p.z, 0, 0);
  // each house brings people: walking near it, some down to the water
  for (const it of ITEMS) {
    if (it.kind !== 'house') continue;
    const live = clamp((st.S - it.k - 0.06) / 0.1);
    if (live <= 0) continue;
    const n = 1 + Math.floor(hash(it.seed, 41) * 2.4);
    for (let k = 0; k < n; k++) {
      if (hash(it.seed, 42 + k) > live) continue;
      const sp = 0.25 + 0.3 * hash(it.seed, 44 + k);
      const u = Math.sin(t * sp + hash(it.seed, 45 + k) * TAU);
      const x = it.x + (0.018 + 0.03 * hash(it.seed, 46 + k)) * u, zz = it.z + 0.02 + 0.03 * hash(it.seed, 47 + k);
      fig(x, zz, t * sp * 9 + k, Math.abs(Math.cos(t * sp + hash(it.seed, 45 + k) * TAU)));
    }
  }
}

/** The plumb line (dashed, fixed) and the world's own axis (tilted with it), from the pivot up, plus the needle. */
export function drawAxes(lb: LineBatch, v: View, t: number, o: { alpha?: number; top?: number; needleTo?: number } = {}) {
  const al = o.alpha ?? 1, z = v.zw, k = v.cam;
  const top = o.top ?? -B - 250;
  const S0 = (x: number, y: number) => ({ x: k.ax + (x - k.fx) * k.zoom, y: k.ay + (y - k.fy) * k.zoom }); // unrotated
  const piv = S0(PIVOT.x, PIVOT.y);
  // the needle the world stands on (fixed, vertical), and its hot point
  const bot = o.needleTo ?? H + 20;
  lb.seg2(piv.x, piv.y + 4, piv.x, bot, 1.6 * z, LIN.bone, 0.8 * al);
  lb.seg2(piv.x, piv.y, piv.x + 0.01, piv.y, 16 * z, sc(LIN.signal, 0.5), 0.4 * al);
  lb.seg2(piv.x, piv.y, piv.x + 0.01, piv.y, 6 * z, sc(LIN.ember, 2.4), 0.95 * al);
  // plumb: dashed vertical above the disc
  for (let y = -B - 10; y > top; y -= 16) {
    const a = S0(0, y), b = S0(0, Math.max(top, y - 8));
    lb.seg2(a.x, a.y, b.x, b.y, 1.1 * z, LIN.ash, 0.75 * al);
  }
  // the world's axis: solid, tilted with it
  const a = v.sp(0, -B - 10), b = v.sp(0, top);
  lb.seg2(a.x, a.y, b.x, b.y, 1.6 * z, sc(LIN.signal, 1.3), 0.95 * al);
  return { top: S0(0, top), tip: b };
}

/** The spirit level standing on the front of the island: the bubble drifts to the high side. */
export function drawLevel(lb: LineBatch, v: View, tilt: number, alpha = 1) {
  const z = v.zw, zy = v.cam.zoom;
  const cx = 0.0, cz = 0.86;
  const base = v.w(cx, cz);
  const P = (dx: number, h: number) => { const p = v.w(cx, cz, h); return { x: p.x + dx * zy * v.c, y: p.y + dx * zy * v.s }; };
  const L = 46, Hh = 9, h0 = 4;
  void base;
  // body (dark), outline
  const c0 = P(0, h0 + Hh / 2);
  lb.seg2(P(-L, h0 + Hh / 2).x, P(-L, h0 + Hh / 2).y, P(L, h0 + Hh / 2).x, P(L, h0 + Hh / 2).y, (Hh + 4) * zy, DARK, alpha);
  const ln = (a: { x: number; y: number }, b: { x: number; y: number }, w: number, c: RGB, k = 1) => lb.seg2(a.x, a.y, b.x, b.y, w, c, k * alpha);
  ln(P(-L, h0), P(L, h0), 1.2 * z, LIN.bone); ln(P(-L, h0 + Hh), P(L, h0 + Hh), 1.2 * z, LIN.bone);
  ln(P(-L, h0), P(-L, h0 + Hh), 1.2 * z, LIN.bone); ln(P(L, h0), P(L, h0 + Hh), 1.2 * z, LIN.bone);
  // centre marks
  ln(P(-7, h0 + 1), P(-7, h0 + Hh - 1), 1 * z, LIN.ash); ln(P(7, h0 + 1), P(7, h0 + Hh - 1), 1 * z, LIN.ash);
  // bubble: one degree moves it well off the marks (to the left, the high side)
  const off = -tilt * 17;
  const bc = P(off, h0 + Hh / 2);
  lb.seg2(bc.x - 5 * zy, bc.y, bc.x + 5 * zy, bc.y, 5.5 * zy, sc(LIN.ember, 1.6), alpha);
  void c0;
}
