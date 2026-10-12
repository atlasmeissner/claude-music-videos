// "And set a stranger's world alight" (26.7 – 30.7 s).
// The horn's blast pushes a match along the striker of its box; the match falls, lit, onto a fuse;
// the spark runs under the words to a stranger's house, whose windows light one by one.
import { type R } from '../engine/draw';
import { line } from '../engine/lyrics';
import { label, layout, leader, lyric, orderTag, type WordBox } from '../engine/text';
import { clamp, ease, lerp, noise1, smoothstep } from '../engine/util';
import { hit } from '../machine/motion';
import { ground } from '../machine/parts';
import { LN, type Station } from '../station';
import { HORN, T_OUT } from './tube';

const L = line(LN.alight);
const Wd = L.words; // And set a stranger's world alight
const BOX = { x: HORN.x + 260, y: -260, w: 180, h: 54 }; // matchbox on a shelf
const T_STRIKE = Wd[1]!.start; // "set"
const T_DROP = Wd[2]!.start; // falls off the shelf
const FUSE = { x0: BOX.x + BOX.w + 60, x1: BOX.x + BOX.w + 1400, y: -6 };
export const HOUSE = { x: FUSE.x1 + 40, w: 460, wall: 300, roof: 190 };
const T_HOUSE = Wd[4]!.start + 0.3; // just after "world": the spark reaches the house
const T_ALIGHT = Wd[5]!.start;
const SIZE = 64;
const TEXT_X = FUSE.x0 + 40;

let boxes: WordBox[] | null = null;
function sparkX(r: R, t: number) {
  boxes ??= layout(r, L, { size: SIZE });
  const pts: [number, number][] = [[T_DROP + 0.3, FUSE.x0]];
  for (const b of boxes.slice(2, 5)) pts.push([b.word.start, TEXT_X + b.x + b.w * 0.5]);
  pts.push([T_HOUSE, FUSE.x1]);
  if (t < pts[0]![0]) return -1;
  for (let i = 1; i < pts.length; i++) if (t < pts[i]![0]) {
    const a = pts[i - 1]!, b = pts[i]!;
    return lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
  }
  return t < T_HOUSE + 0.2 ? FUSE.x1 : -1;
}

/** The match: position of its head and rotation. */
function match(t: number) {
  const rest = { x: BOX.x + 40, y: BOX.y - BOX.h - 6 };
  if (t < T_OUT) return { x: rest.x, y: rest.y, rot: 0, lit: 0 };
  if (t < T_STRIKE) {
    const u = ease.inQuad(clamp((t - T_OUT) / (T_STRIKE - T_OUT)));
    return { x: rest.x + u * (BOX.w - 40), y: rest.y, rot: 0, lit: 0 };
  }
  if (t < T_DROP) {
    const u = (t - T_STRIKE) / (T_DROP - T_STRIKE);
    return { x: BOX.x + BOX.w + u * 30, y: rest.y, rot: u * 0.3, lit: 1 };
  }
  const tau = t - T_DROP;
  const fallT = 0.3;
  const u = clamp(tau / fallT);
  return { x: BOX.x + BOX.w + 30 + u * 60, y: lerp(rest.y, FUSE.y - 6, ease.inQuad(u)), rot: 0.3 + u * 1.2, lit: Math.max(0, 1 - Math.max(0, tau - fallT) / 1.5) };
}

export const matchSt: Station = {
  id: 'match',
  x0: HORN.x, x1: HOUSE.x + HOUSE.w + 300, y0: -900, y1: 60,
  t0: 26.3, t1: 30.8,
  cam: [
    { t: Wd[1]!.start + 0.1, x: BOX.x + 520, y: -300, z: 1.0, e: ease.inOutCubic },
    { t: Wd[3]!.start, x: TEXT_X + 520, y: -260, z: 0.92, e: ease.inOutSine },
    { t: T_HOUSE + 0.2, x: HOUSE.x - 80, y: -300, z: 0.86, e: ease.inOutSine },
    { t: 30.3, x: HOUSE.x + 120, y: -320, z: 0.9, e: ease.inOutSine },
  ],
  hits: [{ t: T_ALIGHT, amp: 5 }],
  impulse: (t) => {
    if (t < T_DROP) return match(t);
    return null;
  },

  draw(r: R, t: number) {
    const g = r.g;
    const fg = r.c('fg');
    ground(r, HORN.x, HOUSE.x + HOUSE.w + 600, 0);

    // ---- shelf and matchbox
    r.line(BOX.x - 40, BOX.y, BOX.x + BOX.w + 20, BOX.y, fg, 1.6);
    r.line(BOX.x - 20, BOX.y, BOX.x - 20, 0, r.c('dim'), 1);
    r.box(BOX.x, BOX.y, 0, 0, -BOX.h, BOX.w, BOX.h, fg, r.c('panel'), 1.4);
    // striker (hatched strip)
    const striker = [{ x: BOX.x + 6, y: BOX.y - BOX.h }, { x: BOX.x + BOX.w - 6, y: BOX.y - BOX.h }, { x: BOX.x + BOX.w - 6, y: BOX.y - BOX.h + 12 }, { x: BOX.x + 6, y: BOX.y - BOX.h + 12 }];
    r.hatch(striker, r.c('dim'), 5);
    label(r, 'SAFETY MATCHES · 40', BOX.x + 10, BOX.y - 14, 12, undefined, 'left', 400);
    orderTag(r, 6, BOX.x - 70, BOX.y - 90, 16, hit(t, T_STRIKE, 0.4), smoothstep(26.2, 26.6, t));

    // ---- the match
    const m = match(t);
    if (t < T_HOUSE + 1) {
      r.local(m.x, m.y, m.rot, 1, () => {
        r.box(0, 0, 0, -120, -3, 120, 6, m.lit > 0.05 ? r.mix('fg', 'sig', m.lit) : fg, r.c('panel'), 1.2);
        r.circle(0, 0, 8, m.lit > 0.05 ? r.c('sig') : fg, m.lit > 0.05 ? r.c('sig') : r.c('panel'), 1.2);
        if (m.lit > 0.02) {
          // the flame
          const fl = 1 + noise1(t * 20, 2) * 0.15;
          r.alpha(m.lit, () => {
            g.beginPath();
            g.moveTo(-6, 0);
            g.quadraticCurveTo(-4, -26 * fl, 10 + noise1(t * 14, 5) * 4, -46 * fl);
            g.quadraticCurveTo(14, -20 * fl, 8, 0);
            g.closePath();
            g.fillStyle = r.c('sig');
            g.fill();
            r.circle(2, -10, 5, undefined, r.c('ember'));
          });
        }
      });
    }
    if (t > T_STRIKE && t < T_STRIKE + 0.4) {
      // sparks off the striker
      for (let q = 0; q < 8; q++) {
        const tau = t - T_STRIKE;
        const a = -Math.PI / 2 + noise1(q * 2.3, 1) * 1.2;
        const d = tau * (300 + q * 30);
        r.circle(BOX.x + BOX.w + Math.cos(a) * d, BOX.y - BOX.h + Math.sin(a) * d + 1500 * tau * tau, r.px(2), undefined, r.c('sig', 1 - tau / 0.4));
      }
    }

    // ---- the fuse
    const sx = sparkX(r, t);
    g.beginPath();
    for (let x = FUSE.x0; x <= FUSE.x1; x += 20) {
      const y = FUSE.y + Math.sin(x * 0.05) * 2;
      if (x === FUSE.x0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    r.stroke(r.c('dim'), 1.2);
    if (sx > 0 || t > T_HOUSE) {
      const end = sx > 0 ? sx : FUSE.x1;
      // burnt part: a thin graphite line, the spark at its tip
      r.line(FUSE.x0, FUSE.y, end, FUSE.y, r.c('mid'), 1);
      if (sx > 0) {
        r.circle(sx, FUSE.y - 3, 6, undefined, r.c('ember'));
        for (let q = 0; q < 6; q++) {
          const a = -Math.PI / 2 + noise1(q * 1.9 + t * 9, 3) * 1.4;
          const d = 8 + Math.abs(noise1(q + t * 13, 8)) * 22;
          r.line(sx, FUSE.y - 3, sx + Math.cos(a) * d, FUSE.y - 3 + Math.sin(a) * d, r.c('sig', 0.8), 1.2);
        }
      }
    }
    orderTag(r, 7, FUSE.x0 + 10, -70, 16, hit(t, T_DROP + 0.3, 0.4), smoothstep(27.2, 27.6, t));

    // ---- lyric along the fuse
    boxes ??= layout(r, L, { size: SIZE });
    lyric(r, L, TEXT_X, -44, { size: SIZE, appear: 0.5 }, 0, boxes);

    // ---- the stranger's house
    const H0 = HOUSE;
    const lit = (k: number) => smoothstep(T_HOUSE + k * 0.18, T_HOUSE + k * 0.18 + 0.12, t);
    const blaze = smoothstep(T_ALIGHT - 0.05, T_ALIGHT + 0.25, t);
    const outline = blaze > 0.01 ? r.mix('fg', 'sig', blaze * (0.8 + 0.2 * noise1(t * 6, 1))) : fg;
    const house = [
      { x: H0.x, y: 0 }, { x: H0.x, y: -H0.wall }, { x: H0.x + H0.w / 2, y: -H0.wall - H0.roof }, { x: H0.x + H0.w, y: -H0.wall }, { x: H0.x + H0.w, y: 0 },
    ];
    r.poly(house, outline, r.c('panel'), 1.6);
    // chimney
    r.box(H0.x + H0.w * 0.72, -H0.wall - H0.roof * 0.45, 0, 0, -70, 40, 70, outline, r.c('panel'), 1.4);
    // door and windows
    r.box(H0.x + H0.w * 0.44, 0, 0, 0, -120, 64, 120, outline, undefined, 1.3);
    const wins = [[0.12, -230], [0.68, -230], [0.12, -110], [0.68, -110], [0.42, -330]] as const;
    wins.forEach(([fx, y], k) => {
      const l = lit(k);
      const x = H0.x + H0.w * fx;
      const w = k === 4 ? 56 : 84, h = k === 4 ? 56 : 70;
      r.box(x, y, 0, 0, 0, w, h, l > 0.01 ? r.mix('fg', 'sig', l) : fg, l > 0.01 ? r.c('sig', 0.85 * l) : undefined, 1.3);
      if (l > 0.01) {
        r.line(x + w / 2, y, x + w / 2, y + h, r.c('panel'), 1.2);
        r.line(x, y + h / 2, x + w, y + h / 2, r.c('panel'), 1.2);
      }
    });
    // smoke from the chimney once alight
    if (blaze > 0.01) {
      for (let q = 0; q < 5; q++) {
        const tau = ((t - T_ALIGHT) * 0.6 + q * 0.2) % 1;
        const cx = H0.x + H0.w * 0.72 + 20 + noise1(q * 4 + t, 3) * 30 + tau * 60;
        const cy = -H0.wall - H0.roof * 0.45 - 80 - tau * 220;
        r.circle(cx, cy, 12 + tau * 30, r.c('mid', (1 - tau) * 0.6 * blaze), undefined, 1);
      }
    }
    leader(r, H0.x + H0.w * 0.2, -H0.wall - 40, H0.x - 180, -H0.wall - 160, 'A STRANGER (NAME UNKNOWN)', 13, undefined, smoothstep(T_HOUSE - 0.3, T_HOUSE + 0.1, t));
    orderTag(r, 8, H0.x + H0.w + 40, -H0.wall - 60, 16, hit(t, T_ALIGHT, 0.5), smoothstep(T_HOUSE, T_HOUSE + 0.3, t));
    label(r, 'ALIGHT', H0.x + H0.w + 40, -H0.wall - 10, 13, r.c('sig'), 'left', 500, blaze);
  },
};
