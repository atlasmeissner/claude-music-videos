// Intro (0 – 16.7 s): one domino on a plinth in the dark. A marble rolls in and touches it on the
// first note; the domino knocks a steel ball down a xylophone staircase (one bar per note of the
// staccato run), across two chimes and a floor marimba spaced like the score, into a ratchet wheel
// that lifts it one notch per beat to the start of the machine. The maker's plate rides on the wheel.
import { onsetsIn, beatsIn } from '../engine/audio';
import { type CamKey } from '../engine/camera';
import { type R } from '../engine/draw';
import { archivo, mono } from '../engine/fonts';
import { label, orderTag } from '../engine/text';
import { clamp, ease, smoothstep, type V2 } from '../engine/util';
import { type Hop, hit, hopAt, ring } from '../machine/motion';
import { ball, ground, post } from '../machine/parts';
import { type Station } from '../station';

export const SHELF_Y = -300;
const BR = 14; // ball radius
const DOM = { x: 0, w: 26, h: 140 };
const T_TOUCH = 3.12; // the first note: the marble touches the domino
const T_KNOCK = 3.34; // the domino's top knocks the ball off its pedestal

// xylophone staircase: one bar per note of the first run
const RUN1 = onsetsIn(3.45, 7.4, 'acc_onsets', 0.1).map((o) => o[0]);
const BAR_X0 = 300, BAR_DX = 100, BAR_Y0 = -320, BAR_DY = 15.5, BAR_LEN = 74;
const bars = RUN1.map((t, k) => ({ t, x: BAR_X0 + k * BAR_DX, y: BAR_Y0 + k * BAR_DY, len: BAR_LEN * (1 - k * 0.022) }));
const lastBar = bars[bars.length - 1]!;

// floor run
const T_LAND = lastBar.t + 0.2;
const X_LAND = lastBar.x + 105;
const V_ROLL = 520;
const rollX = (t: number) => X_LAND + V_ROLL * (t - T_LAND);
const CHIMES = [7.96, 8.58].map((t) => ({ t, x: rollX(t) }));
const RUN2 = onsetsIn(9.15, 11.4, 'acc_onsets', 0.1).map((o) => o[0]);
const MAR_Y = -10; // marimba bar tops
const marimba = RUN2.slice(0, -1).map((t, k) => ({ t, x0: rollX(t) + 2, x1: rollX(RUN2[k + 1]!) - 2 }));
const T_WHEEL_IN = RUN2[RUN2.length - 1]!; // 11.30
const WHEEL = { x: rollX(T_WHEEL_IN), y: -330, r: 300 };
// the wheel advances one notch per beat, half a turn in all
const STEPS = beatsIn(T_WHEEL_IN + 0.1, 16.3);
const T_TOP = STEPS[STEPS.length - 1]! + 0.12;
export const T_RELEASE = T_TOP + 0.05;

function wheelAngle(t: number) {
  // angle of the ball's cup: +90° (bottom) → -90° (top)
  let k = 0;
  for (const b of STEPS) k += ease.outBack(clamp((t - b) / 0.16), 2.2);
  return Math.PI / 2 - (Math.PI * k) / STEPS.length;
}

// after the top: a short chute to the right, into the thread cup (next station)
export const EXIT = { x: WHEEL.x + 210, y: WHEEL.y - WHEEL.r - 20 };

const hops: Hop[] = [
  { t: T_KNOCK, p: { x: 158, y: SHELF_Y - 66 } },
  ...bars.map((b) => ({ t: b.t, p: { x: b.x, y: b.y - BR } })),
  { t: T_LAND, p: { x: X_LAND, y: -BR } },
];

/** The ball's position over the whole intro. */
export function introBall(t: number): { x: number; y: number; vx: number; vy: number; heat: number } {
  if (t < T_LAND) {
    const h = hopAt(hops, t, 3000);
    return { ...h, heat: t >= T_KNOCK ? 1 : 0 };
  }
  if (t < T_WHEEL_IN) {
    const x = rollX(t);
    const onMar = t >= RUN2[0]! ? MAR_Y : 0;
    return { x, y: onMar - BR, vx: V_ROLL, vy: 0, heat: 1 };
  }
  if (t < T_TOP) {
    const a = wheelAngle(t);
    const cr = WHEEL.r - 18;
    return { x: WHEEL.x + Math.cos(a) * cr, y: WHEEL.y + Math.sin(a) * cr - 4, vx: 0, vy: 0, heat: 0.75 };
  }
  // roll down the chute to the exit
  const u = clamp((t - T_TOP) / 0.28);
  const p0: V2 = { x: WHEEL.x, y: WHEEL.y - WHEEL.r + 14 };
  return { x: p0.x + (EXIT.x - p0.x) * ease.inQuad(u), y: p0.y + (EXIT.y - p0.y) * ease.inQuad(u), vx: 600, vy: 0, heat: 1 };
}

function marbleX(t: number) {
  // the very first marble rolls in from the left along a ramp and touches the domino
  const xEnd = DOM.x - DOM.w / 2 - 11;
  const t0 = 0.9;
  const u = clamp((t - t0) / (T_TOUCH - t0));
  return -760 + (xEnd + 760) * ease.inQuad(u);
}
const rampY = (x: number) => (x < -420 ? SHELF_Y - 11 - ((-420 - x) / 340) * 110 : SHELF_Y - 11);

function domAngle(t: number) {
  if (t < T_TOUCH) return 0;
  const th1 = 1.2; // ~68°, where it meets the ball
  if (t < T_KNOCK) return th1 * ease.inQuad((t - T_TOUCH) / (T_KNOCK - T_TOUCH));
  return th1 + (1.43 - th1) * ease.outQuad(clamp((t - T_KNOCK) / 0.12)) - 0.03 * ring(t, T_KNOCK + 0.12, 6, 9);
}

export const intro: Station = {
  id: 'intro',
  x0: -900, x1: WHEEL.x + WHEEL.r + 260, y0: -700, y1: 40,
  t0: 0, t1: T_RELEASE + 0.4,
  cam: (() => {
    const k: CamKey[] = [
      { t: 0, x: 40, y: SHELF_Y - 90, z: 2.05 },
      { t: 2.9, x: 30, y: SHELF_Y - 85, z: 2.25, e: ease.linear },
      { t: 3.9, x: 520, y: SHELF_Y + 10, z: 1.3, e: ease.inOutCubic },
    ];
    // follow the ball along the staircase and the floor (smoothed samples)
    for (let t = 4.3; t < T_WHEEL_IN - 0.3; t += 0.5) {
      let sx = 0, sy = 0, n = 0;
      for (let d = -0.5; d <= 0.5; d += 0.1) {
        const b = introBall(t + d);
        sx += b.x; sy += b.y; n++;
      }
      k.push({ t, x: sx / n + 220, y: Math.max(sy / n - 40, -260) + 40, z: 1.15, e: ease.linear });
    }
    k.push({ t: T_WHEEL_IN + 0.9, x: WHEEL.x + 80, y: WHEEL.y - 20, z: 0.95, e: ease.inOutCubic });
    k.push({ t: T_TOP - 0.2, x: WHEEL.x + 140, y: WHEEL.y - 110, z: 0.9, e: ease.linear });
    return k;
  })(),
  hits: [{ t: T_TOUCH, amp: 2 }, { t: 11.3, amp: 3 }],
  impulse: (t) => introBall(t),

  draw(r: R, t: number) {
    const g = r.g;
    const fg = r.c('fg');
    // ---------------------------------------------------------------- ground
    ground(r, -900, WHEEL.x + WHEEL.r + 400, 0);

    // ---------------------------------------------------------------- plinth
    const pl = { x0: -470, x1: 210 };
    r.poly([{ x: pl.x0, y: SHELF_Y }, { x: pl.x1, y: SHELF_Y }, { x: pl.x1, y: SHELF_Y + 18 }, { x: pl.x0, y: SHELF_Y + 18 }], fg, r.c('panel'), 1.4);
    post(r, pl.x0 + 40, SHELF_Y + 18, 0, 14);
    post(r, pl.x1 - 40, SHELF_Y + 18, 0, 14);
    // ramp from the left
    r.path([{ x: -900, y: SHELF_Y - 120 }, { x: -420, y: SHELF_Y }, { x: pl.x0, y: SHELF_Y }]);
    r.stroke(fg, 1.4);
    // pedestal with the ball
    r.box(158, SHELF_Y, 0, -8, -52, 16, 52, fg, r.c('panel'), 1.2);
    r.poly([{ x: 146, y: SHELF_Y - 52 }, { x: 170, y: SHELF_Y - 52 }], fg, undefined, 1.4, false);

    // the marble
    if (t < T_TOUCH + 0.6) {
      const mx = t < T_TOUCH ? marbleX(t) : marbleX(T_TOUCH) - 40 * ease.outCubic(clamp((t - T_TOUCH) / 0.5));
      const my = rampY(mx);
      const heat = t > 0.9 && t < T_TOUCH + 0.25 ? 1 - smoothstep(T_TOUCH, T_TOUCH + 0.25, t) : 0;
      ball(r, mx, my, 11, heat, mx / 11, t < T_TOUCH ? 300 : 0, 0);
    } else ball(r, marbleX(T_TOUCH) - 40, SHELF_Y - 11, 11, 0, 0);

    // the first domino
    const th = domAngle(t);
    const heatD = t < T_TOUCH ? 0 : 1 - smoothstep(T_KNOCK + 0.05, T_KNOCK + 0.45, t);
    r.local(DOM.x + DOM.w / 2, SHELF_Y, th, 1, () => {
      r.box(0, 0, 0, -DOM.w, -DOM.h, DOM.w, DOM.h, heatD > 0 ? r.mix('fg', 'sig', heatD) : fg, r.c('panel'), 1.6);
    });
    // annotations around the first domino (the first frame is also the last)
    const a0 = 1 - smoothstep(2.6, 3.1, t);
    orderTag(r, 0, DOM.x - 120, SHELF_Y - DOM.h - 40, 15, 0, a0 * smoothstep(0.3, 1.0, t) + (t < 0.3 ? 1 : 0));
    label(r, 'FIG. 1 — ONE DOMINO, STANDING', DOM.x - 120, SHELF_Y + 52, 13, undefined, 'left', 400, a0);
    label(r, 'h = 140', DOM.x + 40, SHELF_Y - DOM.h / 2, 12, r.c('dim'), 'left', 400, a0);

    // ---------------------------------------------------------------- xylophone staircase
    // frame rail under the bars
    r.path([{ x: BAR_X0 - 80, y: BAR_Y0 + 40 }, { x: lastBar.x + 60, y: lastBar.y + 40 }]);
    r.stroke(r.c('dim'), 1);
    for (let k = 0; k < bars.length; k++) {
      const b = bars[k]!;
      if (!r.visible(b.x - 60, b.y - 40, b.x + 60, b.y + 60)) continue;
      const hk = hit(t, b.t, 0.16);
      const wob = ring(t, b.t, 14, 7) * 4;
      const col = hk > 0.01 ? r.mix('fg', 'sig', Math.min(1, hk * 1.4)) : fg;
      // bar (slightly bent while ringing)
      g.beginPath();
      g.moveTo(b.x - b.len / 2, b.y);
      g.quadraticCurveTo(b.x, b.y + wob, b.x + b.len / 2, b.y);
      g.lineTo(b.x + b.len / 2, b.y + 9);
      g.quadraticCurveTo(b.x, b.y + 9 + wob, b.x - b.len / 2, b.y + 9);
      g.closePath();
      g.fillStyle = hk > 0.4 ? r.c('sig', 0.85 * hk) : r.c('panel');
      g.fill();
      g.strokeStyle = col;
      g.lineWidth = r.px(1.4);
      g.stroke();
      // cords / posts
      for (const s of [-1, 1]) {
        const px = b.x + s * b.len * 0.3;
        r.line(px, b.y + 9, px, b.y + 40, r.c('dim'), 1);
      }
      // note ticks: a small sound mark when struck
      if (hk > 0.02) {
        r.alpha(hk, () => {
          for (let q = 0; q < 3; q++) {
            const rr = 16 + q * 9 + (1 - hk) * 30;
            g.beginPath();
            g.arc(b.x, b.y - 10, rr, -Math.PI * 0.8, -Math.PI * 0.2);
            r.stroke(r.c('sig'), 1.2);
          }
        });
      }
    }
    label(r, `XYLOPHONE, ${bars.length} BARS — ONE PER NOTE`, BAR_X0 - 60, BAR_Y0 + 80, 13, undefined, 'left', 400, smoothstep(3.3, 3.8, t));

    // ---------------------------------------------------------------- chimes
    const gantryY = -230;
    r.line(CHIMES[0]!.x - 80, gantryY, CHIMES[1]!.x + 80, gantryY, fg, 1.4);
    post(r, CHIMES[0]!.x - 80, gantryY, 0, 10);
    post(r, CHIMES[1]!.x + 80, gantryY, 0, 10);
    CHIMES.forEach((c, i) => {
      const sw = ring(t, c.t, 1.6, 1.4) * 0.22;
      const hk = hit(t, c.t, 0.25);
      const len = 200 - i * 26;
      r.local(c.x, gantryY, -sw, 1, () => {
        r.line(0, 0, 0, 14, r.c('dim'), 1);
        r.box(0, 14, 0, -8, 0, 16, len, hk > 0.01 ? r.mix('fg', 'sig', hk) : fg, hk > 0.4 ? r.c('sig', 0.8 * hk) : r.c('panel'), 1.4);
      });
    });

    // ---------------------------------------------------------------- floor marimba
    for (const m of marimba) {
      if (!r.visible(m.x0, -40, m.x1, 10)) continue;
      const hk = hit(t, m.t, 0.18);
      r.box(m.x0, MAR_Y, 0, 0, 0, m.x1 - m.x0, -MAR_Y, hk > 0.01 ? r.mix('fg', 'sig', hk) : fg, hk > 0.4 ? r.c('sig', 0.85 * hk) : r.c('panel'), 1.3);
    }
    if (marimba.length) label(r, 'BARS CUT TO THE RHYTHM', marimba[0]!.x0, 38, 12, undefined, 'left', 400, smoothstep(9.0, 9.4, t));

    // ---------------------------------------------------------------- the ratchet wheel
    const a = t < T_WHEEL_IN ? Math.PI / 2 : wheelAngle(Math.min(t, T_TOP));
    const rot = a - Math.PI / 2;
    const W0 = WHEEL;
    // A-frame support
    r.path([{ x: W0.x - 210, y: 0 }, { x: W0.x, y: W0.y }, { x: W0.x + 210, y: 0 }]);
    r.stroke(fg, 1.4);
    if (r.visible(W0.x - W0.r - 40, W0.y - W0.r - 40, W0.x + W0.r + 40, W0.y + W0.r + 40)) {
      r.circle(W0.x, W0.y, W0.r, fg, undefined, 1.4);
      r.circle(W0.x, W0.y, W0.r - 26, r.c('dim'), undefined, 1);
      // ratchet teeth
      g.beginPath();
      const NT = 48;
      for (let k = 0; k < NT; k++) {
        const aa = rot + (k / NT) * Math.PI * 2;
        const a2 = rot + ((k + 0.7) / NT) * Math.PI * 2;
        const p1 = { x: W0.x + Math.cos(aa) * (W0.r - 26), y: W0.y + Math.sin(aa) * (W0.r - 26) };
        const p2 = { x: W0.x + Math.cos(a2) * (W0.r - 40), y: W0.y + Math.sin(a2) * (W0.r - 40) };
        g.moveTo(p1.x, p1.y);
        g.lineTo(p2.x, p2.y);
      }
      r.stroke(r.c('dim'), 1);
      // spokes and cups
      for (let k = 0; k < 12; k++) {
        const aa = rot + Math.PI / 2 + (k / 12) * Math.PI * 2;
        const ex = W0.x + Math.cos(aa) * (W0.r - 26), ey = W0.y + Math.sin(aa) * (W0.r - 26);
        r.line(W0.x + Math.cos(aa) * 40, W0.y + Math.sin(aa) * 40, ex, ey, r.c('dim'), 1);
        // cups hang upright (pivoted)
        const cx = W0.x + Math.cos(aa) * (W0.r - 18), cy = W0.y + Math.sin(aa) * (W0.r - 18);
        const active = k === 0 && t >= T_WHEEL_IN && t < T_TOP + 0.3;
        const tip = k === 0 ? ease.outCubic(clamp((t - T_TOP) / 0.2)) * 0.9 : 0;
        r.local(cx, cy, tip, 1, () => {
          r.path([{ x: -20, y: -8 }, { x: -16, y: 18 }, { x: 16, y: 18 }, { x: 20, y: -8 }]);
          r.stroke(active ? r.c('sig') : fg, 1.3);
        });
      }
      r.circle(W0.x, W0.y, 40, fg, r.c('panel'), 1.4);
      r.circle(W0.x, W0.y, 8, fg, undefined, 1.2);
      // pawl
      const pk = STEPS.reduce((s, b) => s + hit(t, b, 0.05), 0);
      r.local(W0.x + W0.r - 10, W0.y - 60, -0.4 - pk * 0.25, 1, () => {
        r.box(0, 0, 0, 0, -4, 46, 8, fg, r.c('panel'), 1.2);
      });
    }
    // exit chute
    r.path([{ x: W0.x + 10, y: W0.y - W0.r - 6 }, { x: EXIT.x + 30, y: EXIT.y + 18 }]);
    r.stroke(fg, 1.4);

    // the maker's plate, mounted in front of the wheel
    const pa = smoothstep(11.6, 12.4, t);
    if (pa > 0.01) {
      r.alpha(pa, () => {
        const pw = 560, ph = 210, px = W0.x - pw / 2, py = W0.y - ph / 2 + 10;
        r.box(px, py, 0, 0, 0, pw, ph, fg, r.c('panel'), 1.6);
        r.box(px, py, 0, 8, 8, pw - 16, ph - 16, r.c('dim'), undefined, 1);
        for (const [rx, ry] of [[18, 18], [pw - 18, 18], [18, ph - 18], [pw - 18, ph - 18]] as const) r.circle(px + rx, py + ry, 4, fg, undefined, 1);
        // the title types itself in, letter by letter on the beats of the lift
        const title = 'DOMINOES';
        const nShow = Math.floor(clamp((t - 11.9) / 1.2) * title.length + 0.001);
        r.text(title.slice(0, nShow), px + pw / 2, py + 108, archivo(86, 1250, 900), fg, 'center');
        const sub = smoothstep(13.6, 14.2, t);
        r.alpha(sub, () => {
          r.text('J O B U R G A L E X', px + pw / 2, py + 152, archivo(26, 1125, 500), r.c('sig'), 'center');
          r.text('MAPS & TERRITORY · CLOSING TRACK · A MACHINE IN ONE TAKE', px + pw / 2, py + 184, mono(12), r.c('mid'), 'center');
        });
        r.text('PLATE NO. 1', px + 26, py + 36, mono(11), r.c('mid'));
        r.text('143.6 BPM', px + pw - 26, py + 36, mono(11), r.c('mid'), 'right');
      });
    }

    // ---------------------------------------------------------------- the ball
    if (t < T_RELEASE + 0.3) {
      const b = introBall(t);
      if (t < T_KNOCK) ball(r, 158, SHELF_Y - 66, BR, 0, 0);
      else ball(r, b.x, b.y, BR, b.heat, b.x / BR, b.vx, b.vy);
    }
  },
};
