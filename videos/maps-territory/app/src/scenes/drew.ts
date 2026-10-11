// drew — verse 1: "I drew the life I thought I'd live / Every year in perfect lines / Named the cities, marked the
// roads / Colored in between the signs".
// The plotter draws the plan as it is sung, and a second pen writes the verse in the left column, each letter while
// its word is sung. Line 1: the ruled road, HOME to RETIREMENT, straight across whatever is there. Line 2: a tick
// for every year, 2000 to 2040. Line 3: the places, one per word, ringed and named. Line 4: the districts around
// them coloured in, hatch by hatch.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { Lyrics } from '../engine/lyrics';
import { clamp, ease, lerp, prog, TAU } from '../engine/util';
import { strokeText, drawStrokeText, writtenLength, type StrokeText } from '../engine/stroke';
import { PLAN, PLAN_PTS } from './_world';
import { charTimes, drawPlan, lerpView, mono, placeMark, Terrain, w2s, type View } from './_mt';
import { COL_X, drawFurniture, penCross, SHEET_VIEW } from './_sheet';

/** Progress through a line by words (0 at the first word's start, 1 when the last word ends). */
export function lineProg(l: Line, t: number) {
  const n = l.words.length;
  let k = 0;
  for (let i = 0; i < n; i++) k += Lyrics.wordProgress(l.words[i]!, t);
  return k / n;
}
/** Polyline length helpers over the plan (km). */
const PL = (() => { const L = [0]; for (let i = 1; i < PLAN_PTS.length; i++) L.push(L[i - 1]! + Math.hypot(PLAN_PTS[i]!.x - PLAN_PTS[i - 1]!.x, PLAN_PTS[i]!.y - PLAN_PTS[i - 1]!.y)); return L; })();
export const PLAN_LEN = PL[PL.length - 1]!;
export function planAt(s: number) {
  s = clamp(s, 0, PLAN_LEN);
  let i = 1; while (i < PL.length - 1 && PL[i]! < s) i++;
  const a = PLAN_PTS[i - 1]!, b = PLAN_PTS[i]!, u = (s - PL[i - 1]!) / (PL[i]! - PL[i - 1]!);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, nx: -(b.y - a.y) / (PL[i]! - PL[i - 1]!), ny: (b.x - a.x) / (PL[i]! - PL[i - 1]!) };
}
/** Arc length of each place along the plan. */
export const PLACE_S = PL;

/** Draw the drawn plan (road, ticks, places, districts) at the given progress values, in view v. */
export function drawThePlan(lb: LineBatch, c: CanvasRenderingContext2D, v: View, k: { road: number; ticks: number; places: number[]; fill: number[] }, ink = LIN.ink, inkCss = 'ink', alpha = 1) {
  // districts (coloured in): hatched discs around each place, each at its own angle
  PLAN.forEach((p, i) => {
    const fk = k.fill[i] ?? 0;
    if (fk <= 0) return;
    const q = w2s(v, p.x, p.y), R = 5.2 * v.s;
    c.save();
    c.globalAlpha = alpha;
    c.beginPath(); c.arc(q.x, q.y, R, 0, TAU); c.clip();
    c.fillStyle = rgba('blood', 0.07 * fk); c.fillRect(q.x - R, q.y - R, 2 * R, 2 * R);
    c.strokeStyle = rgba(i % 2 ? 'blood' : inkCss, 0.35); c.lineWidth = 0.9;
    const ang = 0.6 + i * 0.7, ca = Math.cos(ang), sa = Math.sin(ang);
    const n = Math.floor(((2 * R) / 7) * fk);
    for (let j = 0; j < n; j++) {
      const d = -R + j * 7;
      c.beginPath(); c.moveTo(q.x + ca * d - sa * R, q.y + sa * d + ca * R); c.lineTo(q.x + ca * d + sa * R, q.y + sa * d - ca * R); c.stroke();
    }
    c.restore();
    c.save(); c.globalAlpha = alpha * fk; c.strokeStyle = rgba(inkCss, 0.5); c.lineWidth = 1; c.setLineDash([3, 4]);
    c.beginPath(); c.arc(q.x, q.y, R, 0, TAU); c.stroke(); c.restore();
  });
  drawPlan(lb, v, k.road, ink, { width: 2.2, alpha: 0.95 * alpha });
  // year ticks: 40 years along the road
  const nT = Math.floor(40 * k.ticks + 1e-6);
  for (let y = 0; y <= nT && y <= 40; y++) {
    const p = planAt((PLAN_LEN * y) / 40);
    const q = w2s(v, p.x, p.y);
    const L = y % 4 === 0 ? 9 : 5;
    lb.seg2(q.x - p.nx * L, q.y - p.ny * L, q.x + p.nx * L, q.y + p.ny * L, 1.1, ink, 0.85 * alpha);
  }
  // places
  PLAN.forEach((p, i) => {
    const pk = k.places[i] ?? 0;
    if (pk <= 0) return;
    const q = w2s(v, p.x, p.y);
    c.save(); c.globalAlpha = alpha;
    placeMark(c, q.x, q.y, 9, rgba(inkCss, 0.95), pk);
    c.globalAlpha = alpha * clamp(pk * 2);
    mono(c, p.name, q.x + 16, q.y - 12, { size: 13, color: rgba(inkCss, 0.95), track: 3, weight: 600 });
    if (k.ticks > 0) mono(c, String(p.year), q.x + 16, q.y + 8, { size: 11, color: rgba('blood', clamp(k.ticks * 3)), track: 2 });
    c.restore();
  });
}

export default class Drew extends Scene {
  terrain = new Terrain();
  lb = new LineBatch(2000, { blend: 'normal' });
  text = new Layer2D();
  ls: Line[] = [];
  sts: StrokeText[] = [];
  cts: [number, number][][] = [];

  override init() {
    this.ls = [0, 1, 2, 3].map((i) => this.ctx.lyrics.lines[i]!);
    this.sts = this.ls.map((l) => strokeText(l.text, 'script', 40, 0));
    this.cts = this.ls.map((l) => charTimes(l, l.text));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const [l0, l1, l2, l3] = this.ls as [Line, Line, Line, Line];
    const v = lerpView(SHEET_VIEW, { cx: 23.2, cy: 47, s: 9.4, rot: 0 }, prog(t, t0, t1, ease.inOutSine));
    this.terrain.draw(renderer, out, { view: v, mapMix: 1, contourInk: 0, t });
    const T = this.text, c = T.ctx; T.clear();
    drawFurniture(c, v, { frame: 1, star: 1, scale: 1, legend: 1, title: 1 });
    const road = lineProg(l0, t);
    const ticks = prog(t, l1.start, l1.end, ease.linear);
    const places = PLAN.map((_, i) => (i === 0 ? 1 : prog(t, l2.words[i - 1]?.start ?? 1e9, (l2.words[i - 1]?.start ?? 1e9) + 0.3, ease.outCubic)));
    const fills = PLAN.map((_, i) => { const w = l3.words[Math.min(l3.words.length - 1, Math.floor(i * l3.words.length / PLAN.length))]!; const s = w.start + (i % 2) * 0.25; return prog(t, s, s + 1.1, ease.inOutSine); });
    const lb = this.lb; lb.clear();
    drawThePlan(lb, c, v, { road, ticks, places, fill: fills });
    // the pen: where the plan is being drawn
    let pen: { x: number; y: number } | null = null;
    if (t < l1.start) { const p = planAt(PLAN_LEN * road); pen = w2s(v, p.x, p.y); }
    else if (t < l2.start) { const p = planAt(PLAN_LEN * ticks); pen = w2s(v, p.x, p.y); }
    else if (t < l3.start) { let i = 0; places.forEach((k, j) => { if (k > 0) i = j; }); pen = w2s(v, PLAN[i]!.x, PLAN[i]!.y); }
    else { let i = 0; fills.forEach((k, j) => { if (k > 0) i = j; }); const q = w2s(v, PLAN[i]!.x, PLAN[i]!.y); const a = t * 9; pen = { x: q.x + Math.cos(a) * 30 * (1 - fills[i]!), y: q.y + Math.sin(a * 1.3) * 30 * (1 - fills[i]!) }; }
    if (pen) penCross(c, pen.x, pen.y, 1 - prog(t, t1 - 0.4, t1));
    // the verse, written by the second pen
    this.ls.forEach((l, i) => {
      const st = this.sts[i]!;
      const len = writtenLength(st, this.cts[i]!, t);
      if (len <= 0) return;
      const y = 420 + i * 72;
      c.save();
      c.translate(COL_X, y);
      const done = t > l.end + 0.2;
      c.strokeStyle = done ? rgba('ink', 0.92) : rgba('blood', 1);
      c.lineWidth = 2.1; c.lineCap = 'round'; c.lineJoin = 'round';
      const h = drawStrokeText(c, st, len);
      c.restore();
      if (h && len < st.total) { c.fillStyle = rgba('blood', 1); c.beginPath(); c.arc(COL_X + h.x, y + h.y, 3, 0, TAU); c.fill(); }
    });
    // a deadpan readout: the plan's length and its years
    c.globalAlpha = prog(t, l1.start, l1.start + 0.4);
    mono(c, `PLANNED  ${PLAN_LEN.toFixed(1)} KM  ·  2000 → 2040  ·  ${Math.floor(40 * ticks)} YEARS DRAWN`, 750, 1010, { size: 11, color: rgba('ink', 0.65), track: 3 });
    c.globalAlpha = 1;
    lb.render(renderer, out);
    comp.draw(renderer, T.upload(), out);
    void font; void F; void lerp;
    return { bloom: 0.15, vignette: 0.22, ca: 0.25, halation: 0, paper: 1 };
  }
}
