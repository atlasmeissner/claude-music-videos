// Helpers shared by the chorus plates (chorus.ts, lopsided.ts): per-word karaoke drawing with
// free transforms, cached layouts, eased piecewise targets, hatching.
import { Lyrics, type Word } from '../engine/lyrics';
import { font, layout, type TextLayout } from '../engine/type';
import { clamp, ease, lerp } from '../engine/util';
import { isKey } from './_kit';

export type C2D = CanvasRenderingContext2D;

const layCache = new Map<string, TextLayout>();
export function lay(text: string, fam: string, size: number, tracking = 0): TextLayout {
  const k = `${text}|${fam}|${size}|${tracking}`;
  let l = layCache.get(k);
  if (!l) { l = layout(text, fam, size, tracking); layCache.set(k, l); }
  return l;
}

export interface WordStyle {
  fam: string;
  size: number;
  /** colour of sung non-key glyphs, key glyphs, unsung glyphs */
  sung: string;
  key: string;
  base: string;
  dim: number;
  tracking?: number;
  /** override key detection */
  keyed?: boolean;
  /** overall alpha */
  alpha?: number;
}

/**
 * Draws one word at (x, y) (left, baseline) with a per-glyph karaoke wipe. Transforms are the caller's.
 * Returns the word's advance width.
 */
export function drawWord(c: C2D, w: Word, t: number, x: number, y: number, s: WordStyle): number {
  const l = lay(w.w, s.fam, s.size, s.tracking ?? 0);
  const p = Lyrics.wordProgress(w, t);
  const key = s.keyed ?? isKey(w);
  const col = key ? s.key : s.sung;
  const A = s.alpha ?? 1;
  if (A <= 0.003) return l.width;
  c.font = font(s.fam, s.size);
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  const nG = l.glyphs.length;
  const sungG = p * nG;
  if (p >= 1) {
    c.globalAlpha = A; c.fillStyle = col;
    if (!s.tracking) c.fillText(w.w, x, y);
    else for (const g of l.glyphs) c.fillText(g.ch, x + g.x, y);
  } else if (p <= 0) {
    c.globalAlpha = A * s.dim; c.fillStyle = s.base;
    if (!s.tracking) c.fillText(w.w, x, y);
    else for (const g of l.glyphs) c.fillText(g.ch, x + g.x, y);
  } else {
    for (const g of l.glyphs) {
      const k = clamp(sungG - g.i);
      if (k >= 1) { c.fillStyle = col; c.globalAlpha = A; }
      else if (k > 0) { c.fillStyle = col; c.globalAlpha = A * lerp(s.dim, 1, k); }
      else { c.fillStyle = s.base; c.globalAlpha = A * s.dim; }
      c.fillText(g.ch, x + g.x, y);
    }
  }
  c.globalAlpha = 1;
  return l.width;
}

/** Word pop: 1 at the word's start, decaying to 0 over `dur`. */
export const popAt = (t: number, t0: number, dur = 0.22) => (t < t0 ? 0 : 1 - ease.outCubic(clamp((t - t0) / dur)));

/**
 * Eased piecewise target: the value retargets at each event time (sorted) to `target(i)` (the value after
 * event i), easing from wherever it was over `dur`. `v0` = value before the first event.
 */
export function chase(t: number, events: number[], target: (i: number) => number, v0: number, dur: number, fn: (x: number) => number = ease.outExpo): number {
  let from = v0, to = v0, ts = -1e9;
  for (let i = 0; i < events.length; i++) {
    const te = events[i]!;
    if (te > t) break;
    const cur = lerp(from, to, fn(clamp((te - ts) / dur)));
    from = cur; to = target(i); ts = te;
  }
  return lerp(from, to, fn(clamp((t - ts) / dur)));
}

/** Diagonal hatch inside a rect (45°), spacing `sp`. */
export function hatchRect(c: C2D, x: number, y: number, w: number, h: number, sp: number, col: string, lw = 1) {
  if (w <= 0.5 || h <= 0.5) return;
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.strokeStyle = col; c.lineWidth = lw;
  c.beginPath();
  const n = Math.ceil((w + h) / sp) + 1;
  const o = ((x + y) % sp + sp) % sp;
  for (let i = 0; i < n; i++) {
    const d = i * sp - o;
    c.moveTo(x + d, y + h); c.lineTo(x + d + h, y);
  }
  c.stroke();
  c.restore();
}

/** First beat time >= t (from the analysed grid). */
export function beatAfter(beats: number[], t: number) { return beats.find((b) => b >= t - 1e-3) ?? t; }
export function nearestOf(list: number[], t: number) {
  let best = list[0] ?? t;
  for (const x of list) if (Math.abs(x - t) < Math.abs(best - t)) best = x;
  return best;
}
