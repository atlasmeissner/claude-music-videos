// "Moved a stone and watched the river break" (20 – 23.3 s).
// The shaking shakes a stone off the roof; it slides down a chute under the first half of the line,
// knocks the keystone out of a dam, and the reservoir (drawn as contour lines) breaks through and
// runs off to the right, carrying the rest of the line.
import { type R } from '../engine/draw';
import { line, type Line } from '../engine/lyrics';
import { layout, label, lyric, orderTag } from '../engine/text';
import { clamp, ease, lerp, noise1, noise2, smoothstep } from '../engine/util';
import { hit } from '../machine/motion';
import { ground } from '../machine/parts';
import { LN, type Station } from '../station';
import { TOWER, sway } from './thread';

const L = line(LN.stone);
const Wd = L.words; // Moved a stone and watched the river break
const L1: Line = { ...L, words: Wd.slice(0, 5) };
const L2: Line = { ...L, words: Wd.slice(5), start: Wd[5]!.start };

const STONE = { w: 54, h: 38 };
const T_TIP = Wd[0]!.start - 0.12;
const CH0 = { x: TOWER.x1 + 120, y: TOWER.roof + 190 }; // chute top
export const DAM = { x: 7700, w: 90, h: 330 };
const CH1 = { x: DAM.x - 6, y: -DAM.h - 40 }; // chute bottom, just above the keystone
const CH_ANG = Math.atan2(CH1.y - CH0.y, CH1.x - CH0.x);
const CH_LEN = Math.hypot(CH1.x - CH0.x, CH1.y - CH0.y);
const RES = { x0: TOWER.x1 + 60, level: -280 };
const T_KEY = Wd[4]!.start; // "watched": the stone hits the keystone
const T_BREAK = Wd[7]!.start; // "break"
export const FLOW_END = { x: 9050, t: 23.15 };
const SIZE = 60;

/** Stone position and rotation. */
function stone(t: number) {
  const top = { x: TOWER.x1 - 40, y: TOWER.roof - 16 - STONE.h / 2 };
  if (t < T_TIP) return { x: top.x + sway(t), y: top.y, rot: 0, hot: 0 };
  const tLand = Wd[2]!.start; // lands on the chute on "stone"
  if (t < tLand) {
    const u = (t - T_TIP) / (tLand - T_TIP);
    return { x: lerp(top.x, CH0.x + 30, u), y: lerp(top.y, CH0.y - STONE.h / 2, ease.inQuad(u)), rot: u * 1.6, hot: 1 };
  }
  if (t < T_KEY) {
    // slides down, accelerating, reaching the end of the chute on "watched"
    const u = ease.inQuad((t - tLand) / (T_KEY - tLand));
    const s = 30 + (CH_LEN - 30) * u;
    return { x: CH0.x + Math.cos(CH_ANG) * s + Math.sin(CH_ANG) * STONE.h / 2, y: CH0.y + Math.sin(CH_ANG) * s - Math.cos(CH_ANG) * STONE.h / 2, rot: CH_ANG, hot: 1 };
  }
  // drops into the reservoir behind the dam
  const tau = t - T_KEY;
  const sink = Math.min(tau, 1.2);
  return { x: CH1.x - 40 - sink * 20, y: Math.min(-DAM.h - 10 + 3000 * 0.5 * Math.min(tau, 0.16) ** 2 + sink * 120, -30), rot: CH_ANG + tau * 2, hot: Math.max(0, 1 - tau / 0.6) };
}

/** Water level of the reservoir (y) and flow front (x). */
const level = (t: number) => lerp(RES.level, -60, ease.outCubic(clamp((t - T_BREAK) / 1.6)));
const front = (t: number) => (t < T_BREAK ? DAM.x + DAM.w : lerp(DAM.x + DAM.w, FLOW_END.x, ease.outQuad(clamp((t - T_BREAK) / (FLOW_END.t - T_BREAK)))));

// dam: 4 courses x 2 blocks; the top one is the keystone
const BLOCKS = Array.from({ length: 8 }, (_, i) => ({ c: Math.floor(i / 2), k: i % 2 }));

export const river: Station = {
  id: 'river',
  x0: TOWER.x1, x1: FLOW_END.x + 200, y0: TOWER.roof - 100, y1: 60,
  t0: 19.6, t1: 23.4,
  cam: [
    { t: 20.15, x: TOWER.x1 + 280, y: -760, z: 0.86, e: ease.inOutCubic },
    { t: T_KEY - 0.05, x: DAM.x - 160, y: -420, z: 0.92, e: ease.inOutSine },
    { t: T_BREAK + 0.05, x: DAM.x + 60, y: -330, z: 0.95, e: ease.inOutSine },
    { t: 23.0, x: DAM.x + 820, y: -310, z: 0.9, e: ease.inOutCubic },
  ],
  hits: [{ t: T_KEY, amp: 6 }, { t: T_BREAK, amp: 14, hl: 0.2 }],
  impulse: (t) => (t < T_KEY ? stone(t) : { x: front(t), y: -20 }),

  draw(r: R, t: number) {
    const g = r.g;
    const fg = r.c('fg');
    ground(r, TOWER.x1 + 120, FLOW_END.x + 400, 0);

    // ---- reservoir basin: back wall at the tower side
    r.line(RES.x0, 0, RES.x0, RES.level - 40, fg, 1.4);
    // contour lines of the water
    const lv = level(t);
    const nLines = 9;
    for (let k = 0; k < nLines; k++) {
      const y = lerp(lv, -8, k / nLines);
      g.beginPath();
      for (let x = RES.x0; x <= DAM.x; x += 24) {
        const wv = noise2(x * 0.004, t * 0.6 + k, 5) * 4 + (t > T_BREAK ? noise1(x * 0.02 - t * 8, k) * 5 * hit(t, T_BREAK, 1.2) : 0);
        if (x === RES.x0) g.moveTo(x, y + wv); else g.lineTo(x, y + wv);
      }
      r.stroke(k === 0 ? fg : r.c('dim'), k === 0 ? 1.3 : 1);
    }
    label(r, 'RESERVOIR', RES.x0 + 30, lv + 34, 13, undefined, 'left', 400, 1 - smoothstep(T_BREAK, T_BREAK + 0.5, t));

    // ---- chute
    r.line(CH0.x, CH0.y, CH1.x, CH1.y, fg, 1.6);
    r.line(CH0.x, CH0.y + 8, CH1.x, CH1.y + 8, r.c('dim'), 1);
    r.line(CH0.x + 60, CH0.y + 30, CH0.x + 60, RES.level - 40, r.c('dim'), 1);

    // ---- dam
    const bw = DAM.w / 2, bh = DAM.h / 4;
    for (const b of BLOCKS) {
      const x = DAM.x + b.k * bw, y = -(b.c + 1) * bh;
      const key = b.c === 3 && b.k === 0;
      let dx = 0, dy = 0, rot = 0, hot = 0;
      if (key && t > T_KEY) {
        // the keystone is knocked out first
        const tau = t - T_KEY;
        dx = 260 * tau; dy = Math.min(-120 * tau + 1500 * tau * tau, -y - bh); rot = tau * 3;
        hot = Math.max(0, 1 - tau / 0.8);
      } else if (t > T_BREAK) {
        const tau = t - T_BREAK;
        const push = (4 - b.c) * 0.35 + b.k * 0.2;
        dx = (220 + 120 * push) * tau; dy = Math.min(-80 * push * tau + 1800 * tau * tau, -y - bh); rot = tau * (1.2 + push) * (b.k ? 1 : -1);
        hot = Math.max(0, 1 - tau / 0.7);
      }
      const crack = smoothstep(Wd[6]!.start, T_BREAK, t) * (1 - smoothstep(T_BREAK, T_BREAK + 0.1, t));
      const jit = crack * noise1(t * 60, b.c * 3 + b.k) * 2;
      r.box(x + bw / 2 + dx + jit, y + bh / 2 + dy, rot, -bw / 2, -bh / 2, bw, bh, hot > 0.01 ? r.mix('fg', 'sig', hot) : fg, r.c('panel'), 1.4);
      // crack lines appear on "river"
      if (crack > 0.01 && !key) {
        r.alpha(crack, () => {
          g.beginPath();
          let cx = x + bw * 0.5, cy = y + 4;
          g.moveTo(cx, cy);
          for (let q = 0; q < 4; q++) {
            cx += noise1(q * 3.1, b.c * 7 + b.k) * bw * 0.4;
            cy += bh / 4;
            g.lineTo(cx, cy);
          }
          r.stroke(r.c('sig'), 1.2);
        });
      }
    }
    orderTag(r, 3, DAM.x + DAM.w + 30, -DAM.h - 30, 16, hit(t, T_KEY, 0.4), smoothstep(20.2, 20.6, t) * (1 - smoothstep(T_BREAK, T_BREAK + 0.3, t)));
    label(r, 'DAM, 4 COURSES', DAM.x - 10, 40, 13, undefined, 'left', 400, smoothstep(20.5, 21, t));

    // ---- the flood: orange contour lines rushing right along the ground
    if (t > T_BREAK) {
      const fx = front(t);
      const age = t - T_BREAK;
      for (let k = 0; k < 6; k++) {
        const depth = lerp(70, 6, k / 6) * (1 - 0.6 * smoothstep(0.5, 2.5, age));
        g.beginPath();
        let started = false;
        for (let x = DAM.x; x <= fx; x += 18) {
          const u = (x - DAM.x) / Math.max(1, fx - DAM.x);
          const h = depth * (1 - u * u * 0.85) * (k / 6 + 0.15);
          const y = -h - noise2(x * 0.01 - t * 3, k * 1.7, 9) * 6 * (1 - u * 0.5);
          if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
        }
        const heat = 1 - smoothstep(FLOW_END.t, FLOW_END.t + 1.2, t);
        r.stroke(k < 2 ? r.mix('fg', 'sig', heat) : r.mix('dim', 'sig', heat * 0.7), k === 0 ? 1.6 : 1.1);
      }
      // spray at the front
      if (t < FLOW_END.t + 0.3) {
        for (let q = 0; q < 10; q++) {
          const a = noise1(q * 1.3 + t * 5, 3) * 0.8 - 1.1;
          const d = (q % 5) * 9 + 6;
          r.circle(fx + Math.cos(a) * d, -20 + Math.sin(a) * d, r.px(1.6), undefined, r.c('sig', 0.8));
        }
      }
    }

    // ---- the stone
    const s = stone(t);
    r.box(s.x, s.y, s.rot, -STONE.w / 2, -STONE.h / 2, STONE.w, STONE.h, s.hot > 0.01 ? r.mix('fg', 'sig', s.hot) : fg, s.hot > 0.5 ? r.c('sig', 0.35) : r.c('panel'), 1.6);

    // ---- lyric: the first half rides down the chute, the rest is carried on the flood
    const nx = Math.sin(CH_ANG), ny = -Math.cos(CH_ANG);
    lyric(r, L1, CH0.x + 70 + nx * 34, CH0.y + ny * 34, { size: SIZE, appear: 0.45 }, CH_ANG);
    const boxes2 = layout(r, L2, { size: SIZE });
    lyric(r, L2, DAM.x + DAM.w + 70, -200, {
      size: SIZE,
      appear: 0.4,
      fx: (f) => {
        if (t > T_BREAK) {
          const tau = t - T_BREAK;
          f.dx = 90 * ease.outCubic(clamp(tau / 1.4)) + f.box.x * 0.08 * ease.outCubic(clamp(tau / 1.4));
          f.dy = noise1(t * 2 + f.i, 4) * 10 * Math.min(1, tau * 2);
          f.rot = noise1(t * 1.5 + f.i * 3, 6) * 0.05 * Math.min(1, tau * 2);
        }
      },
    }, 0, boxes2);
  },
};
