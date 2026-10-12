// The plan as drawn on the sheet: the ruled road, a tick a year, the named places, the districts coloured in.
import type { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { Lyrics } from '../engine/lyrics';
import { clamp, TAU } from '../engine/util';
import { PLAN, PLAN_PTS } from './_world';
import { drawPlan, mono, placeMark, w2s, type View } from './_mt';

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

