// Small helpers shared by my plates (park, camden, friends): beat lookups, camera transforms,
// geometric figures, CRT screens, text along an arc. Nothing here is a kit motif; the kit stays the
// source of the recurring ones.
import type { AudioData } from '../engine/audio';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { rgba } from '../engine/palette';
import { font, layout } from '../engine/type';
import { clamp, ease, lerp } from '../engine/util';
import { isKey, fg, RED, type C2D } from './_kit';

/** Beat-grid lookups relative to a time. */
export function beats(au: AudioData) {
  const after = (t: number) => au.timeOfBeat(Math.ceil(au.beatAt(t) - 1e-6));
  const before = (t: number) => au.timeOfBeat(Math.floor(au.beatAt(t) + 1e-6));
  const near = (t: number) => au.timeOfBeat(Math.round(au.beatAt(t)));
  const downAfter = (t: number) => au.downbeats.find((d) => d >= t - 1e-6) ?? after(t);
  const list = (t0: number, t1: number) => {
    const out: number[] = [];
    for (let b = Math.ceil(au.beatAt(t0) - 1e-6); au.timeOfBeat(b) < t1; b++) out.push(au.timeOfBeat(b));
    return out;
  };
  return { after, before, near, downAfter, list };
}

/** First word in a line whose text contains q (case/punct-insensitive). */
export function wd(l: Line, q: string, nth = 0): Word {
  const k = q.toLowerCase().replace(/[^a-z]/g, '');
  const ws = l.words.filter((w) => w.w.toLowerCase().replace(/[^a-z]/g, '').includes(k));
  const w = ws[nth];
  if (!w) throw new Error(`word not found: ${q} in "${l.text}"`);
  return w;
}

/** Steps: sum of eased 0..1 ramps starting at each time (for beat-stepped camera moves). */
export function steps(t: number, times: number[], dur: number, fn = ease.outExpo) {
  let s = 0;
  for (const t0 of times) s += fn(clamp((t - t0) / dur));
  return s;
}

/** Decaying pulse sum over a list of hit times. */
export function pulses(t: number, times: number[], hl = 0.1) {
  let v = 0;
  for (const t0 of times) if (t >= t0) v = Math.max(v, Math.pow(0.5, (t - t0) / hl));
  return v;
}

/** Applies a camera: world point (cx, cy) at screen (sx, sy), zoom z, rotation rot. */
export function camera(c: C2D, cx: number, cy: number, z: number, rot = 0, sx = 960, sy = 540) {
  c.translate(sx, sy);
  if (rot) c.rotate(rot);
  c.scale(z, z);
  c.translate(-cx, -cy);
}

/**
 * Geometric figure (no face): circle head + capsule body + optional stick legs/arms, feet at (x, y).
 * h = total height. lean (radians) tilts the body; stride 0..1 swings the legs; arms: [l, r] angles
 * from hanging down (0) to raised (π).
 */
export function figure(c: C2D, x: number, y: number, h: number, o: { fill?: string; stroke?: string; lw?: number; lean?: number; stride?: number; arms?: [number, number]; legs?: boolean } = {}) {
  const head = h * 0.13, bodyH = h * 0.42, bodyW = h * 0.2, legH = h * 0.32;
  c.save();
  c.translate(x, y);
  c.rotate(o.lean ?? 0);
  const lw = o.lw ?? Math.max(1.5, h * 0.035);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const fill = o.fill, stroke = o.stroke;
  // legs
  if (o.legs !== false) {
    const sw = (o.stride ?? 0) * 0.5;
    c.strokeStyle = fill ?? stroke ?? '#000'; c.lineWidth = bodyW * 0.32;
    c.beginPath();
    c.moveTo(-bodyW * 0.22, -legH); c.lineTo(-bodyW * 0.22 + Math.sin(sw) * legH, -legH + Math.cos(sw) * legH);
    c.moveTo(bodyW * 0.22, -legH); c.lineTo(bodyW * 0.22 - Math.sin(sw) * legH, -legH + Math.cos(sw) * legH);
    c.stroke();
  }
  // arms
  if (o.arms) {
    const ay = -legH - bodyH + bodyW * 0.45, al = h * 0.3;
    c.strokeStyle = fill ?? stroke ?? '#000'; c.lineWidth = bodyW * 0.26;
    c.beginPath();
    c.moveTo(-bodyW * 0.42, ay); c.lineTo(-bodyW * 0.42 - Math.sin(o.arms[0]) * al, ay + Math.cos(o.arms[0]) * al);
    c.moveTo(bodyW * 0.42, ay); c.lineTo(bodyW * 0.42 + Math.sin(o.arms[1]) * al, ay + Math.cos(o.arms[1]) * al);
    c.stroke();
  }
  // body capsule
  const by = -legH - bodyH;
  c.beginPath();
  c.roundRect(-bodyW / 2, by, bodyW, bodyH + bodyW * 0.2, bodyW / 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  // head
  c.beginPath();
  c.arc(0, by - head * 1.25, head, 0, Math.PI * 2);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  c.restore();
}

/** Mono text helper. */
export function mono(c: C2D, s: string, x: number, y: number, size: number, col: string, align: CanvasTextAlign = 'left', fam = 'Plex-500') {
  c.font = font(fam, size); c.fillStyle = col; c.textAlign = align; c.textBaseline = 'alphabetic';
  c.fillText(s, x, y);
}

/** Types a string in over k 0..1 (characters). */
export const typed = (s: string, k: number) => s.slice(0, Math.floor(s.length * clamp(k) + 1e-6));

/**
 * Words of a line laid along the inside of a smile-shaped arc (centre cx, cy above, radius r): the
 * baseline runs on the arc, glyphs point toward the centre, reading left→right (angle decreasing), centred
 * on angle aMid (π/2 = bottom). Karaoke per glyph like drawKaraokeWords. Returns the end angle.
 */
export function drawArcWords(c: C2D, words: Word[], t: number, cx: number, cy: number, r: number, aMid: number, s: { family: string; size: number; paper?: boolean; dim?: number; lead?: number; keyCol?: string; base?: string }) {
  const paper = s.paper ?? true, dim = s.dim ?? 0.28, dir = -1;
  const base = s.base ?? fg(paper), keyCol = s.keyCol ?? RED();
  c.save();
  c.font = font(s.family, s.size); c.textBaseline = 'alphabetic'; c.textAlign = 'center';
  const sp = c.measureText(' ').width;
  const lays = words.map((w) => layout(w.w, s.family, s.size));
  const total = lays.reduce((a, l) => a + l.width, 0) + sp * (words.length - 1);
  // arc length → angle: text centred on aMid
  let pos = -total / 2;
  const lead = s.lead ?? 0.4;
  const vis = t >= words[0]!.start - lead;
  words.forEach((w, i) => {
    const lay = lays[i]!;
    const p = Lyrics.wordProgress(w, t);
    const col = isKey(w) ? keyCol : base;
    const nG = lay.glyphs.length;
    for (const g of lay.glyphs) {
      const k = clamp(p * nG - g.i);
      const a = aMid + dir * (pos + g.x + g.w / 2) / r;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (!vis) continue;
      c.save();
      c.translate(px, py);
      // glyph up = away from centre (inside=false) or toward centre
      c.rotate(a - Math.PI / 2);
      c.globalAlpha = k >= 1 ? 1 : k > 0 ? lerp(dim, 1, k) : dim;
      c.fillStyle = k > 0 ? col : base;
      c.fillText(g.ch, 0, 0);
      c.restore();
    }
    pos += lay.width + sp;
  });
  c.restore();
  return aMid + dir * (total / 2) / r;
}

/** Horizontal CRT scanlines + rounded screen clip helper. */
export function scanlines(c: C2D, x: number, y: number, w: number, h: number, a: number, step = 3, col = 'rgba(12,12,14,1)') {
  c.save();
  c.globalAlpha = a; c.fillStyle = col;
  for (let yy = y; yy < y + h; yy += step) c.fillRect(x, yy, w, 1);
  c.restore();
}

export const SIG = (a = 1) => rgba('signal', a);
