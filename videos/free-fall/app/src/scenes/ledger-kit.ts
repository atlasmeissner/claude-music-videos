// Helpers shared by the verse-1 / pre-chorus plates (ledger, cliff, payoff):
//  - karaokeRows: a lyric line set over several rows (explicit word ranges), per-word reveal, kerned within a row;
//  - dimV / witness: architect-style dimension lines (arrowheads, witness lines, the label in a gap), drawn on;
//  - stamp: a rubber stamp (rounded box, tracked mono caps) that slams on.
import type { Line, Word } from '../engine/lyrics';
import { F, font, glyphX, measure } from '../engine/type';
import { rgba } from '../engine/palette';
import { clamp, ease } from '../engine/util';
import { mixCss } from './_ff';

export interface RowsStyle {
  family: string;
  size: number;
  tracking?: number;
  lineH: number;
  /** colour of a sung word (after it cools) */
  sung: string;
  /** colour while the word is sung */
  active: string;
  /** colour of not-yet-sung words ('' = hidden until sung) */
  unsung: string;
  /** unsung words show this long before the line's first word */
  lead?: number;
  align?: 'left' | 'center' | 'right';
  /** cooling time after the word ends (s) */
  cool?: number;
  /** per-word punch scale on entry (0 = none) */
  punch?: number;
  /** overall alpha */
  alpha?: number;
  /** words to skip (drawn elsewhere) */
  skip?: number[];
}

/** Draw `line` over rows given as word-index ranges [[0, 3], [3, 8]] (end exclusive) at (x, first baseline y). */
export function karaokeRows(c: CanvasRenderingContext2D, line: Line, rows: [number, number][], x: number, y: number, t: number, s: RowsStyle) {
  const tr = s.tracking ?? 0;
  const lead = s.lead ?? 0.4;
  const t0 = line.words[0]!.start;
  const ua = s.unsung && t > t0 - lead ? clamp((t - (t0 - lead)) / 0.2) : 0;
  const cool = s.cool ?? 0.35;
  c.save();
  c.globalAlpha *= s.alpha ?? 1;
  c.font = font(s.family, s.size);
  c.letterSpacing = `${tr}px`;
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  rows.forEach(([a, b], r) => {
    const words = line.words.slice(a, b);
    const text = words.map((w) => w.w).join(' ');
    const wTot = measure(text, s.family, s.size, tr);
    const ox = s.align === 'center' ? x - wTot / 2 : s.align === 'right' ? x - wTot : x;
    const by = y + r * s.lineH;
    let ci = 0;
    words.forEach((w, j) => {
      const idx = a + j;
      const wx = ox + glyphX(text, ci, s.family, s.size, tr);
      ci += w.w.length + 1;
      if (s.skip?.includes(idx)) return;
      drawWord(c, w, wx, by, t, s, ua, cool);
    });
  });
  c.restore();
}

function drawWord(c: CanvasRenderingContext2D, w: Word, x: number, y: number, t: number, s: RowsStyle, ua: number, cool: number) {
  if (t < w.start) {
    if (ua > 0) { c.save(); c.globalAlpha *= ua; c.fillStyle = s.unsung; c.fillText(w.w, x, y); c.restore(); }
    return;
  }
  const k = ease.outCubic(clamp((t - w.start) / 0.12));
  const col = t < w.end ? s.active : mixCss(s.active, s.sung, clamp((t - w.end) / cool));
  if (ua > 0 && k < 1) { c.save(); c.globalAlpha *= ua * (1 - k); c.fillStyle = s.unsung; c.fillText(w.w, x, y); c.restore(); }
  c.save();
  c.globalAlpha *= clamp(k * 2);
  c.fillStyle = col;
  const p = s.punch ?? 0;
  if (p > 0) {
    const sc = 1 + p * (1 - ease.outBack(k, 2.2));
    const wm = c.measureText(w.w).width;
    c.translate(x + wm / 2, y);
    c.scale(sc, sc);
    c.fillText(w.w, -wm / 2, 0);
  } else c.fillText(w.w, x, y + (1 - k) * s.size * 0.1);
  c.restore();
}

export interface DimStyle {
  /** 0..1 draw-on (the line grows from its middle to both ends; arrowheads land at the end) */
  k?: number;
  col?: string;
  lw?: number;
  arrow?: number;
  /** label size (IBM Plex Mono 500) */
  size?: number;
  /** label alpha (0..1) */
  textK?: number;
  /** label colour (defaults to col) */
  textCol?: string;
  /** 'along' = rotated along the line in a gap; 'right' / 'left' = horizontal beside the line */
  label?: 'along' | 'right' | 'left';
}

/** Vertical dimension line at x from yTop to yBot with arrowheads and a label. */
export function dimV(c: CanvasRenderingContext2D, x: number, yTop: number, yBot: number, label: string, o: DimStyle = {}) {
  const k = clamp(o.k ?? 1);
  if (k <= 0) return;
  const col = o.col ?? rgba('ink', 1);
  const lw = o.lw ?? 1.6;
  const ar = o.arrow ?? 14;
  const size = o.size ?? 22;
  const mid = (yTop + yBot) / 2, half = (yBot - yTop) / 2;
  const kk = ease.outCubic(k);
  const y0 = mid - half * kk, y1 = mid + half * kk;
  c.save();
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; c.lineCap = 'butt';
  const mode = o.label ?? 'along';
  c.font = font(F.mono(500), size);
  c.letterSpacing = `${size * 0.06}px`;
  const tw = c.measureText(label).width;
  const gap = mode === 'along' ? tw / 2 + size * 0.5 : 0;
  if (gap > 0 && (y1 - y0) / 2 > gap) {
    c.beginPath(); c.moveTo(x, y0); c.lineTo(x, mid - gap); c.moveTo(x, mid + gap); c.lineTo(x, y1); c.stroke();
  } else if (gap === 0) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1); c.stroke(); }
  // arrowheads (filled, slender) once the line has reached its ends
  const ak = clamp((k - 0.75) / 0.25);
  if (ak > 0) {
    const a = ar * ease.outBack(ak, 2);
    c.beginPath(); c.moveTo(x, yTop); c.lineTo(x - a * 0.32, yTop + a); c.lineTo(x + a * 0.32, yTop + a); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x, yBot); c.lineTo(x - a * 0.32, yBot - a); c.lineTo(x + a * 0.32, yBot - a); c.closePath(); c.fill();
  }
  const tk = o.textK ?? clamp((k - 0.6) / 0.4);
  if (tk > 0) {
    c.globalAlpha *= tk;
    c.fillStyle = o.textCol ?? col;
    c.textBaseline = 'middle';
    if (mode === 'along') {
      c.translate(x, mid); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.fillText(label, 0, 1);
    } else {
      c.textAlign = mode === 'right' ? 'left' : 'right';
      c.fillText(label, x + (mode === 'right' ? 1 : -1) * size * 0.6, mid);
    }
  }
  c.restore();
}

/** Horizontal witness / extension line from x0 to x1 at y, drawn on from x0. Dashed if `dash`. */
export function witness(c: CanvasRenderingContext2D, x0: number, x1: number, y: number, k: number, o: { col?: string; lw?: number; dash?: number[] } = {}) {
  const kk = clamp(k);
  if (kk <= 0) return;
  c.save();
  c.strokeStyle = o.col ?? rgba('ink', 0.8); c.lineWidth = o.lw ?? 1;
  if (o.dash) c.setLineDash(o.dash);
  c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + (x1 - x0) * ease.outCubic(kk), y); c.stroke();
  c.restore();
}

/** A rubber stamp slammed at t0: rounded box with tracked mono caps, rotated `rot`. */
export function stamp(c: CanvasRenderingContext2D, x: number, y: number, lines: string[], t: number, t0: number, o: { col?: string; size?: number; rot?: number } = {}) {
  if (t < t0 - 0.01) return;
  const k = clamp((t - t0) / 0.11);
  const sc = 1 + 0.6 * (1 - ease.outBack(k, 1.6));
  const size = o.size ?? 26;
  const col = o.col ?? rgba('signal', 1);
  c.save();
  c.translate(x, y); c.rotate(o.rot ?? -0.12); c.scale(sc, sc);
  c.globalAlpha *= clamp(k * 3) * 0.92;
  c.font = font(F.mono(700), size);
  c.letterSpacing = `${size * 0.22}px`;
  const tw = Math.max(...lines.map((s) => c.measureText(s).width));
  const lh = size * 1.25;
  const w = tw + size * 1.4, h = lh * lines.length + size * 0.9;
  c.strokeStyle = col; c.lineWidth = size * 0.14;
  c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, size * 0.25); c.stroke();
  c.lineWidth = size * 0.05;
  c.beginPath(); c.roundRect(-w / 2 + size * 0.22, -h / 2 + size * 0.22, w - size * 0.44, h - size * 0.44, size * 0.15); c.stroke();
  c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
  lines.forEach((s, i) => c.fillText(s, size * 0.11, -((lines.length - 1) * lh) / 2 + i * lh + size * 0.04));
  c.restore();
}
