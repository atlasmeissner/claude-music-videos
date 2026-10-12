// Pre-chorus 1 (30.7 – 37.2 s).
// "Nothing stops where you think it ends": the heat of the lit house fills a little balloon that
// pulls a pin; a ball runs along a track under the words into a buffer stop marked END, and the END
// tips over. "Every line you draw just bends": the falling END starts a plotter, the pen writes the
// line along a ruler-straight stroke, the stroke bends under it, then springs back and flicks the
// first giant domino of the chorus (the wipe to paper).
import { type R } from '../engine/draw';
import { archivo } from '../engine/fonts';
import { line } from '../engine/lyrics';
import { label, layout, lyric, orderTag, textAlong, type WordBox } from '../engine/text';
import { clamp, ease, lerp, smoothstep } from '../engine/util';
import { hit, ring } from '../machine/motion';
import { ball, ground } from '../machine/parts';
import { LN, type Station } from '../station';
import { HOUSE } from './match';

const L1 = line(LN.stops); // Nothing stops where you think it ends
const L2 = line(LN.bends); // Every line you draw just bends
const W1 = L1.words, W2 = L2.words;
const SIZE = 62;
const TR = { x0: HOUSE.x + HOUSE.w + 120, y0: -230, x1: HOUSE.x + HOUSE.w + 1620, y1: -170 }; // the track
const trackY = (x: number) => lerp(TR.y0, TR.y1, (x - TR.x0) / (TR.x1 - TR.x0));
const END = { x: TR.x1 + 46, w: 70, h: 250 };
const T_RELEASE = W1[0]!.start - 0.25;
const T_END = W1[6]!.start; // "ends"
const T_TOPPLE = W1[6]!.start + 0.55;
const T_FALLEN = T_TOPPLE + 0.4;
const BR = 16;
// plotter
const PL = { x0: END.x + END.h + 140, y: -170, len: 1500, rail: -520 };
const T_PEN0 = W2[0]!.start - 0.3;
const T_PEN1 = W2[5]!.start + 0.25;
const T_BEND = W2[4]!.start; // "just": the stroke starts to bend
const T_FLICK = 37.0;
export const CHORUS_X = PL.x0 + PL.len + 260;

let b1: WordBox[] | null = null, b2: WordBox[] | null = null;
const TEXT1_X = TR.x0 + 60;

function ballX(r: R, t: number) {
  b1 ??= layout(r, L1, { size: SIZE });
  const pts: [number, number][] = [[T_RELEASE, TR.x0 + 20]];
  for (const b of b1.slice(0, 6)) pts.push([b.word.start, TEXT1_X + b.x + b.w * 0.5]);
  pts.push([T_END, END.x - END.w / 2 - BR]);
  if (t <= pts[0]![0]) return pts[0]![1];
  for (let i = 1; i < pts.length; i++) if (t < pts[i]![0]) {
    const a = pts[i - 1]!, b = pts[i]!;
    return lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
  }
  // bounce back a little after the hit
  return END.x - END.w / 2 - BR - 40 * Math.sin(Math.min(1, (t - T_END) / 0.5) * Math.PI) * Math.exp(-(t - T_END) * 2);
}

const endAngle = (t: number) => {
  if (t < T_END) return 0;
  if (t < T_TOPPLE) return 0.06 * ring(t, T_END, 2.2, 3) + 0.03 * smoothstep(T_END + 0.2, T_TOPPLE, t);
  return Math.min(Math.PI / 2, 0.03 + (Math.PI / 2) * ease.inQuad(clamp((t - T_TOPPLE) / (T_FALLEN - T_TOPPLE)))) - 0.04 * hit(t, T_FALLEN, 0.08) * (t > T_FALLEN ? 1 : 0);
};

// the pen: arc length along the stroke at time t, through the word positions
function penS(r: R, t: number) {
  b2 ??= layout(r, L2, { size: SIZE });
  const pts: [number, number][] = [[T_PEN0, 0]];
  for (const b of b2) pts.push([b.word.start, 60 + b.x + b.w * 0.75]);
  pts.push([T_PEN1, PL.len]);
  if (t <= pts[0]![0]) return 0;
  for (let i = 1; i < pts.length; i++) if (t < pts[i]![0]) {
    const a = pts[i - 1]!, b = pts[i]!;
    return lerp(a[1], b[1], ease.inOutSine((t - a[0]) / (b[0] - a[0])));
  }
  return PL.len;
}
/** The stroke's sag: 0 straight, 1 fully bent; springs back for the flick. */
function bendAmt(t: number) {
  const down = ease.inOutCubic(clamp((t - T_BEND) / 0.9));
  const back = t > T_FLICK - 0.25 ? ease.outBack(clamp((t - (T_FLICK - 0.25)) / 0.3), 3) : 0;
  return down * (1 - back * 1.35);
}
/** Point on the (possibly bent) stroke at arc length s (approximately arc length). */
function stroke(s: number, t: number) {
  const u = s / PL.len;
  const B = bendAmt(t) * 230;
  const y = PL.y + B * u * u;
  const dy = (2 * B * u) / PL.len;
  return { x: PL.x0 + s, y, angle: Math.atan(dy) };
}

export const stops: Station = {
  id: 'stops',
  x0: HOUSE.x + HOUSE.w, x1: CHORUS_X + 200, y0: -900, y1: 60,
  t0: 29.5, t1: 37.3,
  cam: [
    { t: W1[0]!.start, x: TR.x0 + 520, y: -330, z: 0.95, e: ease.inOutCubic },
    { t: W1[4]!.start, x: TR.x0 + 950, y: -320, z: 0.95, e: ease.inOutSine },
    { t: T_END + 0.1, x: END.x - 150, y: -320, z: 1.0, e: ease.inOutSine },
    { t: W2[0]!.start, x: PL.x0 + 340, y: -360, z: 0.92, e: ease.inOutCubic },
    { t: W2[3]!.start, x: PL.x0 + 800, y: -330, z: 0.9, e: ease.inOutSine },
    { t: W2[5]!.start + 0.3, x: PL.x0 + 1050, y: -260, z: 0.82, e: ease.inOutSine },
    { t: T_FLICK - 0.1, x: PL.x0 + 1250, y: -300, z: 0.86, e: ease.inOutSine },
  ],
  hits: [{ t: T_END, amp: 8 }, { t: T_FALLEN, amp: 16, hl: 0.12 }, { t: T_FLICK, amp: 10 }],
  impulse: (t) => (t < T_END ? { x: 0, y: 0 } : null),

  draw(r: R, t: number) {
    const g = r.g;
    const fg = r.c('fg');
    ground(r, HOUSE.x + HOUSE.w, CHORUS_X + 400, 0);

    // ---- balloon on the chimney, the pin and the ball
    const chim = { x: HOUSE.x + HOUSE.w * 0.72 + 20, y: -HOUSE.wall - HOUSE.roof * 0.45 - 70 };
    const inflate = smoothstep(29.5, 30.3, t);
    const lift = ease.inOutQuad(clamp((t - 30.1) / 0.5)) * 70;
    const bx = chim.x + 60, by = chim.y - 120 - lift;
    if (inflate > 0.01) {
      r.circle(bx, by, 20 + 40 * inflate, inflate > 0.2 && t < 31 ? r.mix('fg', 'sig', 1 - smoothstep(30.6, 31, t)) : fg, r.c('panel'), 1.4);
      r.path([{ x: bx, y: by + 20 + 40 * inflate }, { x: chim.x + 20, y: chim.y }]);
      r.stroke(r.c('dim'), 1);
    }
    // tether from the balloon to the pin holding the ball
    const pinUp = ease.outCubic(clamp((t - T_RELEASE + 0.1) / 0.2)) * 30;
    r.path([{ x: bx, y: by + 60 * inflate + 20 }, { x: TR.x0 + 20, y: TR.y0 - 70 - pinUp }]);
    r.stroke(r.c('dim'), 1);
    r.line(TR.x0 + 20 + BR + 4, TR.y0 - 70 - pinUp, TR.x0 + 20 + BR + 4, TR.y0 - pinUp + 4, t > T_RELEASE - 0.2 && t < T_RELEASE + 0.3 ? r.c('sig') : fg, 2);

    // ---- the track and its posts
    r.line(TR.x0 - 30, TR.y0, TR.x1 + 10, TR.y1, fg, 1.6);
    for (let x = TR.x0; x <= TR.x1; x += 300) r.line(x, trackY(x) + 4, x, 0, r.c('dim'), 1);
    orderTag(r, 9, TR.x0 - 10, TR.y0 - 120, 16, hit(t, T_RELEASE, 0.4), smoothstep(29.8, 30.2, t));

    // ---- the ball
    const x = ballX(r, t);
    const heat = t > T_RELEASE ? 1 - smoothstep(T_END + 0.2, T_END + 0.8, t) : 0;
    ball(r, x, trackY(x) - BR, BR, heat, x / BR, t > T_RELEASE && t < T_END ? 500 : 0, 0);

    // ---- lyric 1 above the track
    lyric(r, L1, TEXT1_X, TR.y0 - 70, { size: SIZE, appear: 0.5, vanish: [36.8, 37.17] }, Math.atan2(TR.y1 - TR.y0, TR.x1 - TR.x0));

    // ---- END: a buffer stop that is really a domino
    const ea = endAngle(t);
    const eh = hit(t, T_END, 0.3) + (t > T_TOPPLE && t < T_FALLEN + 0.3 ? 1 : 0);
    r.local(END.x + END.w / 2, trackY(END.x) + 6, ea, 1, () => {
      r.box(0, 0, 0, -END.w, -END.h, END.w, END.h, eh > 0.01 ? r.mix('fg', 'sig', Math.min(1, eh)) : fg, r.c('panel'), 1.8);
      r.local(-END.w / 2, -END.h / 2, -Math.PI / 2, 1, () => {
        r.text('END', 0, 18, archivo(50, 1250, 900), eh > 0.01 ? r.mix('fg', 'sig', Math.min(1, eh)) : fg, 'center');
      });
    });
    label(r, 'BUFFER STOP', END.x - 40, trackY(END.x) + 40, 13, undefined, 'left', 400, 1 - smoothstep(T_TOPPLE, T_TOPPLE + 0.3, t));
    r.alpha(smoothstep(T_FALLEN, T_FALLEN + 0.3, t) * (1 - smoothstep(35, 35.6, t)), () => {
      r.text('(IT DID NOT)', END.x + END.h * 0.5, trackY(END.x) + 50, `400 14px "PlexMono-400"`, r.c('mid'), 'center');
    });
    orderTag(r, 10, END.x + 80, trackY(END.x) - END.h - 30, 16, hit(t, T_FALLEN, 0.4), smoothstep(32.3, 32.7, t));

    // ---- the plotter
    const s = penS(r, t);
    // gantry
    r.line(PL.x0 - 120, PL.rail, PL.x0 + PL.len + 120, PL.rail, fg, 1.6);
    r.line(PL.x0 - 120, PL.rail + 10, PL.x0 + PL.len + 120, PL.rail + 10, r.c('dim'), 1);
    r.line(PL.x0 - 100, PL.rail, PL.x0 - 100, 0, r.c('dim'), 1);
    r.line(PL.x0 + PL.len + 100, PL.rail, PL.x0 + PL.len + 100, 0, r.c('dim'), 1);
    // lever from the fallen END to the plotter's start switch
    const lev = smoothstep(T_FALLEN - 0.05, T_FALLEN + 0.1, t);
    r.local(PL.x0 - 100, -60, -0.25 + lev * 0.4, 1, () => r.box(0, 0, 0, -90, -4, 120, 8, lev > 0.01 && t < 34.3 ? r.c('sig') : fg, r.c('panel'), 1.2));
    const p = stroke(s, t);
    const penX = t < T_PEN0 ? PL.x0 : p.x;
    const writing = t > T_PEN0 && t < T_PEN1;
    r.box(penX, PL.rail, 0, -40, -16, 80, 32, writing ? r.c('sig') : fg, r.c('panel'), 1.4);
    r.line(penX, PL.rail + 16, penX, p.y - 30, writing ? r.c('sig') : fg, 1.4);
    r.poly([{ x: penX - 6, y: p.y - 30 }, { x: penX + 6, y: p.y - 30 }, { x: penX, y: p.y }], writing ? r.c('sig') : fg, r.c('panel'), 1.2);
    label(r, 'PLOTTER · PEN 0.35', PL.x0 - 80, PL.rail - 30, 13, undefined, 'left', 400, smoothstep(33, 33.5, t));
    orderTag(r, 11, PL.x0 + PL.len + 130, PL.rail - 30, 16, hit(t, T_PEN0, 0.4), smoothstep(33, 33.5, t));

    // the stroke, drawn up to the pen
    if (s > 0) {
      g.beginPath();
      const N = 80;
      for (let k = 0; k <= N; k++) {
        const q = stroke((k / N) * s, t);
        if (k === 0) g.moveTo(q.x, q.y); else g.lineTo(q.x, q.y);
      }
      const flick = hit(t, T_FLICK, 0.25);
      r.stroke(r.mix('fg', 'sig', Math.max(writing ? 0.0 : 0, smoothstep(T_BEND, T_BEND + 0.3, t) * (1 - smoothstep(T_FLICK + 0.1, T_FLICK + 0.6, t)), flick)), 2.2);
      // the ruler-straight ghost of what was meant
      if (bendAmt(t) > 0.02) {
        r.alpha(Math.min(1, bendAmt(t) * 2), () => {
          g.setLineDash([r.px(6), r.px(6)]);
          r.line(PL.x0, PL.y, PL.x0 + s, PL.y, r.c('dim'), 1);
          g.setLineDash([]);
          label(r, 'INTENDED', PL.x0 + PL.len - 120, PL.y - 14, 12, r.c('dim'));
          label(r, 'ACTUAL', PL.x0 + PL.len - 110, stroke(PL.len, t).y + 34, 12, r.c('mid'));
        });
      }
    }
    // lyric 2, written by the pen along the stroke (each glyph appears as the pen passes it)
    b2 ??= layout(r, L2, { size: SIZE });
    const at = (q: number) => {
      const a = stroke(q, t);
      return { x: a.x + Math.sin(a.angle) * 24, y: a.y - Math.cos(a.angle) * 24, angle: a.angle };
    };
    for (const b of b2) {
      const lit = t >= b.word.start;
      const cool = smoothstep(b.word.end, b.word.end + 0.45, t);
      // reveal: only the glyphs left of the pen (plus the unsung preview at 30 %)
      const s0 = 60 + b.x;
      const visible = clamp((s - s0) / b.w);
      const A = (1 - smoothstep(36.9, 37.17, t));
      if (visible <= 0) {
        textAlong(r, b.text, at, s0, archivo(SIZE, 1000, 700), r.c('fg'), 0.12 * A * smoothstep(L2.start - 0.6, L2.start - 0.2, t));
        continue;
      }
      textAlong(r, b.text, at, s0, archivo(SIZE, 1000, 700), lit ? r.mix('sig', 'fg', cool) : r.c('fg'), A * (lit ? 1 : 0.35));
    }

    // ---- the first giant domino of the chorus, flicked by the stroke
    const gx = CHORUS_X, gh = 900, gw = 120;
    const ga = t < T_FLICK ? 0 : Math.min(Math.PI / 2, (Math.PI / 2) * ease.inQuad(clamp((t - T_FLICK) / 0.5)));
    r.local(gx + gw / 2, 0, ga, 1, () => {
      r.box(0, 0, 0, -gw, -gh, gw, gh, t > T_FLICK ? r.c('sig') : fg, r.c('panel'), 2);
    });
  },
};
