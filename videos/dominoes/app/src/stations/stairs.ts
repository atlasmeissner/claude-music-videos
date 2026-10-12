// Pre-chorus 2 (76.4 – 83.2 s).
// "The second step is never seen": a slinky walks down a staircase whose next step is only drawn
// when the slinky reaches it; each step carries one word. "Until it's everywhere you've been": the
// camera pulls all the way back and the whole route so far lights up behind it.
import { type R } from '../engine/draw';
import { archivo } from '../engine/fonts';
import { line } from '../engine/lyrics';
import { label, lyric, orderTag } from '../engine/text';
import { clamp, ease, lerp, smoothstep, type V2 } from '../engine/util';
import { hit } from '../machine/motion';
import { ground } from '../machine/parts';
import { LN, type Station } from '../station';

export function makeStairs(x0: number, worldX0: number) {
  const L1 = line(LN.step), L2 = line(LN.been);
  const W1 = L1.words, W2 = L2.words;
  const RISE = 100, TREAD = 250, N = 9;
  const TOPY = -RISE * N;
  const SX = x0;
  const stepY = (k: number) => TOPY + k * RISE; // tread k top (k = 0: landing)
  const stepX = (k: number) => SX + k * TREAD; // left edge of tread k
  // landing times: one per word of line 1, then on to the floor on the beats of line 2
  const T: number[] = [W1[0]!.start - 0.6, ...W1.map((w) => w.start), W2[0]!.start, W2[1]!.start, W2[2]!.start];
  const landX = (k: number) => stepX(k) + 50;
  const SIZE = 54;
  const T_PULL = W2[1]!.start; // the reveal
  const midX = (worldX0 + SX + TREAD * N) / 2;
  const fullW = SX + TREAD * N - worldX0 + 1400;
  const zFull = 1920 / fullW;

  /** The slinky between landing points: n coils along an arch from end A to end B. */
  function slinky(r: R, t: number) {
    let k = 0;
    while (k < T.length - 1 && t >= T[k + 1]!) k++;
    const A: V2 = { x: landX(k), y: stepY(k) };
    let B: V2 = A;
    let u = 0;
    if (k < T.length - 1 && t >= T[k]!) {
      const T0 = T[k]!, T1 = T[k + 1]!;
      u = clamp((t - T0) / (T1 - T0));
      const next: V2 = { x: landX(k + 1), y: stepY(k + 1) };
      // the top end flips over: a half circle from above A down onto the next step
      const a = Math.PI * ease.inOutSine(u);
      const cx = (A.x + next.x) / 2, cy = Math.min(A.y, next.y) - 30;
      const rx = (next.x - A.x) / 2, ry = 120;
      B = { x: cx - Math.cos(a) * rx, y: cy - Math.sin(a) * ry + (next.y - A.y) * ease.inQuad(u) * 0.5 };
      if (u > 0.98) B = next;
    }
    const n = 22;
    const apexH = 70 + 50 * Math.sin(u * Math.PI);
    const hot = k < T.length - 1 && t < T[T.length - 1]! + 0.4;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      const x = lerp(A.x, B.x, s);
      const y = lerp(A.y, B.y, s) - Math.sin(s * Math.PI) * apexH;
      r.g.beginPath();
      r.g.ellipse(x, y - 12, 9, 26, Math.atan2(B.y - A.y, B.x - A.x) * 0.5, 0, Math.PI * 2);
      r.stroke(hot ? r.mix('fg', 'sig', 0.85) : r.c('fg'), 1.2);
    }
  }

  const st: Station = {
    id: 'stairs',
    x0: SX - 400, x1: SX + TREAD * (N + 1) + 300, y0: TOPY - 600, y1: 60,
    t0: 75.8, t1: 83.2,
    cam: [
      { t: W1[0]!.start, x: SX + 500, y: TOPY + 200, z: 0.95, e: ease.inOutCubic },
      { t: W1[5]!.start, x: SX + 1300, y: TOPY + 500, z: 0.9, e: ease.inOutSine },
      { t: T_PULL, x: SX + 1700, y: TOPY + 620, z: 0.85, e: ease.inOutSine },
      { t: W2[4]!.start - 0.2, x: midX, y: -700, z: zFull, e: ease.inOutCubic },
      { t: 82.9, x: midX + 300, y: -700, z: zFull * 0.98, e: ease.linear },
    ],
    hits: [...T.map((tt) => ({ t: tt, amp: 2 }))],
    draw(r: R, t: number) {
      const g = r.g;
      const fg = r.c('fg');
      ground(r, SX - 400, SX + TREAD * (N + 1) + 300, 0);
      // landing
      r.line(SX - 300, TOPY, SX + TREAD, TOPY, fg, 1.6);
      r.line(SX - 300, TOPY, SX - 300, 0, r.c('dim'), 1);
      // steps appear only when reached
      for (let k = 1; k <= N; k++) {
        const appear = smoothstep(T[k]! - 0.35, T[k]! - 0.1, t);
        const x = stepX(k), y = stepY(k);
        if (appear < 0.01) {
          // not yet drawn: a faint question mark where it should be
          if (k <= 2 || t > T[k - 1]! - 0.3) r.text('?', x + TREAD / 2, y - 10, archivo(48, 1000, 500), r.c('dim', 0.6), 'center');
          continue;
        }
        r.alpha(1, () => {
          const len = TREAD * appear;
          g.beginPath();
          g.moveTo(x, y - RISE);
          g.lineTo(x, y);
          g.lineTo(x + len, y);
          r.stroke(hit(t, T[k]!, 0.3) > 0.05 ? r.mix('fg', 'sig', hit(t, T[k]!, 0.3)) : fg, 1.6);
          if (appear > 0.9) r.line(x, y, x, 0, r.c('faint'), 1);
        });
      }
      // words on the treads (line 1)
      lyric(r, L1, 0, 0, {
        size: SIZE, appear: 0.3,
        fx: (f) => {
          const k = f.i + 1;
          f.dx = stepX(k) + TREAD * 0.62 - (f.box.x + f.box.w / 2) - 30;
          f.dy = stepY(k) - 14;
          f.alpha = smoothstep(T[k]! - 0.35, T[k]! - 0.05, t);
        },
      });
      label(r, 'STEP 2 — NOT DRAWN UNTIL REACHED', SX - 260, TOPY - 140, 14, undefined, 'left', 500, smoothstep(76, 76.4, t) * (1 - smoothstep(78.5, 79, t)));
      orderTag(r, 18, SX - 260, TOPY - 60, 16, hit(t, W1[0]!.start, 0.4));
      slinky(r, t);
    },
    overlay(r: R, t: number) {
      // line 2 over the pull-back: the whole route behind it
      if (t < W2[0]!.start - 0.6 || t > 83.2) return;
      const a = 1 - smoothstep(82.95, 83.15, t);
      r.alpha(a, () => lyric(r, L2, 120, 960, { size: 96, width: 1000, weight: 800, appear: 0.4 }));
      r.alpha(a * smoothstep(W2[3]!.start, W2[3]!.start + 0.4, t), () => {
        r.text('FIG. 18 — EVERYWHERE YOU HAVE BEEN (WHOLE MACHINE, 1:240)', 124, 1010, `500 15px "PlexMono-500"`, r.c('mid'));
      });
    },
  };
  return { station: st, exitX: SX + TREAD * (N + 1) };
}
