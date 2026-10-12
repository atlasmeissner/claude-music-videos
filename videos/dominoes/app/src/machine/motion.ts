// Ballistic motion between timed contact points (a ball bouncing from bar to bar on the beat).
import { type V2, clamp } from '../engine/util';

export interface Hop { t: number; p: V2 }

/**
 * Position at time t of a body that touches `hops[k].p` at `hops[k].t` and flies on a parabola
 * (gravity G, y down) in between. Before the first hop it sits at hops[0].p; after the last it
 * sits at the last point.
 */
export function hopAt(hops: Hop[], t: number, G = 3000): { x: number; y: number; vx: number; vy: number; k: number } {
  if (t <= hops[0]!.t) return { ...hops[0]!.p, vx: 0, vy: 0, k: -1 };
  for (let k = 0; k < hops.length - 1; k++) {
    const a = hops[k]!, b = hops[k + 1]!;
    if (t < b.t) {
      const dt = b.t - a.t, tau = t - a.t;
      const vx = (b.p.x - a.p.x) / dt;
      const vy0 = (b.p.y - a.p.y - 0.5 * G * dt * dt) / dt;
      return { x: a.p.x + vx * tau, y: a.p.y + vy0 * tau + 0.5 * G * tau * tau, vx, vy: vy0 + G * tau, k };
    }
  }
  const l = hops[hops.length - 1]!;
  return { ...l.p, vx: 0, vy: 0, k: hops.length - 1 };
}

/** Time of the most recent hop at or before t (or -Infinity). */
export function lastHop(hops: Hop[], t: number) {
  let best = -Infinity, k = -1;
  hops.forEach((h, i) => {
    if (h.t <= t && h.t > best) { best = h.t; k = i; }
  });
  return { t: best, k };
}

/** Free fall from p with initial velocity v, after time tau (y down). */
export const fall = (p: V2, v: V2, tau: number, G = 3000): V2 => ({ x: p.x + v.x * tau, y: p.y + v.y * tau + 0.5 * G * tau * tau });

/** Rolling: distance travelled under constant acceleration from v0. */
export const roll = (v0: number, a: number, tau: number) => v0 * tau + 0.5 * a * tau * tau;

/** Pulse that is 1 at t0 and decays with half-life hl (0 before t0). */
export const hit = (t: number, t0: number, hl = 0.12) => (t < t0 ? 0 : Math.pow(0.5, (t - t0) / hl));

/** Damped oscillation after an impact (for wobbling bars, swinging chimes). */
export const ring = (t: number, t0: number, freq = 9, decay = 5) => (t < t0 ? 0 : Math.sin((t - t0) * freq * Math.PI * 2) * Math.exp(-(t - t0) * decay));

export const u01 = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
