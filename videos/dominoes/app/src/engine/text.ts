// Lyric typography with per-word karaoke state, plus the drawing's annotations (mono labels,
// leader lines, order tags, scale bars).
import { type R, type Role } from './draw';
import { archivo, mono } from './fonts';
import { type Line, type Word, display, wordState } from './lyrics';
import { clamp, ease, smoothstep } from './util';

export interface WordBox { word: Word; i: number; text: string; x: number; y: number; w: number; row: number }

export interface WordFx {
  word: Word; i: number; box: WordBox;
  state: 'unsung' | 'active' | 'sung';
  /** seconds since the word started (negative before) */
  dt: number;
  dx: number; dy: number; rot: number; scale: number; alpha: number;
  /** override colour (css) */
  color?: string;
  /** skip drawing (the station draws this word itself) */
  hide?: boolean;
}

export interface LyricStyle {
  size: number;
  font?: (size: number) => string;
  width?: number;
  weight?: number;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
  leading?: number;
  /** seconds before the line's start that it fades in */
  appear?: number;
  /** [t0, t1]: fade the line out */
  vanish?: [number, number];
  /** alpha of unsung words */
  unsung?: number;
  active?: Role;
  sung?: Role;
  rest?: Role;
  /** keep commas */
  punct?: boolean;
  /** letter-spacing in em */
  tracking?: number;
  /** text transform */
  upper?: boolean;
  fx?: (f: WordFx) => void;
}

const fontOf = (st: LyricStyle) => (st.font ?? ((s: number) => archivo(s, st.width ?? 1000, st.weight ?? 700)))(st.size);

/** Lay out a line's words; baseline of the first row at y = 0, aligned around x = 0. */
export function layout(r: R, l: Line, st: LyricStyle): WordBox[] {
  const font = fontOf(st);
  const g = r.g;
  g.font = font;
  const tr = (st.tracking ?? 0) * st.size;
  const words = l.words.map((w) => {
    let s = display(w.w, st.punct);
    if (st.upper) s = s.toUpperCase();
    return s;
  });
  const widths = words.map((s) => g.measureText(s).width + tr * Math.max(0, s.length - 1));
  const space = g.measureText(' ').width + tr;
  const rows: number[][] = [[]];
  let cur = 0;
  words.forEach((_, i) => {
    const wv = widths[i]!;
    const row = rows[rows.length - 1]!;
    if (st.maxWidth && row.length && cur + space + wv > st.maxWidth) {
      rows.push([i]);
      cur = wv;
    } else {
      row.push(i);
      cur += (row.length > 1 ? space : 0) + wv;
    }
  });
  const lead = (st.leading ?? 1.08) * st.size;
  const out: WordBox[] = [];
  rows.forEach((row, ri) => {
    const total = row.reduce((s, i, k) => s + widths[i]! + (k ? space : 0), 0);
    let x = st.align === 'center' ? -total / 2 : st.align === 'right' ? -total : 0;
    for (const i of row) {
      out.push({ word: l.words[i]!, i, text: words[i]!, x, y: ri * lead, w: widths[i]!, row: ri });
      x += widths[i]! + space;
    }
  });
  return out;
}

/** Visibility of a line at t given its style (appear/vanish). */
export function lineAlpha(l: Line, t: number, st: LyricStyle) {
  const ap = st.appear ?? 0.4;
  let a = smoothstep(l.start - ap - 0.2, l.start - ap + 0.05, t);
  if (st.vanish) a *= 1 - smoothstep(st.vanish[0], st.vanish[1], t);
  return a;
}

/**
 * Draw a lyric line at world (x, y) rotated by rot. Unsung words wait dim, the sung word sweeps to
 * orange at its onset (never before) and cools to the `sung` colour after it ends.
 */
export function lyric(r: R, l: Line, x: number, y: number, st: LyricStyle, rot = 0, boxesIn?: WordBox[]) {
  const t = r.t;
  const A = lineAlpha(l, t, st) * r.lyricAlpha;
  if (A <= 0.002) return [] as WordBox[];
  const g = r.g;
  const boxes = boxesIn ?? layout(r, l, st);
  const font = fontOf(st);
  const tr = (st.tracking ?? 0) * st.size;
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.font = font;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  for (const b of boxes) {
    const w = b.word;
    const state = wordState(w, t);
    const f: WordFx = { word: w, i: b.i, box: b, state, dt: t - w.start, dx: 0, dy: 0, rot: 0, scale: 1, alpha: 1 };
    // default motion: a small upward pop on onset
    if (state !== 'unsung') {
      const k = clamp((t - w.start) / 0.22);
      f.dy = -Math.sin(k * Math.PI) * st.size * 0.035;
    }
    st.fx?.(f);
    if (f.hide) continue;
    const a = A * f.alpha;
    if (a <= 0.002) continue;
    const cx = b.x + b.w / 2;
    g.save();
    g.translate(cx + f.dx, b.y + f.dy);
    if (f.rot) g.rotate(f.rot);
    if (f.scale !== 1) g.scale(f.scale, f.scale);
    const draw = (color: string, alpha: number) => {
      if (alpha <= 0.002) return;
      g.globalAlpha = alpha;
      g.fillStyle = color;
      if (tr) drawTracked(r, b.text, -b.w / 2, 0, tr);
      else g.fillText(b.text, -b.w / 2, 0);
    };
    if (f.color) {
      draw(f.color, a);
    } else if (state === 'unsung') {
      draw(r.c(st.rest ?? 'fg'), a * (st.unsung ?? 0.32));
    } else {
      // sweep: the sung part fills left to right over min(duration, 0.28 s)
      const sweepDur = Math.min(0.28, Math.max(0.08, w.end - w.start));
      const sw = ease.outCubic(clamp((t - w.start) / sweepDur));
      const cool = smoothstep(w.end, w.end + 0.45, t);
      const sungCol = r.mix(st.active ?? 'sig', st.sung ?? 'fg', cool);
      if (sw < 1) {
        draw(r.c(st.rest ?? 'fg'), a * (st.unsung ?? 0.32));
        g.save();
        g.beginPath();
        g.rect(-b.w / 2 - st.size, -st.size * 1.2, (b.w + st.size) * sw + st.size * 0.02, st.size * 1.6);
        g.clip();
        draw(sungCol, a);
        g.restore();
      } else draw(sungCol, a);
    }
    g.restore();
  }
  g.restore();
  g.globalAlpha = 1;
  return boxes;
}

function drawTracked(r: R, s: string, x: number, y: number, tr: number) {
  const g = r.g;
  let cx = x;
  for (const ch of s) {
    g.fillText(ch, cx, y);
    cx += g.measureText(ch).width + tr;
  }
}

/**
 * Draw a string glyph by glyph along a path given by `at(s)` (arc length -> point + angle),
 * starting at arc length s0. Returns the advance.
 */
export function textAlong(r: R, s: string, at: (s: number) => { x: number; y: number; angle: number }, s0: number, font: string, color: string, alpha = 1) {
  const g = r.g;
  g.font = font;
  g.fillStyle = color;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  let adv = 0;
  const prev = g.globalAlpha;
  g.globalAlpha = prev * alpha * r.lyricAlpha;
  for (const ch of s) {
    const cw = g.measureText(ch).width;
    const p = at(s0 + adv + cw / 2);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.angle);
    g.fillText(ch, -cw / 2, 0);
    g.restore();
    adv += cw;
  }
  g.globalAlpha = prev;
  return adv;
}

// ------------------------------------------------------------------ annotations

/** A mono annotation (uppercase by convention) at world (x, y). Size in world units. */
export function label(r: R, s: string, x: number, y: number, size = 15, color?: string, align: CanvasTextAlign = 'left', weight = 400, alpha = 1) {
  if (r.onScreen(size) < 4) return;
  r.alpha(alpha, () => r.text(s, x, y, mono(size, weight), color ?? r.c('mid'), align));
}

/** Leader line from an anchor point to a label, with a small dot at the anchor. */
export function leader(r: R, ax: number, ay: number, lx: number, ly: number, s: string, size = 14, color?: string, alpha = 1) {
  if (r.onScreen(size) < 4 || alpha <= 0.01) return;
  const col = color ?? r.c('mid');
  r.alpha(alpha, () => {
    r.circle(ax, ay, r.px(2.2), undefined, col);
    const elbowX = lx + (lx > ax ? -size * 0.6 : size * 0.6);
    r.path([{ x: ax, y: ay }, { x: elbowX, y: ly }, { x: lx, y: ly }]);
    r.stroke(col, 1);
    r.text(s, lx + (lx > ax ? size * 0.4 : -size * 0.4), ly + size * 0.35, mono(size), col, lx > ax ? 'left' : 'right');
  });
}

/** Order-of-consequence tag: a small circled ordinal, e.g. "3°". */
export function orderTag(r: R, n: number | string, x: number, y: number, size = 16, active = 0, alpha = 1) {
  if (r.onScreen(size) < 5 || alpha <= 0.01) return;
  r.alpha(alpha, () => {
    const col = active > 0.01 ? r.mix('mid', 'sig', active) : r.c('mid');
    const s = `${n}°`;
    const w = r.measure(s, mono(size, 500));
    r.box(x, y, 0, -size * 0.45, -size * 1.05, w + size * 0.9, size * 1.45, col, undefined, 1);
    r.text(s, x, y, mono(size, 500), col);
  });
}

/** A technical scale bar: |——| with a label. */
export function scaleBar(r: R, x: number, y: number, len: number, s: string, size: number, alpha = 1) {
  if (r.onScreen(size) < 4 || alpha <= 0.01) return;
  r.alpha(alpha, () => {
    const col = r.c('mid');
    const tick = size * 0.5;
    r.line(x, y, x + len, y, col, 1);
    r.line(x, y - tick, x, y + tick, col, 1);
    r.line(x + len, y - tick, x + len, y + tick, col, 1);
    r.text(s, x + len / 2, y - tick - size * 0.3, mono(size), col, 'center');
  });
}

/** Dimension line with arrowheads between two points and a label (technical drawing). */
export function dimension(r: R, x0: number, y0: number, x1: number, y1: number, s: string, size: number, alpha = 1) {
  if (r.onScreen(size) < 4 || alpha <= 0.01) return;
  r.alpha(alpha, () => {
    const col = r.c('mid');
    const a = Math.atan2(y1 - y0, x1 - x0);
    const ah = size * 0.5;
    r.line(x0, y0, x1, y1, col, 1);
    for (const [px, py, d] of [[x0, y0, 1], [x1, y1, -1]] as const) {
      r.poly([
        { x: px, y: py },
        { x: px + d * Math.cos(a - 0.35) * ah, y: py + d * Math.sin(a - 0.35) * ah },
        { x: px + d * Math.cos(a + 0.35) * ah, y: py + d * Math.sin(a + 0.35) * ah },
      ], undefined, col);
    }
    r.local((x0 + x1) / 2, (y0 + y1) / 2, a, 1, () => {
      r.text(s, 0, -size * 0.45, mono(size), col, 'center');
    });
  });
}
