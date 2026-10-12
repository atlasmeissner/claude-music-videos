// "Said one word on an ordinary night" (23.3 – 26.7 s).
// The flood fills a bucket on a seesaw; the seesaw squeezes a bellows; one word travels as a pulse
// down a long speaking tube under a night sky, passing each word of the line as it is sung.
import { type R } from '../engine/draw';
import { line } from '../engine/lyrics';
import { label, layout, orderTag, textAlong, type WordBox } from '../engine/text';
import { clamp, ease, hash, lerp, smoothstep } from '../engine/util';
import { Path, bezier, join } from '../machine/geom';
import { hit } from '../machine/motion';
import { cup, ground } from '../machine/parts';
import { LN, type Station } from '../station';
import { FLOW_END } from './river';

const L = line(LN.word);
const Wd = L.words; // Said one word on an ordinary night
const SEE = { x: FLOW_END.x + 260, len: 560, y: 0 };
const T_FILL = FLOW_END.t - 0.25;
const T_TIP = Wd[0]!.start - 0.28;
const BEL = { x: SEE.x + SEE.len / 2 - 40, y: -150 }; // bellows bottom plate rest position
const TUBE_Y = -620;
export const HORN = { x: SEE.x + 2150, y: TUBE_Y };
const tubePath = new Path(join(
  [{ x: BEL.x, y: BEL.y - 110 }, { x: BEL.x, y: TUBE_Y + 90 }],
  bezier({ x: BEL.x, y: TUBE_Y + 90 }, { x: BEL.x, y: TUBE_Y }, { x: BEL.x, y: TUBE_Y }, { x: BEL.x + 90, y: TUBE_Y }, 12),
  bezier({ x: BEL.x + 90, y: TUBE_Y }, { x: BEL.x + 800, y: TUBE_Y - 70 }, { x: HORN.x - 700, y: TUBE_Y + 70 }, { x: HORN.x - 60, y: TUBE_Y }, 60),
  [{ x: HORN.x, y: TUBE_Y }],
));
const SIZE = 64;
const TEXT_S0 = 430; // arc length where the lyric starts along the tube
export const T_OUT = Wd[6]!.start + 0.35; // the pulse leaves the horn

const tilt = (t: number) => 0.16 * ease.outBack(clamp((t - T_TIP) / 0.3), 1.4) - 0.08;
const squeeze = (t: number) => smoothstep(T_TIP + 0.05, Wd[0]!.start, t) * (1 - smoothstep(Wd[2]!.start + 0.4, Wd[2]!.start + 1.4, t));

let boxes: WordBox[] | null = null;
/** Arc length of the pulse along the tube at t. */
function pulseS(r: R, t: number) {
  boxes ??= layout(r, L, { size: SIZE });
  const pts: [number, number][] = [[Wd[0]!.start - 0.25, 0]];
  for (const b of boxes) pts.push([b.word.start, TEXT_S0 + b.x + Math.min(b.w * 0.5, 40)]);
  pts.push([T_OUT, tubePath.length]);
  if (t <= pts[0]![0]) return -1;
  for (let i = 1; i < pts.length; i++) {
    if (t < pts[i]![0]) {
      const a = pts[i - 1]!, b = pts[i]!;
      return lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
    }
  }
  return t < T_OUT + 0.4 ? tubePath.length : -1;
}

// a fixed field of stars over this stretch of the machine
const STARS = Array.from({ length: 140 }, (_, i) => ({
  x: SEE.x - 600 + hash(i, 1) * 3600, y: -1500 + hash(i, 2) * 820, s: 0.6 + hash(i, 3) * 1.6, ph: hash(i, 4),
}));

export const tube: Station = {
  id: 'tube',
  x0: FLOW_END.x - 100, x1: HORN.x + 200, y0: -1600, y1: 60,
  t0: 22.8, t1: 26.9,
  cam: [
    { t: 23.35, x: SEE.x + 300, y: -330, z: 0.95, e: ease.inOutCubic },
    { t: Wd[2]!.start + 0.2, x: BEL.x + 640, y: TUBE_Y + 60, z: 0.86, e: ease.inOutSine },
    { t: Wd[5]!.start, x: BEL.x + 1300, y: TUBE_Y - 40, z: 0.82, e: ease.inOutSine },
    { t: Wd[6]!.start + 0.3, x: HORN.x - 200, y: TUBE_Y - 140, z: 0.8, e: ease.inOutSine },
  ],
  hits: [{ t: Wd[0]!.start, amp: 4 }],
  impulse: (t) => (t < Wd[0]!.start ? { x: SEE.x - SEE.len / 2, y: -40 } : null),

  draw(r: R, t: number) {
    const g = r.g;
    const fg = r.c('fg');
    ground(r, FLOW_END.x, HORN.x + 300, 0);

    // ---- the night
    const night = smoothstep(Wd[0]!.start - 0.6, Wd[4]!.start, t);
    if (night > 0.01) {
      for (const s of STARS) {
        const tw = 0.6 + 0.4 * Math.sin(t * 3 + s.ph * 20);
        const lit = s.ph < 0.15 ? hit(t, Wd[6]!.start + s.ph * 2, 0.6) : 0;
        r.circle(s.x, s.y, r.px(s.s) + lit * 2, undefined, lit > 0.05 ? r.c('sig', lit) : r.c('fg', night * tw * 0.8));
      }
      // crescent moon
      const mx = HORN.x - 380, my = -1240;
      r.alpha(night, () => {
        r.circle(mx, my, 70, undefined, r.c('fg'));
        r.circle(mx + 28, my - 16, 64, undefined, r.c('bg'));
      });
      label(r, 'AN ORDINARY NIGHT. NOTHING TO REPORT.', mx - 150, my + 130, 14, undefined, 'left', 400, smoothstep(Wd[5]!.start, Wd[5]!.start + 0.4, t));
      label(r, 'WEATHER: CLEAR · WIND: NONE · 23:41', mx - 150, my + 154, 12, r.c('dim'), 'left', 400, smoothstep(Wd[5]!.start + 0.3, Wd[5]!.start + 0.7, t));
    }

    // ---- seesaw with the bucket
    const a = t < T_TIP ? -0.08 : tilt(t);
    const fill = clamp((t - T_FILL) / 0.5);
    r.poly([{ x: SEE.x, y: -46 }, { x: SEE.x - 34, y: 0 }, { x: SEE.x + 34, y: 0 }], fg, r.c('panel'), 1.4);
    r.local(SEE.x, -46, -a, 1, () => {
      r.box(0, 0, 0, -SEE.len / 2, -8, SEE.len, 8, t > T_TIP && t < Wd[1]!.start + 0.3 ? r.c('sig') : fg, r.c('panel'), 1.5);
      cup(r, -SEE.len / 2 + 50, -8, 90, 70, fg, fill * 0.9, r.c('sig', 0.75 * (1 - smoothstep(Wd[1]!.start, Wd[3]!.start, t)) + 0.15));
    });
    // falling water into the bucket
    if (t > T_FILL - 0.2 && t < T_TIP + 0.3) {
      const k = 1 - smoothstep(T_TIP, T_TIP + 0.3, t);
      r.alpha(k, () => {
        for (let q = 0; q < 3; q++) {
          g.beginPath();
          g.moveTo(FLOW_END.x - 10 + q * 6, -24);
          g.quadraticCurveTo(SEE.x - SEE.len / 2 + 20, -40, SEE.x - SEE.len / 2 + 46 + q * 8, -60);
          r.stroke(r.c('sig'), 1.2);
        }
      });
    }

    // ---- bellows above the right end of the seesaw
    const sq = squeeze(t);
    const bTop = BEL.y - 110;
    const bBot = BEL.y - sq * 60;
    r.box(BEL.x, bBot, 0, -60, 0, 120, 10, fg, r.c('panel'), 1.4);
    r.box(BEL.x, bTop, 0, -60, -10, 120, 10, fg, r.c('panel'), 1.4);
    g.beginPath();
    const folds = 6;
    for (const side of [-1, 1]) {
      for (let k = 0; k <= folds; k++) {
        const y = lerp(bBot, bTop, k / folds);
        const x = BEL.x + side * (k % 2 ? 46 : 60);
        if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
    }
    r.stroke(sq > 0.05 && t < Wd[2]!.start + 0.6 ? r.c('sig') : fg, 1.3);
    r.line(BEL.x, bBot + 10, BEL.x, -46 - Math.sin(a) * (SEE.len / 2 - 40) + 12, r.c('dim'), 1);
    orderTag(r, 5, BEL.x + 90, bBot - 30, 16, hit(t, Wd[0]!.start, 0.4), smoothstep(23, 23.4, t));
    label(r, 'BELLOWS', BEL.x + 90, bBot + 4, 13, undefined, 'left', 400, smoothstep(23, 23.4, t));
    orderTag(r, 4, SEE.x - SEE.len / 2 + 10, -170, 16, hit(t, T_TIP, 0.4), smoothstep(22.8, 23.2, t));

    // ---- the speaking tube (a double line) with the pulse
    const ps = pulseS(r, t);
    const tubeW = 22;
    const N = Math.ceil(tubePath.length / 14);
    for (const side of [-1, 1]) {
      g.beginPath();
      for (let k = 0; k <= N; k++) {
        const s = (k / N) * tubePath.length;
        const p = tubePath.at(s);
        const bulge = ps >= 0 ? Math.exp(-(((s - ps) / 50) ** 2)) * 12 : 0;
        const off = side * (tubeW / 2 + bulge);
        const x = p.x - Math.sin(p.angle) * off, y = p.y + Math.cos(p.angle) * off;
        if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      r.stroke(fg, 1.4);
    }
    // the horn
    r.local(HORN.x, HORN.y, 0.5, 1, () => {
      r.path([{ x: 0, y: -tubeW / 2 }, { x: 140, y: -70 }, { x: 140, y: 70 }, { x: 0, y: tubeW / 2 }]);
      r.stroke(t > T_OUT - 0.1 && t < T_OUT + 0.5 ? r.c('sig') : fg, 1.5);
    });
    // the travelled part of the tube glows; the pulse is a bright bead
    if (ps >= 0) {
      const trail = tubePath.slice(Math.max(0, ps - 260), ps);
      r.path(trail);
      r.stroke(r.c('sig', 0.85), 2.2);
      const p = tubePath.at(ps);
      r.circle(p.x, p.y, 9, undefined, r.c('ember'));
      r.circle(p.x, p.y, 18, r.c('sig', 0.6), undefined, 1.2);
    }
    // sound rings leaving the horn
    if (t > T_OUT - 0.1) {
      const tau = t - (T_OUT - 0.1);
      for (let q = 0; q < 3; q++) {
        const rr = 40 + (tau - q * 0.08) * 700;
        if (rr < 40 || tau > 1.2) continue;
        g.beginPath();
        g.arc(HORN.x + 80, HORN.y + 40, rr, -0.1, 1.3);
        r.stroke(r.c('sig', Math.max(0, 1 - tau / 1.2)), 1.5);
      }
    }

    // ---- the lyric along the tube
    boxes ??= layout(r, L, { size: SIZE });
    const A = smoothstep(L.start - 0.6, L.start - 0.2, t);
    if (A > 0) {
      const at = (s: number) => {
        const p = tubePath.at(s);
        return { x: p.x + Math.sin(p.angle) * 34, y: p.y - Math.cos(p.angle) * 34, angle: p.angle };
      };
      for (const b of boxes) {
        const st = t < b.word.start ? 0 : 1;
        const cool = smoothstep(b.word.end, b.word.end + 0.45, t);
        const col = st ? r.mix('sig', 'fg', cool) : r.c('fg');
        textAlong(r, b.text, at, TEXT_S0 + b.x, `700 ${SIZE}px "Archivo-w1000-700"`, col, A * (st ? 1 : 0.32));
      }
    }
  },
};
