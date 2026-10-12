// "I pulled a thread and felt the building shake" (16.7 – 20 s).
// The ball drops into a cup hanging on a thread; the thread runs over a pulley and along a washing
// line of words to a blueprint tower, stitched through its facade. The cup sinks, the pull travels
// down the line word by word, and the tower shakes.
import { type R } from '../engine/draw';
import { archivo, mono } from '../engine/fonts';
import { line } from '../engine/lyrics';
import { layout, leader, label, lyric, orderTag, type WordBox } from '../engine/text';
import { clamp, ease, lerp, noise1, smoothstep } from '../engine/util';
import { hit } from '../machine/motion';
import { ball, cup, ground, pulley } from '../machine/parts';
import { LN, type Station } from '../station';
import { EXIT } from './intro';

const L = line(LN.thread);
const W0 = L.words;
const T_CATCH = 16.6;
const CUP_X = EXIT.x + 40;
const CUP_Y0 = -560, CUP_Y1 = -330;
const PUL = { x: CUP_X + 26, y: -860, r: 26 };
const LINE_Y = PUL.y - PUL.r; // the horizontal thread
export const TOWER = { x0: 6260, x1: 6760, roof: -1060 };
const TEXT_X = PUL.x + 110;
const SIZE = 66;

const cupY = (t: number) => (t < T_CATCH ? CUP_Y0 : lerp(CUP_Y0, CUP_Y1, ease.inOutQuad(clamp((t - T_CATCH - 0.05) / 2.6))) + 6 * Math.sin(Math.max(0, t - T_CATCH) * 9) * Math.exp(-Math.max(0, t - T_CATCH) * 4));

/** Tower sway (world px) at t: builds through "felt the building", peaks on "shake". */
export function sway(t: number) {
  const tFelt = W0[5]!.start, tShake = W0[8]!.start;
  const a = 3 * smoothstep(tFelt - 0.2, tFelt + 0.3, t) + 22 * hit(t, tShake, 0.35) + 9 * smoothstep(tShake, tShake + 0.1, t) * (1 - smoothstep(tShake + 0.3, 21.2, t));
  return a * Math.sin(t * 2 * Math.PI * 4.2) + a * 0.4 * noise1(t * 30, 3);
}

let cache: WordBox[] | null = null;

/** Arc position (x) of the pull's spark along the line at time t. */
function sparkX(r: R, t: number) {
  const boxes = (cache ??= layout(r, L, { size: SIZE }));
  const pts: [number, number][] = [[T_CATCH, PUL.x]];
  for (const b of boxes) pts.push([b.word.start, TEXT_X + b.x + b.w * 0.5]);
  pts.push([W0[8]!.start + 0.25, TOWER.x0]);
  if (t <= pts[0]![0]) return PUL.x;
  for (let i = 1; i < pts.length; i++) {
    if (t < pts[i]![0]) {
      const a = pts[i - 1]!, b = pts[i]!;
      return lerp(a[1], b[1], ease.inOutSine((t - a[0]) / (b[0] - a[0])));
    }
  }
  return TOWER.x0;
}

export const thread: Station = {
  id: 'thread',
  x0: EXIT.x - 100, x1: TOWER.x1 + 120, y0: TOWER.roof - 200, y1: 40,
  t0: 16.2, t1: 20.5,
  cam: [
    { t: 16.75, x: PUL.x + 520, y: LINE_Y + 120, z: 1.0, e: ease.inOutCubic },
    { t: W0[2]!.start, x: PUL.x + 800, y: LINE_Y + 110, z: 0.98, e: ease.inOutSine },
    { t: W0[6]!.start, x: TOWER.x0 - 380, y: LINE_Y + 120, z: 0.88, e: ease.inOutSine },
    { t: W0[8]!.start + 0.2, x: TOWER.x0 + 120, y: -620, z: 0.72, e: ease.outCubic },
    { t: 19.55, x: TOWER.x0 + 200, y: -680, z: 0.74, e: ease.linear },
  ],
  hits: [{ t: W0[8]!.start, amp: 10, hl: 0.15 }],
  impulse: (t) => (t < T_CATCH ? null : t < 19.2 ? { x: CUP_X, y: cupY(t) } : null),

  draw(r: R, t: number) {
    const g = r.g;
    const fg = r.c('fg');
    ground(r, EXIT.x - 100, TOWER.x1 + 200, 0);

    // ---- pulley gantry
    r.line(PUL.x, PUL.y, PUL.x, 0, r.c('dim'), 1);
    r.line(PUL.x - 70, 0, PUL.x + 70, 0, fg, 1.4);
    const pulled = (cupY(t) - CUP_Y0);
    pulley(r, PUL.x, PUL.y, PUL.r, pulled / PUL.r, t > T_CATCH && t < 19.2 ? r.c('sig') : fg);
    // thread: cup -> pulley -> along the line -> into the tower
    const cy = cupY(t);
    const sx = sway(t);
    const hot = t > T_CATCH && t < W0[8]!.start + 0.6;
    r.path([{ x: CUP_X - 26, y: cy - 34 }, { x: PUL.x - PUL.r, y: PUL.y }]);
    r.stroke(hot ? r.c('sig') : fg, 1.3);
    r.line(CUP_X - 26, cy - 34, CUP_X - 22, cy - 18, fg, 1);
    // the line, slightly trembling while taut
    const sp = sparkX(r, t);
    g.beginPath();
    for (let x = PUL.x; x <= TOWER.x0 + sx; x += 40) {
      const tremble = hot && x < sp ? noise1(x * 0.05 + t * 40, 7) * 1.5 : 0;
      if (x === PUL.x) g.moveTo(x, LINE_Y); else g.lineTo(x, LINE_Y + tremble);
    }
    g.lineTo(TOWER.x0 + sx, LINE_Y);
    r.stroke(fg, 1.3);
    // the pulled part of the line glows
    if (t > T_CATCH) {
      r.line(PUL.x, LINE_Y, sp, LINE_Y, r.c('sig', hot ? 1 : 0.0), 1.8);
      if (hot) {
        r.circle(sp, LINE_Y, 5, undefined, r.c('ember'));
        r.circle(sp, LINE_Y, 10, r.c('sig', 0.6), undefined, 1);
      }
    }
    // cup with the ball
    cup(r, CUP_X - 24, cy, 50, 36, t > T_CATCH && t < 19.2 ? r.c('sig') : fg);
    if (t >= T_CATCH - 0.15) {
      const by = t < T_CATCH ? lerp(EXIT.y, cy - 14, ease.inQuad(clamp((t - (T_CATCH - 0.15)) / 0.15))) : cy - 16;
      const bx = t < T_CATCH ? lerp(EXIT.x, CUP_X - 24, clamp((t - (T_CATCH - 0.15)) / 0.15)) : CUP_X - 24;
      ball(r, bx, by, 14, t < 19.4 ? 1 - smoothstep(18.9, 19.4, t) : 0, 0);
    }
    orderTag(r, 1, CUP_X - 120, cy - 10, 16, hit(t, T_CATCH, 0.4), smoothstep(16.4, 16.8, t));
    leader(r, CUP_X - 24, cy + 2, CUP_X - 160, cy + 70, 'LOAD: 1 BALL', 13, undefined, smoothstep(16.6, 17.0, t));

    // ---- the lyric, sitting on the line like tags on a washing line
    const boxes = (cache ??= layout(r, L, { size: SIZE }));
    lyric(r, L, TEXT_X, LINE_Y - 22, {
      size: SIZE,
      appear: 0.5,
      fx: (f) => {
        // words after "felt" tremble with the tower
        if (f.i >= 5 && f.state !== 'unsung') {
          const k = f.i === 8 ? 1.2 : 0.35;
          f.dx = sway(t) * k * 0.4;
          f.rot = sway(t) * k * 0.0025;
        }
      },
    }, 0, boxes);
    // little hangers from each word to the line
    for (const b of boxes) {
      const lit = t >= b.word.start;
      r.line(TEXT_X + b.x + 6, LINE_Y - 14, TEXT_X + b.x + 6, LINE_Y, lit ? r.c('sig', 0.8) : r.c('dim'), 1);
    }

    // ---- the tower (blueprint elevation), swaying from its base
    const T = TOWER;
    g.save();
    g.translate(T.x0, 0);
    g.transform(1, 0, sx / T.roof * -1, 1, 0, 0); // shear: top moves by sx
    const w = T.x1 - T.x0;
    r.box(0, 0, 0, 0, T.roof, w, -T.roof, fg, r.c('panel'), 1.6);
    // floors and windows
    const floors = 10;
    for (let f = 1; f < floors; f++) {
      const y = (T.roof * f) / floors;
      r.line(0, y, w, y, r.c('dim'), 1);
    }
    for (let f = 0; f < floors; f++) {
      const y0 = (T.roof * (f + 1)) / floors + 22;
      for (let k = 0; k < 6; k++) {
        const x = 34 + k * 76;
        r.box(x, y0, 0, 0, 0, 40, 56, r.c('dim'), undefined, 1);
      }
    }
    // the stitch: the thread runs in and out of the facade
    const stitch: { x: number; y: number }[] = [];
    for (let k = 0; k <= 9; k++) stitch.push({ x: k % 2 ? w - 60 : 40, y: LINE_Y + k * 70 });
    const tight = smoothstep(W0[5]!.start - 0.3, W0[8]!.start, t);
    g.beginPath();
    stitch.forEach((p, i) => {
      const sag = i > 0 ? (1 - tight) * 14 : 0;
      if (i === 0) g.moveTo(0, LINE_Y);
      g.lineTo(p.x, p.y + sag);
    });
    r.stroke(t > W0[5]!.start && t < 20 ? r.mix('fg', 'sig', 1 - smoothstep(19.4, 20, t)) : fg, 1.3);
    for (const p of stitch) r.circle(p.x, p.y, 3, fg, r.c('panel'), 1);
    // roof parapet and the loose stone (it leaves in the next station)
    r.box(0, T.roof, 0, -10, -16, w + 20, 16, fg, r.c('panel'), 1.4);
    g.restore();
    orderTag(r, 2, T.x1 + 40, T.roof + 140, 16, hit(t, W0[8]!.start, 0.5), smoothstep(18, 18.4, t));
    label(r, 'TOWER, ELEVATION — 10 FLOORS', T.x0, 44, 13, undefined, 'left', 400, smoothstep(17.6, 18.2, t));
    label(r, 'SWAY', T.x1 + 40, T.roof + 200, 13, undefined, 'left', 400, smoothstep(18.6, 18.8, t));
    r.alpha(smoothstep(18.6, 18.8, t), () => {
      r.text(`± ${Math.abs(sx).toFixed(1).padStart(4, '0')} mm`, T.x1 + 40, T.roof + 226, mono(15, 500), Math.abs(sx) > 8 ? r.c('sig') : r.c('mid'));
    });
  },
};
