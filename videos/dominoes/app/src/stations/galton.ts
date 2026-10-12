// Interlude (50.2 – 61.7 s): the apparatus of second-order thinking. One ball per beat drops into a
// pegboard; every row of pegs is one more "and then?"; each peg strike lands on an eighth note.
// The balls pile up in the bins below as a bell curve. The last ball leaves through a trapdoor.
import { BEAT, beatsIn } from '../engine/audio';
import { type R } from '../engine/draw';
import { archivo, mono } from '../engine/fonts';
import { label, orderTag } from '../engine/text';
import { clamp, ease, hash, lerp, smoothstep } from '../engine/util';
import { hit } from '../machine/motion';
import { ball, ground } from '../machine/parts';
import { type Station } from '../station';

export interface GaltonCfg { x: number }

const ROWS = 9;
const PEG_DX = 64, PEG_DY = 92;
const T_IN = 50.45;
const T_OUT = 61.2;

export function makeGalton(cfg: GaltonCfg) {
  const X = cfg.x; // centre of the board
  const TOP = -1300;
  const BIN_Y = TOP + (ROWS + 1) * PEG_DY + 40; // top of the bins
  const FLOOR = -40;
  const ROW_DT = BEAT / 2; // one row per eighth note
  // one ball per beat
  const drops = beatsIn(T_IN, T_OUT - ROWS * ROW_DT - 0.6);
  const balls = drops.map((t0, i) => {
    let pos = 0;
    const path = [0];
    for (let k = 0; k < ROWS; k++) {
      pos += hash(i, k, 77) < 0.5 ? -1 : 1;
      path.push(pos);
    }
    return { t0, path, bin: pos, last: i === drops.length - 1 };
  });
  // bin fill order
  const binCount = new Map<number, number>();
  const stackIdx = balls.map((b) => {
    const n = binCount.get(b.bin) ?? 0;
    binCount.set(b.bin, n + 1);
    return n;
  });
  const pegX = (k: number, j: number) => X + (j - k / 2) * PEG_DX;
  const BR = 13;

  function ballPos(i: number, t: number) {
    const b = balls[i]!;
    const tau = t - b.t0;
    if (tau < 0) return null;
    const k = Math.floor(tau / ROW_DT);
    if (k < ROWS) {
      const u = tau / ROW_DT - k;
      const x0 = X + (b.path[k]! * PEG_DX) / 2, x1 = X + (b.path[k + 1]! * PEG_DX) / 2;
      const y0 = TOP + k * PEG_DY - BR - 6, y1 = TOP + (k + 1) * PEG_DY - BR - 6;
      // a small hop off each peg
      const y = lerp(y0, y1, u * u) - Math.sin(u * Math.PI) * 18;
      return { x: lerp(x0, x1, u), y, heat: 1, moving: true };
    }
    // falls into its bin and stacks
    const tf = tau - ROWS * ROW_DT;
    const bx = X + (b.bin * PEG_DX) / 2;
    const restY = FLOOR - BR - stackIdx[i]! * (BR * 2 + 1);
    const y = Math.min(restY, TOP + ROWS * PEG_DY - BR - 6 + 2400 * tf * tf);
    const heat = y < restY ? 1 : Math.max(0, 1 - (tf - Math.sqrt((restY - (TOP + ROWS * PEG_DY)) / 2400)) / 0.4);
    if (b.last && t > T_OUT) {
      // the last ball drops through the trapdoor and rolls off to the right
      const tt = t - T_OUT;
      return { x: bx + 900 * tt * tt * 1.5, y: restY + Math.min(40, 900 * tt * tt), heat: 1, moving: true };
    }
    return { x: bx, y, heat: Math.max(0, Math.min(1, heat)), moving: y < restY };
  }

  const station: Station = {
    id: 'galton',
    x0: X - 900, x1: X + 1400, y0: TOP - 300, y1: 60,
    t0: 50.0, t1: 62,
    cam: [
      { t: 50.6, x: X + 160, y: (TOP + FLOOR) / 2 - 120, z: 0.74, e: ease.inOutCubic },
      { t: 59.2, x: X + 140, y: (TOP + FLOOR) / 2 - 40, z: 0.8, e: ease.linear },
      { t: 61.0, x: X + 260, y: FLOOR - 260, z: 1.05, e: ease.inOutCubic },
    ],
    impulse: (t) => {
      const i = balls.length - 1;
      return t > balls[i]!.t0 ? ballPos(i, t) : null;
    },
    draw(r: R, t: number) {
      const g = r.g;
      const fg = r.c('fg');
      ground(r, X - 900, X + 1400, 0);
      // frame of the board
      const halfW = (ROWS / 2 + 1.5) * PEG_DX;
      r.path([{ x: X - halfW, y: TOP - 120 }, { x: X - halfW, y: FLOOR }, { x: X + halfW, y: FLOOR }, { x: X + halfW, y: TOP - 120 }]);
      r.stroke(fg, 1.6);
      r.path([{ x: X - 60, y: TOP - 220 }, { x: X - 12, y: TOP - 70 }]);
      r.stroke(fg, 1.4);
      r.path([{ x: X + 60, y: TOP - 220 }, { x: X + 12, y: TOP - 70 }]);
      r.stroke(fg, 1.4);
      // pegs: each lights when struck
      for (let k = 0; k < ROWS; k++) {
        for (let j = 0; j <= k; j++) {
          const px = pegX(k, j), py = TOP + k * PEG_DY;
          let h = 0;
          for (const b of balls) {
            const tk = b.t0 + k * ROW_DT;
            if (t >= tk && t < tk + 0.5 && X + (b.path[k]! * PEG_DX) / 2 === px) h = Math.max(h, hit(t, tk, 0.1));
          }
          r.circle(px, py, 7, h > 0.01 ? r.mix('fg', 'sig', h) : fg, h > 0.3 ? r.c('sig') : r.c('panel'), 1.3);
        }
        // the row's question
        const tRow = balls[0] ? balls[0].t0 + k * ROW_DT : 0;
        const a = smoothstep(tRow - 0.2, tRow + 0.1, t);
        const q = k === 0 ? 'WHAT HAPPENS NEXT?' : 'AND THEN?';
        r.alpha(a, () => {
          r.text(`${k + 1}°`, X - halfW - 40, TOP + k * PEG_DY + 6, mono(17, 600), k === 0 ? r.c('fg') : r.c('mid'), 'right');
          r.text(q, X - halfW - 90, TOP + k * PEG_DY + 6, mono(15), r.c('mid'), 'right');
        });
      }
      r.alpha(smoothstep(51.5, 52, t), () => {
        r.text('MOST PEOPLE STOP HERE →', X - halfW - 90, TOP - 34, mono(13), r.c('sig'), 'right');
      });
      // bins
      for (let j = -ROWS - 1; j <= ROWS + 1; j += 2) {
        const bx = X + (j * PEG_DX) / 2;
        r.line(bx, BIN_Y, bx, FLOOR, r.c('dim'), 1);
      }
      // trapdoor under the last ball's bin
      const last = balls[balls.length - 1]!;
      const tdx = X + (last.bin * PEG_DX) / 2;
      const open = ease.outCubic(clamp((t - T_OUT + 0.05) / 0.2));
      r.local(tdx - PEG_DX / 2, FLOOR, open * 1.2, 1, () => r.line(0, 0, PEG_DX, 0, open > 0 ? r.c('sig') : fg, 2));
      // the balls
      balls.forEach((b, i) => {
        const p = ballPos(i, t);
        if (!p) return;
        ball(r, p.x, p.y, BR, b.last && t > b.t0 ? Math.max(p.heat, 0.9) : p.heat * (p.moving ? 1 : 0.6), p.y / BR);
      });
      // title block of the figure
      r.alpha(smoothstep(50.5, 51.2, t), () => {
        r.text('AND THEN?', X + halfW + 80, TOP + 40, archivo(96, 1000, 900), r.c('fg'));
        r.text('FIG. 13 — SECOND-ORDER THINKING (APPARATUS)', X + halfW + 84, TOP + 84, mono(15, 500), r.c('mid'));
        r.text('ONE BALL PER BEAT · ONE ROW PER EIGHTH NOTE', X + halfW + 84, TOP + 110, mono(13), r.c('dim'));
      });
      // live count of consequences traced
      const traced = balls.reduce((s, b) => s + clamp(Math.floor((t - b.t0) / ROW_DT) + 1, 0, ROWS), 0);
      r.alpha(smoothstep(50.8, 51.4, t), () => {
        r.text(`${traced}`, X + halfW + 80, TOP + 330, archivo(150, 750, 900), r.c('sig'));
        r.text('CONSEQUENCES TRACED', X + halfW + 86, TOP + 370, mono(15, 500), r.c('mid'));
      });
      orderTag(r, ROWS, X + halfW + 30, FLOOR - 40, 16, 0, smoothstep(55, 56, t));
      label(r, 'BINS: WHERE THINGS END UP', X - halfW, 34, 13, undefined, 'left', 400, smoothstep(53, 54, t));
      void g;
    },
  };
  const lastBall = balls[balls.length - 1]!;
  return { station, exit: { x: X + (lastBall.bin * PEG_DX) / 2, y: FLOOR, t: T_OUT }, ballPos: (t: number) => ballPos(balls.length - 1, t) };
}
