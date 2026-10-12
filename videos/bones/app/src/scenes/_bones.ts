// Shared kit for Bones (see docs/TREATMENT.md):
//  - THE POINT: one vermilion point with a hot core (the builder's first chalk mark), in every plate;
//  - the LEDGER: ASSUMED counts down as things are stripped, PROVEN counts up as the frame is built;
//  - the TITLE BLOCK: each plate is a drawing sheet (D- demolition, S- structure);
//  - the FAÇADE renderer (the inherited building, see _facade.ts), with per-member transforms;
//  - karaoke typography helpers (kerned line drawing with per-word wipes / reveals).
import type { Line, Word, Lyrics } from '../engine/lyrics';
import { Lyrics as LyricsC, norm } from '../engine/lyrics';
import type { LineBatch } from '../engine/lines';
import type { AudioData } from '../engine/audio';
import { glyphX, font, F, measure, layout, type TextLayout } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, prog, TAU, hash } from '../engine/util';
import { FACADE, GRID_X, GRID_XN, GRID_Y, PLAN_COLS, PLAN_DOME, PLAN_WALLS, type Member, type Layer } from './_facade';

type RGB = [number, number, number];

// ------------------------------------------------------------------ the point
/** Where the intro leaves the point (the façade plate stands its building on it). */
export const POINT0 = { x: 960, y: 820 };
/** The point: a vermilion mark with a hot core and a soft halo (draw into a 2D additive LineBatch). */
export function point(lb: LineBatch, x: number, y: number, t: number, scale = 1, I = 1) {
  if (I <= 0) return;
  const fl = 0.93 + 0.07 * Math.sin(t * 31.7) * Math.sin(t * 19.3);
  const k = I * fl;
  lb.seg2(x, y, x + 0.01, y, 44 * scale, [LIN.signal[0] * 0.22 * k, LIN.signal[1] * 0.22 * k, LIN.signal[2] * 0.22 * k], 0.2);
  lb.seg2(x, y, x + 0.01, y, 15 * scale, [LIN.signal[0] * 1.8 * k, LIN.signal[1] * 1.8 * k, LIN.signal[2] * 1.8 * k], 0.85);
  lb.seg2(x, y, x + 0.01, y, 5.5 * scale, [4.6 * k, 3.4 * k, 2.6 * k], 1);
}
/** A ring that expands and fades from (x, y) after time t0 (a struck note, a survey ping). */
export function ring(lb: LineBatch, x: number, y: number, t: number, t0: number, o: { r0?: number; speed?: number; life?: number; rgb?: RGB; w?: number; alpha?: number } = {}) {
  if (t < t0) return;
  const life = o.life ?? 2.5;
  const u = (t - t0) / life;
  if (u >= 1) return;
  const r = (o.r0 ?? 8) + (o.speed ?? 120) * Math.pow(t - t0, 0.7);
  const a = (o.alpha ?? 0.8) * Math.pow(1 - u, 1.6);
  circle(lb, x, y, r, o.w ?? 1.1, o.rgb ?? LIN.bone, a);
}
export function circle(lb: LineBatch, x: number, y: number, r: number, w: number, rgb: RGB, alpha = 1, a0 = 0, a1 = TAU) {
  const n = Math.max(12, Math.ceil(Math.abs(a1 - a0) * r / 7));
  let px = x + Math.cos(a0) * r, py = y + Math.sin(a0) * r;
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const qx = x + Math.cos(a) * r, qy = y + Math.sin(a) * r;
    lb.seg2(px, py, qx, qy, w, rgb, alpha);
    px = qx; py = qy;
  }
}
/** The point on paper (Canvas2D, for bone-paper plates where additive light would wash out). */
export function pointPaper(c: CanvasRenderingContext2D, x: number, y: number, t: number, scale = 1, I = 1) {
  if (I <= 0) return;
  const fl = 0.95 + 0.05 * Math.sin(t * 31.7);
  c.save();
  c.globalAlpha *= I;
  const g = c.createRadialGradient(x, y, 0, x, y, 26 * scale);
  g.addColorStop(0, rgba('signal', 0.45 * fl)); g.addColorStop(1, rgba('signal', 0));
  c.fillStyle = g; c.beginPath(); c.arc(x, y, 26 * scale, 0, TAU); c.fill();
  c.fillStyle = rgba('signal', 1); c.beginPath(); c.arc(x, y, 6.5 * scale, 0, TAU); c.fill();
  c.fillStyle = rgba('ember', 1); c.beginPath(); c.arc(x, y, 2.6 * scale, 0, TAU); c.fill();
  c.restore();
}
export const scaleRGB = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

// ------------------------------------------------------------------ the ledger
const START_ASSUMED = 1214;
interface LedgerEv { t: number; d: number }
const ledgerCache = new WeakMap<Lyrics, { assumed: LedgerEv[]; proven: LedgerEv[] }>();
function wordsOf(ly: Lyrics, w: string) { return ly.words.filter((x) => norm(x.w) === w); }
/**
 * ASSUMED: 1,214 at the start; every bend, every "never mine", every strip of gold and stone and every burnt
 * blueprint takes a chunk; the bridge's "saw" takes the rest (0). PROVEN: the bedrock ("feet") is the first
 * proven fact; then every "Build", and from chorus 3 on every beat adds one member (the construction).
 */
function ledger(ly: Lyrics, au: AudioData) {
  let L = ledgerCache.get(ly);
  if (L) return L;
  const as: LedgerEv[] = [];
  const at = (w: Word | undefined, d: number) => { if (w) as.push({ t: w.start, d }); };
  at(wordsOf(ly, 'bends')[0], -14);
  at(wordsOf(ly, 'everything')[0], -6);
  at(wordsOf(ly, 'never')[0], -48); at(wordsOf(ly, 'mine')[0], -71); at(wordsOf(ly, 'hold')[0], -95);
  for (const w of wordsOf(ly, 'strip')) at(w, -23);
  for (const w of wordsOf(ly, 'gold')) at(w, -61);
  for (const w of wordsOf(ly, 'stone')) at(w, -44);
  for (const w of wordsOf(ly, 'shown')) at(w, -37);
  at(wordsOf(ly, 'borrowed')[0], -29); at(wordsOf(ly, 'guess')[0], -33);
  const burning = wordsOf(ly, 'burning')[0];
  if (burning) for (let i = 0; i < 12; i++) as.push({ t: burning.start + i * 0.29, d: -11 });
  as.sort((a, b) => a.t - b.t);
  const saw = wordsOf(ly, 'saw')[0];
  if (saw) {
    // everything up to "finally saw" counts; the rest goes at once, and nothing is assumed after it
    const before = as.filter((e) => e.t < saw.start);
    as.length = 0; as.push(...before);
    as.push({ t: saw.start, d: -(START_ASSUMED + before.reduce((s, e) => s + e.d, 0)) });
  }
  const pr: LedgerEv[] = [];
  const feet = wordsOf(ly, 'feet')[0];
  if (feet) pr.push({ t: feet.start, d: 1 });
  for (const w of wordsOf(ly, 'build')) pr.push({ t: w.start, d: 1 });
  const c3 = au.sections.find((s) => s.name === 'chorus3');
  const br = au.sections.find((s) => s.name === 'bridge');
  const fin = au.sections.find((s) => s.name === 'final');
  const end = au.sections.find((s) => s.name === 'outro');
  for (const b of au.beats) {
    if (c3 && br && b >= c3.start && b < br.start) pr.push({ t: b, d: 1 });
    if (fin && end && b >= fin.start && b < end.start - 6) pr.push({ t: b, d: 1 });
  }
  pr.sort((a, b) => a.t - b.t);
  L = { assumed: as, proven: pr };
  ledgerCache.set(ly, L);
  return L;
}
const sumTo = (ev: LedgerEv[], t: number) => { let s = 0; for (const e of ev) { if (e.t > t) break; s += e.d; } return s; };
const lastEv = (ev: LedgerEv[], t: number) => { let b = -1e9; for (const e of ev) { if (e.t > t) break; b = e.t; } return b; };
export const assumed = (ly: Lyrics, au: AudioData, t: number) => START_ASSUMED + sumTo(ledger(ly, au).assumed, t);
export const proven = (ly: Lyrics, au: AudioData, t: number) => sumTo(ledger(ly, au).proven, t);
/** The ledger readout: two mono rows; a row flashes signal when it changes. */
export function drawLedger(c: CanvasRenderingContext2D, ly: Lyrics, au: AudioData, x: number, y: number, t: number, o: { paper?: boolean; alpha?: number } = {}) {
  const L = ledger(ly, au);
  const ink = o.paper ? 'ink' : 'bone';
  c.save();
  c.globalAlpha *= o.alpha ?? 1;
  const row = (label: string, v: number, last: number, yy: number) => {
    const hot = clamp(1 - (t - last) / 0.6);
    mono(c, label, x, yy, { size: 12, color: rgba(o.paper ? 'graphite' : 'ash', 0.95), track: 3 });
    mono(c, v.toLocaleString('en-US'), x + 112, yy, { size: 15, weight: 500, color: hot > 0 ? mixCss(rgba('signal', 1), rgba(ink, 0.9), 1 - hot) : rgba(ink, 0.9), track: 2 });
  };
  row('ASSUMED', START_ASSUMED + sumTo(L.assumed, t), lastEv(L.assumed, t), y);
  row('PROVEN', sumTo(L.proven, t), lastEv(L.proven, t), y + 24);
  c.restore();
}

// ------------------------------------------------------------------ the title block
/** A drawing sheet's title block (bottom right): sheet number, title, two deadpan fields. */
export function titleBlock(c: CanvasRenderingContext2D, sheet: string, title: string, rows: [string, string][], o: { paper?: boolean; alpha?: number; x?: number; y?: number } = {}) {
  const x = o.x ?? 1920 - 96 - 330, y = o.y ?? 1080 - 64 - 30 - rows.length * 20;
  const ink = o.paper ? 'ink' : 'bone';
  c.save();
  c.globalAlpha *= o.alpha ?? 1;
  const h = 34 + rows.length * 20;
  c.strokeStyle = rgba(ink, 0.55); c.lineWidth = 1;
  c.strokeRect(x, y, 330, h);
  c.beginPath(); c.moveTo(x + 86, y); c.lineTo(x + 86, y + 30); c.moveTo(x, y + 30); c.lineTo(x + 330, y + 30); c.stroke();
  mono(c, sheet, x + 10, y + 21, { size: 13, weight: 600, color: rgba('signal', 1), track: 2 });
  mono(c, title, x + 98, y + 20, { size: 11, color: rgba(ink, 0.9), track: 2.5 });
  rows.forEach(([k, v], i) => {
    mono(c, k, x + 10, y + 48 + i * 20, { size: 10, color: rgba(o.paper ? 'graphite' : 'ash', 0.9), track: 2 });
    mono(c, v, x + 118, y + 48 + i * 20, { size: 10, color: rgba(ink, 0.85), track: 2 });
  });
  c.restore();
}

// ------------------------------------------------------------------ the façade
export interface FacadeView {
  /** screen position of the façade origin (ground line, centre) and scale */
  ox: number; oy: number; s: number;
  /** per-layer alpha (0 hides) and colour */
  alpha?: Partial<Record<Layer, number>>;
  rgb?: Partial<Record<Layer, RGB>>;
  /** per-layer width multiplier */
  wk?: Partial<Record<Layer, number>>;
  /**
   * Optional per-member transform: return [dx, dy, rot (radians, about the group centroid), alpha] in façade
   * units, or null to skip the member.
   */
  xf?: (m: Member, i: number) => [number, number, number, number] | null;
  /** Optional point warp in screen space (after the view transform). */
  warp?: (x: number, y: number) => [number, number];
}
export const LAYER_RGB: Record<Layer, RGB> = { gold: LIN.gold, stone: LIN.bone, frame: LIN.bone, found: LIN.bone };
export function drawFacade(lb: LineBatch, v: FacadeView) {
  const A = { gold: 1, stone: 0.72, frame: 0, found: 0.8, ...(v.alpha ?? {}) };
  const C = { ...LAYER_RGB, ...(v.rgb ?? {}) };
  const WK = { gold: 1, stone: 1, frame: 1, found: 1, ...(v.wk ?? {}) };
  FACADE.forEach((m, i) => {
    const la = A[m.layer];
    if (la <= 0) return;
    let dx = 0, dy = 0, rot = 0, al = 1;
    if (v.xf) { const r = v.xf(m, i); if (!r) return; [dx, dy, rot, al] = r; }
    const a = la * al;
    if (a <= 0.002) return;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    let px = 0, py = 0;
    for (let k = 0; k < m.pts.length; k++) {
      let [x, y] = m.pts[k]!;
      if (rot !== 0) { const rx = x - m.cx, ry = y - m.cy; x = m.cx + rx * cs - ry * sn; y = m.cy + rx * sn + ry * cs; }
      let X = v.ox + (x + dx) * v.s, Y = v.oy + (y + dy) * v.s;
      if (v.warp) [X, Y] = v.warp(X, Y);
      const wd = m.w * WK[m.layer] * Math.max(0.6, Math.min(1.4, v.s));
      if (k > 0) {
        if (v.warp) {
          // subdivide so long members bend with the warp
          const [x0, y0] = m.pts[k - 1]!;
          let ux = x0, uy = y0;
          if (rot !== 0) { const rx = x0 - m.cx, ry = y0 - m.cy; ux = m.cx + rx * cs - ry * sn; uy = m.cy + rx * sn + ry * cs; }
          const n = Math.max(1, Math.ceil(Math.hypot(x - ux, y - uy) * v.s / 24));
          let qx = px, qy = py;
          for (let j = 1; j <= n; j++) {
            const f = j / n;
            const [rx, ry] = v.warp(v.ox + (ux + (x - ux) * f + dx) * v.s, v.oy + (uy + (y - uy) * f + dy) * v.s);
            lb.seg2(qx, qy, rx, ry, wd, C[m.layer], a);
            qx = rx; qy = ry;
          }
        } else lb.seg2(px, py, X, Y, wd, C[m.layer], a);
      }
      px = X; py = Y;
    }
  });
}

// ------------------------------------------------------------------ the plan
export interface PlanView {
  ox: number; oy: number; s: number;
  /** ink colour (css) for walls and lines; grid colour */
  ink?: string; gridInk?: string;
  /** 0..1 draw-on progress (walls fill in order, grid draws first) */
  p?: number;
  alpha?: number;
  /** show the grid bubbles and labels */
  grid?: boolean;
}
/** The building's plan in Canvas2D: grid axes with bubbles, poché walls (hatched), columns, the dome overhead. */
export function drawPlan(c: CanvasRenderingContext2D, v: PlanView) {
  const ink = v.ink ?? rgba('bone', 0.9), gink = v.gridInk ?? rgba('ash', 0.5);
  const p = v.p ?? 1;
  const X = (x: number) => v.ox + x * v.s, Y = (y: number) => v.oy + y * v.s;
  c.save();
  c.globalAlpha *= v.alpha ?? 1;
  // grid
  if (v.grid !== false) {
    const gp = clamp(p * 3);
    c.strokeStyle = gink; c.lineWidth = 0.8; c.setLineDash([14, 5, 3, 5]);
    GRID_X.forEach((x, i) => {
      const k = clamp(gp * 1.3 - i * 0.03);
      if (k <= 0) return;
      c.beginPath(); c.moveTo(X(x), Y(-90)); c.lineTo(X(x), Y(-90 + 760 * k)); c.stroke();
    });
    GRID_Y.forEach((y, i) => {
      const k = clamp(gp * 1.3 - i * 0.05);
      if (k <= 0) return;
      c.beginPath(); c.moveTo(X(-850), Y(y)); c.lineTo(X(-850 + 1700 * k), Y(y)); c.stroke();
    });
    c.setLineDash([]);
    const bub = (x: number, y: number, label: string, k: number) => {
      if (k <= 0) return;
      c.save(); c.globalAlpha *= k;
      c.strokeStyle = gink; c.lineWidth = 1;
      c.beginPath(); c.arc(x, y, 11, 0, TAU); c.stroke();
      c.font = font(F.mono(500), 11); c.fillStyle = gink; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(label, x, y + 0.5);
      c.restore();
    };
    GRID_X.forEach((x, i) => bub(X(x), Y(-90) - 12, GRID_XN[i]!, clamp(gp * 2 - 1)));
    GRID_Y.forEach((y, i) => bub(X(-850) - 12, Y(y), String(i + 1), clamp(gp * 2 - 1)));
  }
  // walls: poché with a 45° hatch
  const wp = clamp((p - 0.15) / 0.6);
  c.strokeStyle = ink; c.lineWidth = 1.1;
  PLAN_WALLS.forEach((w, i) => {
    const k = clamp(wp * PLAN_WALLS.length * 0.35 - i * 0.35);
    if (k <= 0) return;
    const [x0, y0, x1, y1] = w;
    const ax = X(x0), ay = Y(y0), bx = X(x0 + (x1 - x0) * (x1 - x0 > y1 - y0 ? k : 1)), by = Y(y0 + (y1 - y0) * (y1 - y0 >= x1 - x0 ? k : 1));
    c.strokeRect(ax, ay, bx - ax, by - ay);
    c.save(); c.beginPath(); c.rect(ax, ay, bx - ax, by - ay); c.clip();
    c.lineWidth = 0.7; c.beginPath();
    for (let d = -(by - ay); d < bx - ax; d += 5) { c.moveTo(ax + d, by); c.lineTo(ax + d + (by - ay), ay); }
    c.stroke(); c.restore();
  });
  // columns, steps, dome overhead (dashed)
  const cp = clamp((p - 0.55) / 0.3);
  if (cp > 0) {
    c.save(); c.globalAlpha *= cp;
    for (const [x, y] of PLAN_COLS) { c.beginPath(); c.arc(X(x), Y(y), 25 * v.s, 0, TAU); c.fillStyle = ink; c.fill(); }
    c.lineWidth = 1;
    for (const y of [-12, -24]) { c.beginPath(); c.moveTo(X(-470), Y(y)); c.lineTo(X(470), Y(y)); c.stroke(); }
    c.setLineDash([6, 5]);
    c.beginPath(); c.arc(X(PLAN_DOME.x), Y(PLAN_DOME.y), PLAN_DOME.r * v.s, 0, TAU); c.stroke();
    c.beginPath(); c.arc(X(PLAN_DOME.x), Y(PLAN_DOME.y), (PLAN_DOME.r - 17) * v.s, 0, TAU); c.stroke();
    c.setLineDash([]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + TAU / 16, r = (PLAN_DOME.r - 8) * v.s;
      c.fillStyle = ink; c.fillRect(X(PLAN_DOME.x) + Math.cos(a) * r - 7 * v.s, Y(PLAN_DOME.y) + Math.sin(a) * r - 7 * v.s, 14 * v.s, 14 * v.s);
    }
    c.restore();
  }
  c.restore();
}

// ------------------------------------------------------------------ typography
export interface WordBox { w: Word; i0: number; i1: number; x0: number; x1: number }
/** Kerned x extents of each word of a line set as one string (relative to the line's origin). */
export function wordBoxes(line: Line, family: string, size: number, tracking = 0, text = line.text): WordBox[] {
  const out: WordBox[] = [];
  let from = 0;
  for (const w of line.words) {
    const i0 = text.indexOf(w.w, from);
    const i1 = i0 + w.w.length;
    from = i1;
    out.push({ w, i0, i1, x0: glyphX(text, i0, family, size, tracking), x1: glyphX(text, i0, family, size, tracking) + measure(w.w, family, size, tracking) });
  }
  return out;
}

export interface KaraokeStyle {
  family: string;
  size: number;
  tracking?: number;
  /** colour of sung text */
  sung: string;
  /** colour of not-yet-sung text (shown from `lead` seconds before the line) — '' = hidden until sung */
  unsung: string;
  /** colour of the word being sung (blends to `sung` after it ends) */
  active?: string;
  /** anticipation: unsung words show this long before the line starts */
  lead?: number;
  /** 'wipe': per-word left-to-right wipe; 'reveal': each word fades/rises in at its start */
  mode?: 'wipe' | 'reveal';
  align?: 'left' | 'center' | 'right';
  /** override the displayed text (must contain the words in order) */
  text?: string;
}

/** Draw a lyric line at (x, baseline y) with karaoke progress at t. Returns the line's width. */
export function drawKaraoke(c: CanvasRenderingContext2D, line: Line, x: number, y: number, t: number, s: KaraokeStyle): number {
  const text = s.text ?? line.text;
  const tr = s.tracking ?? 0;
  const wTot = measure(text, s.family, s.size, tr);
  const ox = s.align === 'center' ? x - wTot / 2 : s.align === 'right' ? x - wTot : x;
  const boxes = wordBoxes(line, s.family, s.size, tr, text);
  c.save();
  c.font = font(s.family, s.size);
  c.letterSpacing = `${tr}px`;
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  const lead = s.lead ?? 0.35;
  const mode = s.mode ?? 'wipe';
  const showUnsung = !!s.unsung && t > line.start - lead;
  const ua = showUnsung ? clamp((t - (line.start - lead)) / 0.25) : 0;
  const top = y - s.size * 1.3, hgt = s.size * 1.9, pad = s.size * 0.14;
  const clipDraw = (x0: number, x1: number, col: string, alpha = 1, dy = 0) => {
    if (x1 <= x0 || alpha <= 0) return;
    c.save();
    c.globalAlpha *= alpha;
    c.beginPath(); c.rect(ox + x0, top, x1 - x0, hgt); c.clip();
    c.fillStyle = col;
    c.fillText(text, ox, y + dy);
    c.restore();
  };
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]!;
    // each word owns [its x0 - pad, next word's x0 - pad): spaces go with the word before them
    const xa = b.x0 - pad, xb = i + 1 < boxes.length ? boxes[i + 1]!.x0 - pad : b.x1 + pad * 2;
    const p = LyricsC.wordProgress(b.w, t);
    const col = s.active && t < b.w.end + 0.3 ? mixCss(s.active, s.sung, clamp((t - b.w.end) / 0.3)) : s.sung;
    if (t < b.w.start) { if (showUnsung) clipDraw(xa, xb, s.unsung, ua); continue; }
    if (mode === 'wipe') {
      const xw = p >= 1 ? xb : b.x0 + (b.x1 - b.x0) * Math.min(1, p * 1.1);
      clipDraw(xa, xw, col);
      if (showUnsung) clipDraw(xw, xb, s.unsung, ua);
    } else {
      const k = ease.outCubic(clamp((t - b.w.start) / 0.14));
      if (showUnsung && k < 1) clipDraw(xa, xb, s.unsung, ua * (1 - k));
      clipDraw(xa, xb, col, k, (1 - k) * s.size * 0.12);
    }
  }
  c.restore();
  return wTot;
}

/** Linear blend of two CSS rgba()/hex colours (sRGB space; fine for short highlight fades). */
export function mixCss(a: string, b: string, k: number): string {
  const pa = parseCss(a), pb = parseCss(b);
  const m = (i: number) => pa[i]! + (pb[i]! - pa[i]!) * k;
  return `rgba(${m(0).toFixed(0)},${m(1).toFixed(0)},${m(2).toFixed(0)},${m(3).toFixed(3)})`;
}
function parseCss(s: string): number[] {
  if (s.startsWith('#')) { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; }
  const m = s.match(/[\d.]+/g)!.map(Number);
  return [m[0]!, m[1]!, m[2]!, m[3] ?? 1];
}

/** Mono annotation (IBM Plex Mono, tracked caps). */
export function mono(c: CanvasRenderingContext2D, text: string, x: number, y: number, o: { size?: number; color?: string; align?: CanvasTextAlign; track?: number; weight?: number } = {}) {
  c.save();
  c.font = font(F.mono(o.weight ?? 400), o.size ?? 13);
  c.letterSpacing = `${o.track ?? 2}px`;
  c.textAlign = o.align ?? 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = o.color ?? rgba('ash', 0.85);
  c.fillText(text, x, y);
  c.restore();
}

/** Deterministic small jitter for hand-made marks. */
export const jit = (i: number, seed: number, amp: number) => (hash(i, seed) - 0.5) * 2 * amp;

/** Degrees -> radians. */
export const rad = (d: number) => (d * Math.PI) / 180;

// ------------------------------------------------------------------ text on an arc
const layoutCache = new Map<string, TextLayout>();
export function cachedLayout(text: string, family: string, size: number, tracking = 0): TextLayout {
  const key = `${text}|${family}|${size}|${tracking}`;
  let l = layoutCache.get(key);
  if (!l) { l = layout(text, family, size, tracking); layoutCache.set(key, l); }
  return l;
}
/**
 * A lyric line along a circular arc: centre (cx, cy), baseline radius r, centred on angle a0 (radians, screen,
 * clockwise). Glyphs stand upright outward (or inward with `inside`). Per-glyph karaoke: a glyph turns sung when
 * its word's progress passes it; the word being sung is `active`.
 */
export function drawArcKaraoke(c: CanvasRenderingContext2D, line: Line, cx: number, cy: number, r: number, a0: number, t: number, s: KaraokeStyle & { inside?: boolean; alpha?: number }) {
  const text = s.text ?? line.text;
  const tr = s.tracking ?? 0;
  const L = cachedLayout(text, s.family, s.size, tr);
  const boxes = wordBoxes(line, s.family, s.size, tr, text);
  const dir = s.inside ? -1 : 1;
  const span = L.width / r;
  const lead = s.lead ?? 0.35;
  const ua = s.unsung && t > line.start - lead ? clamp((t - (line.start - lead)) / 0.25) : 0;
  c.save();
  c.font = font(s.family, s.size);
  c.letterSpacing = '0px';
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  for (const g of L.glyphs) {
    if (g.ch === ' ') continue;
    const b = boxes.find((x) => g.i >= x.i0 && g.i < x.i1);
    let col = s.unsung, al = ua;
    if (b) {
      const p = LyricsC.wordProgress(b.w, t);
      const fr = (g.i - b.i0 + 0.5) / (b.i1 - b.i0);
      if (t >= b.w.start && p >= fr * 0.9) {
        col = s.active && t < b.w.end + 0.3 ? mixCss(s.active, s.sung, clamp((t - b.w.end) / 0.3)) : s.sung;
        al = 1;
      }
    }
    if (!col || al <= 0) continue;
    const a = a0 + dir * (-span / 2 + (g.x + g.w / 2) / r);
    c.save();
    c.globalAlpha *= al * (s.alpha ?? 1);
    c.fillStyle = col;
    c.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    c.rotate(a + dir * Math.PI / 2);
    c.fillText(g.ch, -g.w / 2, 0);
    c.restore();
  }
  c.restore();
}


// ------------------------------------------------------------------ word-flow and warped lines
export interface FlowWord { family?: string; size?: number; tracking?: number; dy?: number; alpha?: number; color?: string }
/**
 * Words of a line laid out left to right (each word drawn as its own string, so a word can change width,
 * weight or size while it is sung). Unsung words: `unsung` colour (or hidden); sung: wipe; active: signal.
 * Returns the total width.
 */
export function drawFlow(c: CanvasRenderingContext2D, line: Line, x: number, y: number, t: number, s: KaraokeStyle, per?: (w: Word, i: number) => FlowWord, measureOnly = false): number {
  const lead = s.lead ?? 0.35;
  const ua = s.unsung && t > line.start - lead ? clamp((t - (line.start - lead)) / 0.25) : 0;
  const items = line.words.map((w, i) => {
    const o = per?.(w, i) ?? {};
    const fam = o.family ?? s.family, size = o.size ?? s.size, tr = o.tracking ?? s.tracking ?? 0;
    return { w, o, fam, size, tr, wd: measure(w.w, fam, size, tr) };
  });
  const gap = s.size * 0.25;
  const total = items.reduce((a, it) => a + it.wd, 0) + gap * (items.length - 1);
  if (measureOnly) return total;
  let cx = s.align === 'center' ? x - total / 2 : s.align === 'right' ? x - total : x;
  c.save();
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  for (const it of items) {
    const { w, o, fam, size, tr, wd } = it;
    c.font = font(fam, size); c.letterSpacing = `${tr}px`;
    const yy = y + (o.dy ?? 0);
    const al = o.alpha ?? 1;
    const p = LyricsC.wordProgress(w, t);
    const draw = (col: string, a: number, x0: number, x1: number, dy = 0) => {
      if (a <= 0 || x1 <= x0) return;
      c.save(); c.globalAlpha *= a * al;
      c.beginPath(); c.rect(x0, yy - size * 1.3, x1 - x0, size * 1.9); c.clip();
      c.fillStyle = col; c.fillText(w.w, cx, yy + dy); c.restore();
    };
    const col = o.color ?? (s.active && t < w.end + 0.3 ? mixCss(s.active, s.sung, clamp((t - w.end) / 0.3)) : s.sung);
    if (t < w.start) { if (s.unsung) draw(s.unsung, ua, cx - 4, cx + wd + gap); }
    else if ((s.mode ?? 'wipe') === 'wipe') {
      const xw = p >= 1 ? cx + wd + gap : cx + wd * Math.min(1, p * 1.1);
      draw(col, 1, cx - 4, xw);
      if (s.unsung) draw(s.unsung, ua, xw, cx + wd + gap);
    } else {
      const k = ease.outCubic(clamp((t - w.start) / 0.14));
      if (s.unsung && k < 1) draw(s.unsung, ua * (1 - k), cx - 4, cx + wd + gap);
      draw(col, k, cx - 4, cx + wd + gap, (1 - k) * size * 0.12);
    }
    cx += wd + gap;
  }
  c.restore();
  return total;
}

/**
 * A lyric line set glyph by glyph along a warped baseline: each glyph's baseline point (x + gx, y) goes through
 * `warp` (screen space) and the glyph turns with the warped baseline's tangent. Per-glyph karaoke like drawArcKaraoke.
 */
export function drawWarpedLine(c: CanvasRenderingContext2D, line: Line, x: number, y: number, t: number, s: KaraokeStyle, warp: (x: number, y: number) => [number, number]) {
  const text = s.text ?? line.text;
  const tr = s.tracking ?? 0;
  const L = cachedLayout(text, s.family, s.size, tr);
  const boxes = wordBoxes(line, s.family, s.size, tr, text);
  const lead = s.lead ?? 0.35;
  const ua = s.unsung && t > line.start - lead ? clamp((t - (line.start - lead)) / 0.25) : 0;
  const ox = s.align === 'center' ? x - L.width / 2 : s.align === 'right' ? x - L.width : x;
  c.save();
  c.font = font(s.family, s.size); c.letterSpacing = '0px'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  for (const g of L.glyphs) {
    if (g.ch === ' ') continue;
    const b = boxes.find((q) => g.i >= q.i0 && g.i < q.i1);
    let col = s.unsung, al = ua;
    if (b) {
      const p = LyricsC.wordProgress(b.w, t);
      const fr = (g.i - b.i0 + 0.5) / (b.i1 - b.i0);
      if (t >= b.w.start && p >= fr * 0.9) { col = s.active && t < b.w.end + 0.3 ? mixCss(s.active, s.sung, clamp((t - b.w.end) / 0.3)) : s.sung; al = 1; }
    }
    if (!col || al <= 0) continue;
    const gx = ox + g.x, gc = gx + g.w / 2;
    const [ax, ay] = warp(gx, y), [bx, by] = warp(gx + Math.max(1, g.w), y), [cx2, cy2] = warp(gc, y);
    void cx2; void cy2;
    const ang = Math.atan2(by - ay, bx - ax);
    c.save(); c.globalAlpha *= al; c.fillStyle = col;
    c.translate(ax, ay); c.rotate(ang); c.fillText(g.ch, 0, 0);
    c.restore();
  }
  c.restore();
}

// ------------------------------------------------------------------ chorus slams
export interface SlamRow { words: Word[]; x: number; y: number; align?: 'left' | 'right' | 'center' }
export interface SlamStyle {
  family: string; size: number; tracking?: number; upper?: boolean;
  /** colour of a word once sung (default bone), and while being sung (default signal) */
  base?: string; hot?: string;
  /** per-word override: offset (px), rotation (rad), alpha, colour */
  xf?: (w: Word) => { dx?: number; dy?: number; rot?: number; alpha?: number; color?: string } | null;
  /** show unsung words ghosted at this alpha (0 = hidden until sung) */
  ghost?: number;
}
/** Chorus type: each word slams in on its start (overshoot scale), hot while sung, cooling to base. */
export function slamRows(c: CanvasRenderingContext2D, rows: SlamRow[], t: number, s: SlamStyle) {
  const tr = s.tracking ?? 0;
  c.save();
  c.font = font(s.family, s.size); c.letterSpacing = `${tr}px`; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  for (const r of rows) {
    const txt = r.words.map((w) => (s.upper ? w.w.toUpperCase() : w.w));
    const gap = s.size * 0.24;
    const widths = txt.map((x) => measure(x, s.family, s.size, tr));
    const total = widths.reduce((a, b) => a + b, 0) + gap * (txt.length - 1);
    let x = r.align === 'right' ? r.x - total : r.align === 'center' ? r.x - total / 2 : r.x;
    r.words.forEach((w, i) => {
      const wd = widths[i]!;
      const k = prog(t, w.start - 0.03, w.start + 0.12, ease.outCubic);
      const o = s.xf?.(w) ?? {};
      if (o === null) { x += wd + gap; return; }
      const ghost = s.ghost ?? 0;
      const a = Math.max(k, t < w.start ? ghost : 0) * (o.alpha ?? 1);
      if (a > 0.001) {
        const hot = t >= w.start ? clamp(1 - (t - w.end - 0.05) / 0.35) : 0;
        const col = o.color ?? (k < 1e-3 ? rgba('bone', 1) : hot > 0 ? mixCss(s.base ?? rgba('bone', 1), s.hot ?? rgba('signal', 1), hot) : s.base ?? rgba('bone', 1));
        const sc = t >= w.start ? 1 + (1 - k) * 0.14 : 1;
        c.save();
        c.translate(x + wd / 2 + (o.dx ?? 0), r.y + (o.dy ?? 0));
        if (o.rot) c.rotate(o.rot);
        c.scale(sc, sc);
        c.globalAlpha *= a;
        c.fillStyle = col;
        c.fillText(txt[i]!, -wd / 2, 0);
        c.restore();
      }
      x += wd + gap;
    });
  }
  c.restore();
}

/** Gravity drop for a member/word released at tr: [dy, rot, alpha]. */
export function drop(t: number, tr: number, r: number, g = 2600, life = 1.3): [number, number, number] {
  if (t <= tr) return [0, 0, 1];
  const u = t - tr;
  return [0.5 * g * u * u + 40 * u * (r - 0.3), (r - 0.5) * 2.4 * u, clamp(1 - u / life)];
}

/** A soft dark band behind type laid over line drawings (top of frame by default). */
export function shadeBand(c: CanvasRenderingContext2D, y0: number, y1: number, a = 0.7) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba('ink', a)); g.addColorStop(0.6, rgba('ink', a * 0.6)); g.addColorStop(1, rgba('ink', 0));
  c.save(); c.fillStyle = g; c.fillRect(0, y0, 1920, y1 - y0); c.restore();
}
