// The runner: a faceless ink figure with a run cycle locked to the beat grid (one footfall per beat),
// drawn with thick round strokes like a cut-paper silhouette, and an optional chronophotograph trail of
// fading earlier poses. Deterministic: the pose is a pure function of the cycle phase.
import { clamp } from '../engine/util';

type P = { x: number; y: number };

export interface RunnerOpts {
  /** body height in px (feet to top of head) */
  size?: number;
  /** near-side and far-side limb colours */
  near?: string; far?: string;
  /** forward lean of the torso (rad) */
  lean?: number;
  /** stride amplitude (1 = jog, ~1.3 = sprint) */
  amp?: number;
}

/** Joint positions for cycle phase `ph` (radians; one cycle = two footfalls), feet on y = 0, facing +x. */
export function runnerPose(ph: number, size = 380, lean = 0.3, amp = 1) {
  const k = size / 380;
  const TH = 100 * k, SH = 100 * k, UA = 66 * k, FA = 60 * k, TO = 128 * k, NECK = 18 * k, HEAD = 30 * k;
  // vertical bob: highest in the flight phase between footfalls (twice per cycle)
  const bob = -9 * k * Math.cos(2 * ph);
  const leg = (p: number) => {
    const thigh = 0.18 + 0.62 * amp * Math.sin(p); // swing angle from vertical, + = forward
    const knee = 0.42 + 1.55 * Math.min(1.25, amp) * Math.pow(Math.max(0, Math.cos(p + 0.45)), 2); // flexion, highest mid-swing
    const foot = 0.35 + 0.6 * Math.max(0, Math.cos(p - 0.2)); // toe pointing back in swing
    return { thigh, knee, foot };
  };
  const arm = (p: number) => ({ sh: -0.95 * amp * Math.sin(p) - 0.15, el: 1.6 + 0.3 * Math.sin(p) });
  // hip height: legs nearly straight under the body at mid-stance
  const hipY = -(TH + SH) * 0.9 + bob;
  const hip: P = { x: 0, y: hipY };
  const dirv = (a: number) => ({ x: Math.sin(a), y: Math.cos(a) }); // angle from straight down, + = forward
  const legPts = (p: number) => {
    const L = leg(p);
    const kneeP = { x: hip.x + dirv(L.thigh).x * TH, y: hip.y + dirv(L.thigh).y * TH };
    const sa = L.thigh - L.knee;
    const ank = { x: kneeP.x + dirv(sa).x * SH, y: kneeP.y + dirv(sa).y * SH };
    const fa = sa + Math.PI / 2 - L.foot * 0.6;
    const toe = { x: ank.x + Math.sin(fa) * 30 * k, y: ank.y + Math.cos(fa) * 30 * k };
    return [hip, kneeP, ank, toe];
  };
  const sho: P = { x: hip.x + Math.sin(lean) * TO, y: hip.y - Math.cos(lean) * TO };
  const head: P = { x: sho.x + Math.sin(lean) * (NECK + HEAD), y: sho.y - Math.cos(lean) * (NECK + HEAD) };
  const armPts = (p: number) => {
    const A = arm(p);
    const elb = { x: sho.x + dirv(A.sh).x * UA, y: sho.y + dirv(A.sh).y * UA };
    const fa = A.sh + A.el;
    const hand = { x: elb.x + dirv(fa).x * FA, y: elb.y + dirv(fa).y * FA };
    return [sho, elb, hand];
  };
  // near side = right leg / left arm at phase ph; far side half a cycle later
  return { hip, sho, head, headR: HEAD, k, nearLeg: legPts(ph), farLeg: legPts(ph + Math.PI), nearArm: armPts(ph + Math.PI), farArm: armPts(ph) };
}

function stroke(c: CanvasRenderingContext2D, pts: P[], w: number[], x: number, y: number) {
  for (let i = 1; i < pts.length; i++) {
    c.lineWidth = w[i - 1] ?? w[w.length - 1]!;
    c.beginPath(); c.moveTo(x + pts[i - 1]!.x, y + pts[i - 1]!.y); c.lineTo(x + pts[i]!.x, y + pts[i]!.y); c.stroke();
  }
}

/** Draw the runner with feet on (x, groundY). Returns the near hand's position. */
export function drawRunner(c: CanvasRenderingContext2D, x: number, groundY: number, ph: number, o: RunnerOpts = {}) {
  const P = runnerPose(ph, o.size ?? 380, o.lean ?? 0.3, o.amp ?? 1);
  const k = P.k;
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  // far limbs first, a step lighter
  c.strokeStyle = o.far ?? o.near ?? '#000';
  stroke(c, P.farArm, [26 * k, 22 * k], x, groundY);
  stroke(c, P.farLeg, [42 * k, 33 * k, 18 * k], x, groundY);
  c.strokeStyle = o.near ?? '#000';
  c.fillStyle = o.near ?? '#000';
  // torso: one thick round stroke, slightly fuller at the chest
  const h = P.hip, s = P.sho;
  c.lineWidth = 38 * k; c.beginPath(); c.moveTo(x + h.x, groundY + h.y); c.lineTo(x + s.x, groundY + s.y); c.stroke();
  const ch = { x: h.x * 0.35 + s.x * 0.65, y: h.y * 0.35 + s.y * 0.65 };
  c.lineWidth = 44 * k; c.beginPath(); c.moveTo(x + ch.x, groundY + ch.y); c.lineTo(x + s.x, groundY + s.y); c.stroke();
  // neck + head (no face)
  c.lineWidth = 20 * k; c.beginPath(); c.moveTo(x + s.x, groundY + s.y); c.lineTo(x + P.head.x, groundY + P.head.y); c.stroke();
  c.beginPath(); c.arc(x + P.head.x, groundY + P.head.y, P.headR, 0, Math.PI * 2); c.fill();
  stroke(c, P.nearLeg, [44 * k, 35 * k, 19 * k], x, groundY);
  stroke(c, P.nearArm, [28 * k, 24 * k], x, groundY);
  c.restore();
  const hand = P.nearArm[2]!;
  return { x: x + hand.x, y: groundY + hand.y };
}

/** Cycle phase from a continuous beat index: `perBeat` footfalls per beat. */
export const runPhase = (beat: number, perBeat = 1) => beat * Math.PI * perBeat;
/** Opacity of the chronophotograph echo i (1 = most recent) of n. */
export const echoAlpha = (i: number, n: number) => clamp(0.22 * (1 - (i - 1) / n));
