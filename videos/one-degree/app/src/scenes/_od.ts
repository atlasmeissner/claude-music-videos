// Shared motifs and helpers for One Degree (see docs/TREATMENT.md):
//  - the DEGREE COUNT: every sung "degree" turns the world by exactly one degree (the plates are rolled by
//    it in post, and many plates carry a small in-world readout of it);
//  - the NEEDLE: a hairline radius from a pivot with a warm tip (seismograph pen, meter needle, clock hand,
//    course line, sun ray);
//  - karaoke typography helpers (kerned line drawing with per-word wipes / reveals).
import type { Lyrics, Line, Word } from '../engine/lyrics';
import { Lyrics as LyricsC, norm } from '../engine/lyrics';
import type { LineBatch } from '../engine/lines';
import { glyphX, font, F, measure, layout, type TextLayout } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, prog, TAU, hash } from '../engine/util';
import type { PostOverrides } from '../engine/scene';

// ------------------------------------------------------------------ the degree count
const degCache = new WeakMap<Lyrics, number[]>();
/** Start times of every sung "degree" (the world turns one degree on each). */
export function degreeTimes(ly: Lyrics): number[] {
  let d = degCache.get(ly);
  if (!d) {
    d = ly.words.filter((w) => norm(w.w) === 'degree').map((w) => w.start);
    degCache.set(ly, d);
  }
  return d;
}
/** Whole degrees turned at t (integer step count). */
export function degreeCount(ly: Lyrics, t: number): number {
  let n = 0;
  for (const s of degreeTimes(ly)) if (s <= t) n++;
  return n;
}
/** Continuous heading in degrees: each step ticks over in ~0.5 s with a small overshoot (a ratchet). */
export function heading(ly: Lyrics, t: number): number {
  let h = 0;
  for (const s of degreeTimes(ly)) {
    if (t <= s) break;
    h += prog(t, s, s + 0.55, (x) => ease.outBack(x, 2.2));
  }
  return h;
}
/** Post overrides for the plate's background. (Revision 2: the world no longer rolls with the degree count —
 *  the frame stays level; kept so plates can pass their background colour.) */
export function rollPost(_ly: Lyrics, _t: number, bg: [number, number, number] = LIN.ink, _k = 1): PostOverrides {
  return { roll: 0, rollBg: bg };
}
/** Format a heading for mono readouts: 007.0° */
export const fmtDeg = (h: number, digits = 1) => `${h < 0 ? '−' : ''}${Math.abs(h).toFixed(digits).padStart(4 + digits, '0')}°`;

// ------------------------------------------------------------------ the needle
/** The needle's warm tip (draw into a 2D additive LineBatch after the shaft). */
export function needleTip(lb: LineBatch, x: number, y: number, t: number, scale = 1, I = 1) {
  const fl = 0.92 + 0.08 * Math.sin(t * 37.1) * Math.sin(t * 23.3);
  const k = I * fl;
  lb.seg2(x, y, x + 0.01, y, 30 * scale, [LIN.signal[0] * 0.35 * k, LIN.signal[1] * 0.35 * k, LIN.signal[2] * 0.35 * k], 0.25);
  lb.seg2(x, y, x + 0.01, y, 11 * scale, [LIN.ember[0] * 2.2 * k, LIN.ember[1] * 2.2 * k, LIN.ember[2] * 2.2 * k], 0.85);
  lb.seg2(x, y, x + 0.01, y, 4.2 * scale, [5 * k, 4.2 * k, 3.2 * k], 1);
}
/** A needle: hairline shaft from (px,py) at angle a (radians, 0 = right, clockwise positive on screen) of length len. Returns the tip. */
export function needle(lb: LineBatch, px: number, py: number, a: number, len: number, t: number, o: { width?: number; shaft?: [number, number, number]; tip?: number; tail?: number } = {}) {
  const x = px + Math.cos(a) * len, y = py + Math.sin(a) * len;
  const sh = o.shaft ?? LIN.bone;
  const tl = o.tail ?? 0;
  lb.seg2(px - Math.cos(a) * tl, py - Math.sin(a) * tl, x, y, o.width ?? 1.4, sh, 0.9);
  // the last stretch of the shaft heats up toward the tip
  const hot = Math.min(len * 0.22, 90);
  for (let i = 0; i < 6; i++) {
    const u0 = 1 - (hot / len) * (1 - i / 6), u1 = 1 - (hot / len) * (1 - (i + 1) / 6);
    const k = (i + 1) / 6;
    lb.seg2(px + Math.cos(a) * len * u0, py + Math.sin(a) * len * u0, px + Math.cos(a) * len * u1, py + Math.sin(a) * len * u1,
      (o.width ?? 1.4) + 0.6 * k, [LIN.signal[0] * 1.6 * k, LIN.signal[1] * 1.6 * k, LIN.signal[2] * 1.6 * k], k);
  }
  if ((o.tip ?? 1) > 0) needleTip(lb, x, y, t, 1, o.tip ?? 1);
  return { x, y };
}
/** A pivot: a small ring with a dot. */
export function pivot(lb: LineBatch, x: number, y: number, r = 7, rgb: [number, number, number] = LIN.bone, a = 0.9) {
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
    lb.seg2(x + Math.cos(a0) * r, y + Math.sin(a0) * r, x + Math.cos(a1) * r, y + Math.sin(a1) * r, 1.2, rgb, a);
  }
  lb.seg2(x, y, x + 0.01, y, 3, rgb, a);
}
/** A hairline circular arc (a0..a1 radians) as segments. */
export function arc(lb: LineBatch, x: number, y: number, r: number, a0: number, a1: number, w: number, rgb: [number, number, number], alpha = 1, segs = 0) {
  const n = segs || Math.max(8, Math.ceil(Math.abs(a1 - a0) * r / 6));
  let px = x + Math.cos(a0) * r, py = y + Math.sin(a0) * r;
  for (let i = 1; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const qx = x + Math.cos(a) * r, qy = y + Math.sin(a) * r;
    lb.seg2(px, py, qx, qy, w, rgb, alpha);
    px = qx; py = qy;
  }
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

/** The heading readout cameo: "↻ 007°" with a tiny dial. */
export function drawHeading(c: CanvasRenderingContext2D, x: number, y: number, h: number, o: { color?: string; hot?: string; scale?: number; label?: string } = {}) {
  const k = o.scale ?? 1;
  const col = o.color ?? rgba('bone', 0.75);
  c.save();
  // dial
  const R = 15 * k, cx = x + R, cy = y - R * 0.65;
  c.strokeStyle = col; c.lineWidth = 1;
  c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.stroke();
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU - Math.PI / 2;
    const r0 = i % 9 === 0 ? R * 0.7 : R * 0.85;
    c.beginPath(); c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke();
  }
  const a = (h * Math.PI) / 180 - Math.PI / 2;
  c.strokeStyle = o.hot ?? rgba('signal', 1); c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R * 1.05, cy + Math.sin(a) * R * 1.05); c.stroke();
  // digits
  c.font = font(F.mono(400), 13 * k);
  c.letterSpacing = `${2 * k}px`;
  c.fillStyle = col;
  c.textBaseline = 'alphabetic';
  c.fillText(o.label ?? 'HEADING', x + R * 2 + 12 * k, y - 16 * k);
  c.font = font(F.mono(500), 20 * k);
  c.fillStyle = o.hot ?? rgba('signal', 1);
  c.fillText(fmtDeg(h), x + R * 2 + 12 * k, y + 4 * k);
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

/** World point that lands on screen point (sx, sy) once the plate is rolled by h degrees (post roll, clockwise about the frame centre). */
export function unroll(sx: number, sy: number, _h: number) {
  return { x: sx, y: sy }; // revision 2: no roll
}

/** Counter-rotate a 2D context against the world's roll (h degrees) so what is drawn next stays level on screen. */
export function levelCtx(_c: CanvasRenderingContext2D, _h: number) {
  // revision 2: the world no longer rolls, so there is nothing to counter-rotate
}

// ------------------------------------------------------------------ the compounding counter (revision 2)
// The song is one year: day 0 on the first sung word, day 365 on the last. Each day compounds by 1%:
// ×1.01^day, 1.00 for a long time, 37.8 at the end (the 1% rule).
export const RATE = 1.01, DAYS = 365;
export const YEAR_GAIN = Math.pow(RATE, DAYS); // 37.78
export function songDay(ly: Lyrics, t: number): number {
  const t0 = ly.lines[0]!.words[0]!.start;
  const last = ly.lines[ly.lines.length - 1]!;
  const t1 = last.words[last.words.length - 1]!.start;
  return clamp((t - t0) / (t1 - t0)) * DAYS;
}
export const gain = (day: number) => Math.pow(RATE, day);
export const fmtGain = (g: number) => `×${g < 10 ? g.toFixed(2) : g.toFixed(1)}`;

/** The compounding readout: a tiny 1.01^n curve over the year with today's point, DAY n and ×gain. */
export function drawCompound(c: CanvasRenderingContext2D, x: number, y: number, t: number, o: { color?: string; hot?: string; ly?: Lyrics; day?: number } = {}) {
  const ly = o.ly ?? CURRENT_LY.ly;
  const day = o.day ?? (ly ? songDay(ly, t) : 0);
  const col = o.color ?? rgba('bone', 0.75), hot = o.hot ?? rgba('signal', 1);
  const w = 120, h = 40, x0 = x, y0 = y;
  c.save();
  // axes
  c.strokeStyle = col; c.globalAlpha = 0.5; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x0, y0 - h - 4); c.lineTo(x0, y0); c.lineTo(x0 + w + 4, y0); c.stroke();
  c.globalAlpha = 1;
  const P = (d: number) => ({ x: x0 + (d / DAYS) * w, y: y0 - ((gain(d) - 1) / (YEAR_GAIN - 1)) * h });
  // the whole year, faint; the days lived, hot
  c.setLineDash([2, 3]); c.strokeStyle = col; c.globalAlpha = 0.35;
  c.beginPath(); for (let d = 0; d <= DAYS; d += 5) { const p = P(d); d ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); } c.stroke();
  c.setLineDash([]); c.globalAlpha = 1; c.strokeStyle = hot; c.lineWidth = 1.6;
  c.beginPath(); for (let d = 0; d <= day; d += 2) { const p = P(d); d ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); } { const p = P(day); c.lineTo(p.x, p.y); } c.stroke();
  const p = P(day);
  c.fillStyle = hot; c.beginPath(); c.arc(p.x, p.y, 2.6, 0, TAU); c.fill();
  // digits
  c.font = font(F.mono(400), 12); c.letterSpacing = '2px'; c.fillStyle = col; c.textBaseline = 'alphabetic';
  c.fillText(`DAY ${String(Math.floor(day)).padStart(3, '0')}`, x0 + w + 18, y0 - 22);
  c.font = font(F.mono(500), 20); c.fillStyle = hot;
  c.fillText(fmtGain(gain(day)), x0 + w + 18, y0);
  c.restore();
}
/** The lyrics of the running engine, for drawCompound when a plate doesn't pass them (set by scenes in init). */
export const CURRENT_LY: { ly: Lyrics | null } = { ly: null };
