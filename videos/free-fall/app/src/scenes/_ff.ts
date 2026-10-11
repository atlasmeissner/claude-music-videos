// Shared kit for Free Fall (see docs/TREATMENT.md):
//  - THE PICTOGRAM: the ISO-7001-style figure printed on safety signs (only on signs: no mascots), posed by joint
//    angles (stand, run cycle, leap, star, tuck, stumble, land, cheer, jump);
//  - THE ODDS: the running number (upside : downside), stepping up on every "Free fall";
//  - THE SPARK: re-exported from _motifs.ts (pdoom-video's spark, unchanged);
//  - THE PAYOFF CURVE: the asymmetric bet as an instrument (floor = a stumble, the line leaves the chart);
//  - signage (warning triangles, prohibition signs, panels), mono readouts, and karaoke typography.
import type { Lyrics, Line, Word } from '../engine/lyrics';
import { Lyrics as LyricsC, norm } from '../engine/lyrics';
import { glyphX, font, F, measure, layout, type TextLayout } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, lerp, prog, TAU, hash, pulse } from '../engine/util';

// ================================================================== the figure
/**
 * A pose: angles in radians. Limb angles are measured from "straight down", rotating toward the figure's front
 * (positive = forward/up in front), in the torso's frame. a = near arm, b = far arm, l = near leg, m = far leg;
 * 1 = upper segment, 2 = lower segment (absolute in the torso frame, not a bend). `torso` leans the body forward,
 * `head` tilts the head, `rot` turns the whole figure about the hip (tumbling), `hip` lowers the hip (crouch,
 * fraction of S). Front-view poses (stand, star, cheer, jump) simply mirror a/b and l/m.
 */
export interface Pose { torso: number; head: number; a1: number; a2: number; b1: number; b2: number; l1: number; l2: number; m1: number; m2: number; hip: number }

const P = (torso: number, head: number, a1: number, a2: number, b1: number, b2: number, l1: number, l2: number, m1: number, m2: number, hip = 0): Pose =>
  ({ torso, head, a1, a2, b1, b2, l1, l2, m1, m2, hip });

export const POSES = {
  stand: P(0, 0, 0.3, 0.24, -0.3, -0.24, 0.11, 0.08, -0.11, -0.08),
  ready: P(0.18, 0.05, -0.35, 0.35, -0.55, 0.15, 0.35, -0.15, -0.15, -0.2, 0.04), // on its toes at the edge
  leap: P(0.45, 0.15, 2.5, 2.75, 1.7, 2.0, 1.35, 0.7, -0.85, -1.9),
  star: P(0, 0, 2.05, 2.4, -2.05, -2.4, 0.5, 0.25, -0.5, -0.25), // free fall, arms and legs out
  tuck: P(0.35, 0.2, 1.0, 2.3, 0.75, 2.1, 1.9, 0.1, 1.65, -0.05),
  stumble: P(0.75, 0.35, 1.3, 1.7, -0.5, -0.1, 0.8, 0.1, -0.55, -1.3),
  land: P(0.4, 0.15, 1.25, 1.55, 1.0, 1.3, 1.45, -0.25, 1.15, -0.45, 0.16),
  cheer: P(0, -0.1, 2.45, 2.55, -2.45, -2.55, 0.12, 0.09, -0.12, -0.09),
  jump: P(0, -0.1, 2.4, 2.6, -2.4, -2.6, 0.45, -0.25, -0.45, 0.25),
  still: P(0, 0, 0.17, 0.15, -0.17, -0.15, 0.05, 0.04, -0.05, -0.04), // standing tall, forever
} satisfies Record<string, Pose>;

/** The run cycle at phase φ (one stride of both legs per unit). Profile, facing +x. */
export function runPose(phi: number, lean = 0.28): Pose {
  const leg = (ph: number) => {
    const s = Math.sin(TAU * ph);
    const thigh = -0.2 + 0.85 * s;
    // the knee folds hard as the leg swings through behind, and is near straight at contact
    const fold = 0.25 + 1.45 * Math.max(0, Math.sin(TAU * ph - 2.2)) ** 1.2;
    return [thigh, thigh - fold] as const;
  };
  const arm = (ph: number) => {
    const s = Math.sin(TAU * ph);
    const up = -0.3 - 0.95 * s;
    return [up, up + 1.55] as const;
  };
  const [l1, l2] = leg(phi), [m1, m2] = leg(phi + 0.5);
  const [a1, a2] = arm(phi), [b1, b2] = arm(phi + 0.5);
  return { torso: lean, head: 0.05, a1, a2, b1, b2, l1, l2, m1, m2, hip: -0.035 * Math.abs(Math.cos(TAU * phi)) };
}

export function mixPose(a: Pose, b: Pose, k: number): Pose {
  const o = {} as Pose;
  for (const key of Object.keys(a) as (keyof Pose)[]) o[key] = a[key] + (b[key] - a[key]) * k;
  return o;
}
/** Blend through a list of [time, pose] keys with smooth transitions of `blend` s ending at each key. */
export function poseKeys(t: number, ks: [number, Pose][], blend = 0.25): Pose {
  let p = ks[0]![1];
  for (let i = 1; i < ks.length; i++) {
    const [tk, pk] = ks[i]!;
    if (t < tk - blend) break;
    p = mixPose(p, pk, ease.inOutCubic(clamp((t - (tk - blend)) / blend)));
  }
  return p;
}

export interface FigureStyle { color?: string; dir?: 1 | -1; rot?: number; alpha?: number; far?: string }
/** Hip height above the feet in the standing pose, as a fraction of S (the figure's height). */
export const HIP = 0.53;
/**
 * Draw the figure with its hip at (x, y) (canvas px), height S px. Returns the head centre (canvas px).
 * `far` colours the far limbs (default: same colour — pictograms are flat).
 */
export function drawFigure(c: CanvasRenderingContext2D, x: number, y: number, S: number, p: Pose, o: FigureStyle = {}) {
  const dir = o.dir ?? 1;
  const col = o.color ?? rgba('bone', 1);
  const rot = o.rot ?? 0;
  c.save();
  c.translate(x, y + p.hip * S);
  c.rotate(rot * dir);
  c.scale(dir, 1);
  c.globalAlpha *= o.alpha ?? 1;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  // figure space: canvas coords with y down; "down" rotated forward by th = (sin th, cos th)
  const d = (th: number) => [Math.sin(th), Math.cos(th)] as const;
  const T = p.torso;
  const shoulder = [Math.sin(T) * 0.29 * S, -Math.cos(T) * 0.29 * S] as const;
  const limb = (ox: number, oy: number, t1: number, t2: number, L1: number, L2: number, w: number, color: string) => {
    const [ux, uy] = d(T + t1), [vx, vy] = d(T + t2);
    const kx = ox + ux * L1 * S, ky = oy + uy * L1 * S;
    c.strokeStyle = color;
    c.lineWidth = w * S;
    c.beginPath(); c.moveTo(ox, oy); c.lineTo(kx, ky); c.lineTo(kx + vx * L2 * S, ky + vy * L2 * S); c.stroke();
  };
  const far = o.far ?? col;
  // far limbs, torso, near limbs, head
  limb(0, 0, p.m1, p.m2, 0.25, 0.235, 0.085, far);
  limb(shoulder[0] * 0.94, shoulder[1] * 0.94, p.b1, p.b2, 0.155, 0.15, 0.075, far);
  c.strokeStyle = col;
  c.lineWidth = 0.135 * S;
  c.beginPath(); c.moveTo(0, -0.02 * S); c.lineTo(shoulder[0] * 0.92, shoulder[1] * 0.92); c.stroke();
  limb(0, 0, p.l1, p.l2, 0.25, 0.235, 0.085, col);
  limb(shoulder[0] * 0.94, shoulder[1] * 0.94, p.a1, p.a2, 0.155, 0.15, 0.075, col);
  const hd = 0.145 * S;
  const ha = T + p.head;
  const hx = shoulder[0] + Math.sin(ha) * hd, hy = shoulder[1] - Math.cos(ha) * hd;
  c.fillStyle = col;
  c.beginPath(); c.arc(hx, hy, 0.08 * S, 0, TAU); c.fill();
  c.restore();
  // head centre in canvas space
  const cr = Math.cos(rot * dir), sr = Math.sin(rot * dir);
  const lx = hx * dir, ly = hy;
  return { x: x + lx * cr - ly * sr, y: y + p.hip * S + lx * sr + ly * cr };
}

// ================================================================== THE ODDS
/**
 * THE ODDS (upside : downside), the running number, staged in-world like pdoom's P(doom): it steps up on the last
 * "fall" of every "Free fall, free fall" line (lines 6, 10, 17, 21, 26, 30, 31).
 */
export const ODDS_LINES = [6, 10, 17, 21, 26, 30, 31];
export const ODDS_VALUES = [3, 10, 40, 100, 1000, 1e6, Infinity];
export class Odds {
  steps: { t: number; v: number }[] = [{ t: -1, v: 1 }];
  constructor(ly: Lyrics) {
    ODDS_LINES.forEach((li, i) => {
      const l = ly.lines[li];
      if (!l) return;
      const w = l.words[l.words.length - 1]!;
      this.steps.push({ t: w.start + 0.05, v: ODDS_VALUES[i]! });
    });
  }
  /** Index of the current step at t (0 = 1 : 1). */
  index(t: number) { let i = 0; while (i + 1 < this.steps.length && this.steps[i + 1]!.t <= t) i++; return i; }
  /** Value at t, rolling (log-interpolated, outExpo over `roll` s) from the previous value at each step. */
  value(t: number, roll = 0.9): number {
    const i = this.index(t);
    const cur = this.steps[i]!, prev = this.steps[Math.max(0, i - 1)]!;
    if (i === 0) return cur.v;
    const k = prog(t, cur.t, cur.t + roll, ease.outExpo);
    if (k >= 1) return cur.v;
    const to = Number.isFinite(cur.v) ? cur.v : 1e12;
    return Math.exp(Math.log(prev.v) + (Math.log(to) - Math.log(prev.v)) * k);
  }
  /** A decaying flash after each step (0..1). */
  flash(t: number, half = 0.25) { const i = this.index(t); return i === 0 ? 0 : pulse(t, this.steps[i]!.t, half); }
  /** Time of step n (1-based: step 1 = 3 : 1). */
  stepTime(n: number) { return this.steps[n]?.t ?? 1e9; }
}
const oddsCache = new WeakMap<Lyrics, Odds>();
export function odds(ly: Lyrics) { let o = oddsCache.get(ly); if (!o) { o = new Odds(ly); oddsCache.set(ly, o); } return o; }
/** "3", "1,000", "1,000,000", "∞" (rolling values round to integers; ≥ 1e7 shows as ∞ while rolling to it). */
export function fmtOdds(v: number): string {
  if (!Number.isFinite(v) || v >= 1e9) return '∞';
  return Math.round(v).toLocaleString('en-US');
}
/**
 * The odds instrument (cameo): a mono label, the ratio "N : 1" and a log bar from 1 to ∞ with tick decades.
 * (x, y) = baseline-left of the ratio. Returns its width.
 */
export function drawOdds(c: CanvasRenderingContext2D, x: number, y: number, v: number, o: { scale?: number; ink?: string; hot?: string; dim?: string; label?: string; bar?: boolean; flash?: number } = {}) {
  const k = o.scale ?? 1;
  const ink = o.ink ?? rgba('bone', 0.9), hot = o.hot ?? rgba('signal', 1), dim = o.dim ?? rgba('ash', 0.7);
  c.save();
  mono(c, o.label ?? 'THE ODDS · UPSIDE : DOWNSIDE', x, y - 34 * k, { size: 11 * k, color: dim, track: 3 * k });
  c.font = font(F.mono(500), 30 * k); c.letterSpacing = `${1 * k}px`; c.textBaseline = 'alphabetic';
  const num = fmtOdds(v);
  c.fillStyle = (o.flash ?? 0) > 0.05 ? mixCss(rgba('signal', 1), ink.startsWith('#') ? ink : ink, 1 - (o.flash ?? 0)) : hot;
  c.fillText(num, x, y);
  const nw = c.measureText(num).width;
  c.fillStyle = ink; c.fillText(' : 1', x + nw, y);
  const w = nw + c.measureText(' : 1').width;
  if (o.bar !== false) {
    const bw = 240 * k, by = y + 16 * k;
    c.strokeStyle = dim; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, by); c.lineTo(x + bw, by); c.stroke();
    for (let d = 0; d <= 6; d++) { const xx = x + (d / 7) * bw; c.beginPath(); c.moveTo(xx, by - 4 * k); c.lineTo(xx, by + 4 * k); c.stroke(); }
    const f = Number.isFinite(v) ? Math.min(1, Math.log10(Math.max(1, v)) / 7) : 1;
    c.fillStyle = hot; c.fillRect(x, by - 2 * k, bw * f, 4 * k);
    mono(c, '1', x, by + 18 * k, { size: 9 * k, color: dim, track: 1 });
    mono(c, '∞', x + bw, by + 18 * k, { size: 9 * k, color: dim, track: 1, align: 'right' });
  }
  c.restore();
  return w;
}

// ================================================================== falls (the running beat of the choruses)
const fallCache = new WeakMap<Lyrics, number[]>();
/** Start times of every sung "fall". */
export function fallTimes(ly: Lyrics): number[] {
  let d = fallCache.get(ly);
  if (!d) { d = ly.words.filter((w) => norm(w.w) === 'fall').map((w) => w.start); fallCache.set(ly, d); }
  return d;
}
/** Number of "fall"s sung by t. */
export const fallCount = (ly: Lyrics, t: number) => fallTimes(ly).filter((s) => s <= t).length;
/** A decaying jolt (0..1) on each sung "fall" (for drops, shakes and flashes). */
export function fallJolt(ly: Lyrics, t: number, half = 0.18): number {
  let m = 0;
  for (const s of fallTimes(ly)) m = Math.max(m, pulse(t, s, half));
  return m;
}
/**
 * Camera fall in px: a steady speed plus a lurch of `lurch` px on each "fall" in [t0, t]. Monotonic, smooth.
 */
export function fallScroll(ly: Lyrics, t: number, t0: number, speed: number, lurch = 0): number {
  let s = (t - t0) * speed;
  if (lurch) for (const f of fallTimes(ly)) if (f >= t0 && f <= t) s += lurch * ease.outCubic(clamp((t - f) / 0.45));
  return s;
}

// ================================================================== the payoff curve
/** The asymmetric bet: x in 0..1 (how it goes), y: floor at -0.12 (a stumble) until the kink, then a steep line. */
export const KINK = 0.42, FLOOR = -0.12, SLOPE = 2.7;
export const payoffY = (x: number) => (x < KINK ? FLOOR : FLOOR + (x - KINK) * SLOPE);

export interface PayoffStyle {
  /** chart box: x, y = top-left, w, h (y range shown: -0.3 .. 1) */
  x: number; y: number; w: number; h: number;
  /** 0..1 how much of the curve is drawn */
  draw?: number;
  /** marker position along x (0..1); omit for none */
  pos?: number;
  ink?: string; hot?: string; dim?: string;
  labels?: boolean;
  /** extend the line past the top of the chart by this many px (the upside leaves the frame) */
  overshoot?: number;
  lineWidth?: number;
  title?: string;
}
/** Chart coords → canvas px. */
export function payoffXY(s: PayoffStyle, x: number, y: number) {
  return { x: s.x + x * s.w, y: s.y + s.h * (1 - (y + 0.3) / 1.3) };
}
export function drawPayoff(c: CanvasRenderingContext2D, s: PayoffStyle) {
  const ink = s.ink ?? rgba('bone', 0.9), hot = s.hot ?? rgba('signal', 1), dim = s.dim ?? rgba('bone', 0.35);
  const dr = s.draw ?? 1;
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  // axes
  const o = payoffXY(s, 0, 0), xe = payoffXY(s, 1, 0), yt = payoffXY(s, 0, 1), yb = payoffXY(s, 0, -0.3);
  c.strokeStyle = dim; c.lineWidth = 1;
  c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(o.x + (xe.x - o.x) * clamp(dr * 1.6), o.y); c.stroke();
  c.beginPath(); c.moveTo(o.x, yb.y); c.lineTo(o.x, yb.y + (yt.y - yb.y) * clamp(dr * 1.6)); c.stroke();
  // ticks
  for (let i = 1; i <= 10; i++) {
    const p = payoffXY(s, i / 10, 0);
    if (i / 10 > dr * 1.6) break;
    c.beginPath(); c.moveTo(p.x, p.y - 4); c.lineTo(p.x, p.y + 4); c.stroke();
  }
  // the curve: floor (ink), kink, the upside (hot)
  const lw = s.lineWidth ?? 4;
  const pts: { x: number; y: number }[] = [];
  const N = 120;
  const xMax = Math.min(1, KINK + (1 - FLOOR) / SLOPE);
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * xMax;
    if (x > dr * xMax + 1e-6) break;
    pts.push(payoffXY(s, x, payoffY(x)));
  }
  const kinkPx = payoffXY(s, KINK, FLOOR);
  c.lineWidth = lw;
  c.strokeStyle = ink;
  c.beginPath();
  let started = false;
  for (const p of pts) { if (p.x > kinkPx.x + 0.5) break; if (!started) { c.moveTo(p.x, p.y); started = true; } else c.lineTo(p.x, p.y); }
  c.stroke();
  const up = pts.filter((p) => p.x >= kinkPx.x - 0.5);
  if (up.length > 1) {
    c.strokeStyle = hot;
    c.beginPath(); c.moveTo(up[0]!.x, up[0]!.y);
    for (const p of up) c.lineTo(p.x, p.y);
    // overshoot past the chart's top and an arrowhead
    const last = up[up.length - 1]!;
    const ang = Math.atan2(-(s.h / 1.3) * SLOPE, s.w);
    let ex = last.x, ey = last.y;
    if (dr >= 0.999 && (s.overshoot ?? 0) > 0) { ex = last.x + Math.cos(ang) * s.overshoot!; ey = last.y + Math.sin(ang) * s.overshoot!; c.lineTo(ex, ey); }
    c.stroke();
    if (dr >= 0.999) {
      c.fillStyle = hot;
      c.beginPath();
      const al = lw * 4.5;
      c.moveTo(ex + Math.cos(ang) * al * 0.6, ey + Math.sin(ang) * al * 0.6);
      c.lineTo(ex + Math.cos(ang + 2.5) * al, ey + Math.sin(ang + 2.5) * al);
      c.lineTo(ex + Math.cos(ang - 2.5) * al, ey + Math.sin(ang - 2.5) * al);
      c.closePath(); c.fill();
    }
  }
  // labels
  if (s.labels !== false) {
    const k = Math.max(0.6, s.w / 900);
    if (dr > 0.2) mono(c, 'DOWNSIDE: A STUMBLE', s.x + 4, kinkPx.y + 30 * k, { size: 12 * k, color: ink, track: 2 * k });
    if (dr > 0.95) mono(c, 'UPSIDE: ∞', payoffXY(s, xMax, 1).x + 24 * k, s.y + 18 * k, { size: 12 * k, color: hot, track: 2 * k });
    if (s.title) mono(c, s.title, s.x, s.y - 16 * k, { size: 11 * k, color: dim, track: 3 * k });
  }
  // the marker: the figure's position on the bet
  if (s.pos !== undefined) {
    const p = payoffXY(s, s.pos, payoffY(s.pos));
    c.fillStyle = s.pos > KINK ? hot : ink;
    c.beginPath(); c.arc(p.x, p.y, lw * 2.2, 0, TAU); c.fill();
  }
  c.restore();
}

// ================================================================== signage
/** Warning triangle (signal fill, ink border, ink glyph '!' or a falling figure). Centre (x, y), side `s`. */
export function drawWarning(c: CanvasRenderingContext2D, x: number, y: number, s: number, glyph: 'bang' | 'fall' = 'bang', o: { fill?: string; ink?: string } = {}) {
  const h = s * Math.sqrt(3) / 2;
  const tri = (k: number) => {
    c.beginPath();
    c.moveTo(x, y - h * 0.62 * k); c.lineTo(x + s * 0.5 * k, y + h * 0.38 * k); c.lineTo(x - s * 0.5 * k, y + h * 0.38 * k); c.closePath();
  };
  c.save();
  c.lineJoin = 'round';
  c.fillStyle = o.ink ?? rgba('ink', 1); tri(1.0); c.fill();
  c.fillStyle = o.fill ?? rgba('signal', 1); tri(0.8); c.fill();
  c.fillStyle = o.ink ?? rgba('ink', 1);
  if (glyph === 'bang') {
    c.beginPath(); c.roundRect(x - s * 0.045, y - h * 0.3, s * 0.09, h * 0.4, s * 0.04); c.fill();
    c.beginPath(); c.arc(x, y + h * 0.2, s * 0.055, 0, TAU); c.fill();
  } else {
    // a figure falling off a step
    c.fillRect(x - s * 0.3, y + h * 0.2, s * 0.24, s * 0.05);
    drawFigure(c, x + s * 0.06, y - h * 0.02, s * 0.36, POSES.stumble, { color: o.ink ?? rgba('ink', 1), rot: 0.5 });
  }
  c.restore();
}
/** Prohibition sign: bone disc, signal ring and slash. */
export function drawNo(c: CanvasRenderingContext2D, x: number, y: number, r: number, slash = 1, o: { ring?: string; disc?: string } = {}) {
  c.save();
  c.fillStyle = o.disc ?? rgba('bone', 1);
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.strokeStyle = o.ring ?? rgba('signal', 1);
  c.lineWidth = r * 0.2;
  c.beginPath(); c.arc(x, y, r * 0.9, 0, TAU); c.stroke();
  if (slash > 0) {
    const a = -Math.PI / 4 * 3;
    const L = r * 0.9 * slash;
    c.lineCap = 'butt';
    c.beginPath(); c.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
    c.lineTo(x + Math.cos(a) * r * 0.9 + Math.cos(a + Math.PI) * 2 * L, y + Math.sin(a) * r * 0.9 + Math.sin(a + Math.PI) * 2 * L); c.stroke();
  }
  c.restore();
}
/** A sign panel: rounded rect with text lines (Archivo heavy), optional pictogram area handled by the caller. */
export function drawPanel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: { fill?: string; ink?: string; text?: string[]; size?: number; align?: CanvasTextAlign; r?: number; border?: boolean } = {}) {
  c.save();
  c.fillStyle = o.fill ?? rgba('bone', 1);
  c.beginPath(); c.roundRect(x, y, w, h, o.r ?? Math.min(w, h) * 0.06); c.fill();
  if (o.border) {
    c.strokeStyle = o.ink ?? rgba('ink', 1); c.lineWidth = Math.min(w, h) * 0.03;
    const i = Math.min(w, h) * 0.05;
    c.beginPath(); c.roundRect(x + i, y + i, w - 2 * i, h - 2 * i, (o.r ?? Math.min(w, h) * 0.06) * 0.6); c.stroke();
  }
  if (o.text?.length) {
    const sz = o.size ?? h * 0.22;
    c.fillStyle = o.ink ?? rgba('ink', 1);
    c.font = font(F.archivo(112.5, 900), sz);
    c.letterSpacing = `${sz * 0.02}px`;
    c.textAlign = o.align ?? 'center';
    c.textBaseline = 'alphabetic';
    const n = o.text.length;
    const lh = sz * 1.08;
    const y0 = y + h / 2 - (lh * (n - 1)) / 2 + sz * 0.36;
    const tx = (o.align ?? 'center') === 'center' ? x + w / 2 : o.align === 'right' ? x + w - h * 0.12 : x + h * 0.12;
    o.text.forEach((s, i) => c.fillText(s, tx, y0 + i * lh));
  }
  c.restore();
}

// ================================================================== typography
export interface WordBox { w: Word; i0: number; i1: number; x0: number; x1: number }
/** Kerned x extents of each word of a line set as one string (relative to the line's origin). */
export function wordBoxes(line: Line, family: string, size: number, tracking = 0, text = line.text): WordBox[] {
  const out: WordBox[] = [];
  let from = 0;
  for (const w of line.words) {
    let i0 = text.indexOf(w.w, from);
    if (i0 < 0) i0 = text.toLowerCase().indexOf(w.w.toLowerCase(), from);
    if (i0 < 0) i0 = from;
    const i1 = i0 + w.w.length;
    from = i1;
    out.push({ w, i0, i1, x0: glyphX(text, i0, family, size, tracking), x1: glyphX(text, i0, family, size, tracking) + measure(text.slice(i0, i1), family, size, tracking) });
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
  /** 'wipe': per-word left-to-right wipe; 'reveal': each word fades/rises in at its start; 'slam': each word punches in at its start */
  mode?: 'wipe' | 'reveal' | 'slam';
  align?: 'left' | 'center' | 'right';
  /** override the displayed text (must contain the words in order, case-insensitively) */
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
  const clipDraw = (x0: number, x1: number, col: string, alpha = 1, dy = 0, sc = 1, cx = 0) => {
    if (x1 <= x0 || alpha <= 0) return;
    c.save();
    c.globalAlpha *= alpha;
    c.beginPath(); c.rect(ox + x0, top - s.size, x1 - x0, hgt + s.size * 2); c.clip();
    c.fillStyle = col;
    if (sc !== 1) { c.translate(ox + cx, y + dy); c.scale(sc, sc); c.translate(-(ox + cx), -(y + dy)); }
    c.fillText(text, ox, y + dy);
    c.restore();
  };
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i]!;
    const xa = b.x0 - pad, xb = i + 1 < boxes.length ? boxes[i + 1]!.x0 - pad : b.x1 + pad * 2;
    const p = LyricsC.wordProgress(b.w, t);
    const col = s.active && t < b.w.end + 0.3 ? mixCss(s.active, s.sung, clamp((t - b.w.end) / 0.3)) : s.sung;
    if (t < b.w.start) { if (showUnsung) clipDraw(xa, xb, s.unsung, ua); continue; }
    if (mode === 'wipe') {
      const xw = p >= 1 ? xb : b.x0 + (b.x1 - b.x0) * Math.min(1, p * 1.1);
      clipDraw(xa, xw, col);
      if (showUnsung) clipDraw(xw, xb, s.unsung, ua);
    } else if (mode === 'reveal') {
      const k = ease.outCubic(clamp((t - b.w.start) / 0.14));
      if (showUnsung && k < 1) clipDraw(xa, xb, s.unsung, ua * (1 - k));
      clipDraw(xa, xb, col, k, (1 - k) * s.size * 0.12);
    } else {
      const k = clamp((t - b.w.start) / 0.12);
      const sc = 1 + 0.35 * (1 - ease.outBack(k, 2.5));
      if (showUnsung && k < 1) clipDraw(xa, xb, s.unsung, ua * (1 - k));
      clipDraw(xa, xb, col, clamp(k * 3), 0, sc, (b.x0 + b.x1) / 2);
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

/** Hot-to-cool colour of a word: signal while sung, cooling to `cool` over 0.35 s after it ends. */
export function wordColor(w: Word, t: number, cool = rgba('bone', 1), hot = rgba('signal', 1)) {
  if (t < w.start) return hot;
  return mixCss(hot, cool, clamp((t - w.end) / 0.35));
}

/** Mono annotation (IBM Plex Mono, tracked caps). */
export function mono(c: CanvasRenderingContext2D, text: string, x: number, y: number, o: { size?: number; color?: string; align?: CanvasTextAlign; track?: number; weight?: number } = {}) {
  c.save();
  c.font = font(F.mono(o.weight ?? 400), o.size ?? 13);
  c.letterSpacing = `${o.track ?? 2}px`;
  c.textAlign = o.align ?? 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = o.color ?? rgba('bone', 0.8);
  c.fillText(text, x, y);
  c.restore();
}
/** A labelled readout: small label above a larger value. */
export function readout(c: CanvasRenderingContext2D, x: number, y: number, label: string, value: string, o: { color?: string; hot?: string; align?: CanvasTextAlign; scale?: number } = {}) {
  const k = o.scale ?? 1;
  mono(c, label, x, y - 24 * k, { size: 11 * k, color: o.color ?? rgba('bone', 0.65), track: 3 * k, align: o.align });
  mono(c, value, x, y, { size: 20 * k, color: o.hot ?? rgba('bone', 0.95), track: 2 * k, align: o.align, weight: 500 });
}

/** Deterministic small jitter for hand-made marks. */
export const jit = (i: number, seed: number, amp: number) => (hash(i, seed) - 0.5) * 2 * amp;

const layoutCache = new Map<string, TextLayout>();
export function cachedLayout(text: string, family: string, size: number, tracking = 0): TextLayout {
  const key = `${text}|${family}|${size}|${tracking}`;
  let l = layoutCache.get(key);
  if (!l) { l = layout(text, family, size, tracking); layoutCache.set(key, l); }
  return l;
}

/** Big display word (Archivo) drawn centred at (x, y) with optional horizontal stretch (width axis by scale). */
export function bigWord(c: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, o: { color?: string; width?: number; weight?: number; tracking?: number; align?: CanvasTextAlign; sx?: number; sy?: number; alpha?: number } = {}) {
  c.save();
  c.globalAlpha *= o.alpha ?? 1;
  c.font = font(F.archivo(o.width ?? 125, o.weight ?? 900), size);
  c.letterSpacing = `${o.tracking ?? -size * 0.02}px`;
  c.textAlign = o.align ?? 'center';
  c.textBaseline = 'alphabetic';
  c.fillStyle = o.color ?? rgba('bone', 1);
  c.translate(x, y);
  c.scale(o.sx ?? 1, o.sy ?? 1);
  c.fillText(s, 0, 0);
  c.restore();
}

/** Beat-locked hit pulse helpers. */
export const beatPulse = (beatPhase: number, sharp = 6) => Math.exp(-beatPhase * sharp);
export { lerp, prog, ease, clamp, TAU };
export { sparkHead, sparkHead2D, sparkParticles } from './_motifs';
