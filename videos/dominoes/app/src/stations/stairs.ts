// Pre-chorus 2 (76.4 – 83.2 s).
// "The second step is never seen": a slinky walks down a staircase whose next step is only drawn
// when the slinky reaches it; each step carries one word. "Until it's everywhere you've been": the
// camera pulls all the way back and the whole route so far lights up behind it.
import { type R } from '../engine/draw';
import { archivo } from '../engine/fonts';
import { line } from '../engine/lyrics';
import { label, lyric, orderTag } from '../engine/text';
import { clamp, ease, smoothstep } from '../engine/util';
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

  // ---- the slinky: NR rings, stacked on the front edge of a tread. On each step the top ring leaves
  // first, the rings stream over the edge in an arch (each on its own bezier, a few ms apart, so in
  // flight they form the bent spring), and they stack up again on the next tread, the first ring
  // landing exactly on the step's word. Seen from the side, a ring is an ellipse across the spring's
  // axis: major radius RR, minor RR * 0.3.
  const NR = 30, PITCH = 3.4, RR = 34;
  const restX = (k: number) => stepX(k) + TREAD - RR - 22;
  const NM = T.length - 1; // moves 1..NM, from step m-1 to step m
  const dT = (m: number) => T[Math.min(Math.max(m, 1), NM)]! - T[Math.min(Math.max(m, 1), NM) - 1]!;
  const moves = Array.from({ length: NM + 1 }, (_, m) => {
    if (m === 0) return { a: -1, b: -1, D: 0, S: 0 };
    const d = Math.min(dT(m), m < NM ? dT(m + 1) : dT(m));
    const D = 0.42 * d, S = 0.45 * d;
    return { a: T[m]! - D, b: T[m]! + S, D, S };
  });
  function ringsAt(t: number): { x: number; y: number; ang: number; hot: number }[] {
    // which move is under way (or which step the slinky rests on)
    let m = 0;
    for (let k = 1; k <= NM; k++) if (t >= moves[k]!.a) m = k;
    const out: { x: number; y: number; ang: number; hot: number }[] = [];
    const mv = moves[m]!;
    if (m === 0 || t >= mv.b) {
      // at rest on step m
      const k = m;
      const sinceLand = m === 0 ? 9 : t - mv.b;
      for (let i = 0; i < NR; i++) out.push({ x: restX(k), y: stepY(k) - i * PITCH - 2, ang: -Math.PI / 2, hot: Math.max(0, 1 - sinceLand / 0.5) * (m === 0 ? 0 : 1) });
      return out;
    }
    const k0 = m - 1, k1 = m;
    for (let i = 0; i < NR; i++) {
      const dep = mv.a + (i / (NR - 1)) * mv.S;
      const Ps = { x: restX(k0), y: stepY(k0) - (NR - 1 - i) * PITCH - 2 };
      const Pe = { x: restX(k1), y: stepY(k1) - i * PITCH - 2 };
      if (t < dep) { out.push({ ...Ps, ang: -Math.PI / 2, hot: 0.35 }); continue; }
      const u = clamp((t - dep) / mv.D);
      if (u >= 1) { out.push({ ...Pe, ang: -Math.PI / 2, hot: Math.max(0, 1 - (t - dep - mv.D) / 0.5) }); continue; }
      // the arch: up from the top of the stack, over the edge, down onto the next tread
      const c1 = { x: Ps.x + 40, y: Ps.y - 120 };
      const c2 = { x: Pe.x - 30, y: Pe.y - 150 };
      const e = ease.inOutSine(u);
      const v = 1 - e;
      const x = v * v * v * Ps.x + 3 * v * v * e * c1.x + 3 * v * e * e * c2.x + e * e * e * Pe.x;
      const y = v * v * v * Ps.y + 3 * v * v * e * c1.y + 3 * v * e * e * c2.y + e * e * e * Pe.y;
      const dx = 3 * v * v * (c1.x - Ps.x) + 6 * v * e * (c2.x - c1.x) + 3 * e * e * (Pe.x - c2.x);
      const dy = 3 * v * v * (c1.y - Ps.y) + 6 * v * e * (c2.y - c1.y) + 3 * e * e * (Pe.y - c2.y);
      out.push({ x, y, ang: Math.atan2(dy, dx), hot: 1 });
    }
    return out;
  }
  function slinky(r: R, t: number) {
    const g = r.g;
    const rings = ringsAt(t);
    // back half of every ring first, then the front half, so the coil reads as a spring
    for (const half of [0, 1]) {
      for (const q of rings) {
        g.beginPath();
        // the ring's plane is perpendicular to the spring's axis (the path tangent)
        g.ellipse(q.x, q.y, RR * 0.3, RR, q.ang, half ? Math.PI / 2 : -Math.PI / 2, half ? Math.PI * 1.5 : Math.PI / 2);
        r.stroke(q.hot > 0.01 ? r.mix('fg', 'sig', q.hot) : r.c('fg'), half ? 1.1 : 0.7);
      }
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
        const appear = smoothstep(moves[k]!.a - 0.1, moves[k]!.a + 0.15, t);
        const x = stepX(k), y = stepY(k);
        if (appear < 0.01) {
          // not yet drawn: a faint question mark where it should be
          if (k <= 2 || t > moves[k - 1]!.a) r.text('?', x + TREAD / 2, y - 10, archivo(48, 1000, 500), r.c('dim', 0.6), 'center');
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
          f.dx = stepX(k) + TREAD - 2 * RR - 40 - (f.box.x + f.box.w); // left of the slinky's stack
          f.dy = stepY(k) - 14;
          f.alpha = smoothstep(moves[k]!.a - 0.1, moves[k]!.a + 0.2, t);
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
      r.alpha(a, () => lyric(r, L2, 120, 960, { size: 66, width: 1000, weight: 700, appear: 0.4 }));
      r.alpha(a * smoothstep(W2[3]!.start, W2[3]!.start + 0.4, t), () => {
        r.text('FIG. 18 — EVERYWHERE YOU HAVE BEEN (WHOLE MACHINE, 1:240)', 124, 1010, `500 15px "PlexMono-500"`, r.c('mid'));
      });
    },
  };
  return { station: st, exitX: SX + TREAD * (N + 1) };
}
