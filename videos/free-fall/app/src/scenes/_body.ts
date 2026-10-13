// The body (revision 3.1): the person, made to move like one.
//  - A skeleton with forward kinematics. Arms hang in the torso's frame; LEGS ARE IN THE WORLD FRAME (leaning the
//    torso does not swing the legs). Angles are measured from straight down, positive = toward the front.
//  - Feet. A short foot at each ankle (flat when it bears weight, pointed when it doesn't), so contact reads.
//  - Gravity and support: the body is never pinned at a fixed hip height. It rests on whatever its lowest point
//    touches — feet when standing, knees when kneeling, hands when caught on all fours, the seat when sitting —
//    through a support function (ground height under each x), so sitting on the ledge's edge with the legs hanging
//    over it and standing up from it are the same rule. Bent knees lower the hip on their own.
//  - Cycles from keyframes, not sine waves: walk (contact · down · passing · up) and run (contact · down · push ·
//    flight, with a real flight phase), interpolated smoothly and driven by DISTANCE travelled, so feet don't skate.
//  - Ballistics: jumps with anticipation (a crouch, arms back), take-off (extension, arms up), a parabolic flight
//    under constant gravity, and a landing that absorbs (knees give, arms forward) and recovers with a little
//    overshoot. Hops for the crowd. Air drag flutters the limbs in a long fall.
import { clamp, ease, lerp, TAU } from '../engine/util';
import { rgba } from '../engine/palette';

export interface Body {
  torso: number; head: number;
  a1: number; a2: number; b1: number; b2: number; // near / far arm: upper, fore (torso frame, absolute)
  l1: number; l2: number; m1: number; m2: number; // near / far leg: thigh, shin (WORLD frame, absolute)
  front?: number; // 0 profile … 1 seen from the front (feet turn outward)
}

const B = (torso: number, head: number, a1: number, a2: number, b1: number, b2: number, l1: number, l2: number, m1: number, m2: number, front = 0): Body =>
  ({ torso, head, a1, a2, b1, b2, l1, l2, m1, m2, front });

/** Poses. Profile (facing +x) unless marked front. Knees only bend back (shin ≤ thigh), elbows only forward. */
export const BP = {
  stand: B(0.03, 0.04, 0.06, 0.2, -0.04, 0.1, 0.03, 0.0, -0.04, -0.06),
  standFront: B(0, 0, 0.26, 0.2, -0.26, -0.2, 0.09, 0.07, -0.09, -0.07, 1),
  breathe: B(-0.07, -0.3, 0.2, 0.3, -0.12, 0.0, 0.03, 0.0, -0.05, -0.07),
  phone: B(0.04, 0.5, 0.35, 2.45, -0.06, 0.08, 0.03, 0.0, -0.04, -0.06),
  peer: B(0.48, 0.55, -0.5, -0.32, -0.66, -0.5, -0.05, -0.08, -0.16, -0.2),
  recoil: B(-0.24, -0.25, 1.6, 2.3, -0.55, -0.3, 0.05, -0.12, -0.62, -0.8),
  freeze: B(0.32, 0.4, -1.5, -1.3, -1.9, -1.6, 0.02, -0.04, -0.14, -0.22),
  // sitting on the ledge's edge, legs hanging over it
  sit: B(0.1, 0.3, 0.72, 1.12, 0.6, 1.0, 1.56, 0.12, 1.46, 0.2),
  hunch: B(0.62, 0.45, 0.42, 2.2, 0.32, 2.1, 1.56, 0.1, 1.48, 0.18),
  write: B(0.35, 0.55, 1.05, 1.75, 0.85, 1.6, 1.56, 0.12, 1.46, 0.2),
  // jumping
  crouch: B(0.55, -0.12, -0.95, -0.65, -0.75, -0.45, 1.0, -0.45, 0.9, -0.55),
  takeoff: B(0.3, -0.12, 2.6, 2.85, 2.3, 2.6, -0.22, -0.4, -0.38, -0.62),
  leap: B(0.34, 0.08, 2.45, 2.7, 1.75, 2.05, 1.15, 0.45, -0.55, -1.55),
  reach: B(0.18, 0.0, 2.1, 2.3, 1.6, 1.9, 0.75, 0.35, 0.55, 0.15), // legs reaching for the ground
  land: B(0.5, 0.15, 1.3, 1.6, 1.05, 1.35, 1.05, -0.42, 0.8, -0.62),
  tuck: B(0.35, 0.2, 1.0, 2.3, 0.75, 2.1, 2.1, 0.3, 1.9, 0.2),
  star: B(0, 0, 2.05, 2.4, -2.05, -2.4, 0.5, 0.25, -0.5, -0.25, 1),
  // falling over and getting up
  stumble: B(1.05, 0.45, 1.95, 1.95, 1.6, 1.75, 0.62, -0.45, -0.4, -1.15),
  fours: B(1.5, 0.3, -1.25, -1.1, -1.2, -1.05, 0.25, -1.5, 0.15, -1.55),
  sitGround: B(-0.45, 0.3, -0.1, -0.1, -0.15, -0.15, 1.75, 1.36, 1.65, 1.46),
  kneelUp: B(0.15, 0.0, 0.5, 0.9, 0.2, 0.6, 1.45, 0.0, 0.05, -1.5), // one knee down, about to stand
  // front-view crowd
  cheer: B(0, -0.12, 2.5, 2.65, -2.5, -2.65, 0.09, 0.07, -0.09, -0.07, 1),
  hopCrouch: B(0.12, 0.12, 0.55, 0.35, -0.55, -0.35, 0.55, -0.12, -0.55, 0.12, 1),
  hopAir: B(-0.04, -0.15, 2.55, 2.75, -2.55, -2.75, 0.22, 0.02, -0.22, -0.02, 1),
  // misc
  statue: B(0, 0, 0.12, 0.12, -0.12, -0.12, 0.04, 0.03, -0.04, -0.03),
  wave: B(0.03, -0.05, 2.6, 3.05, -0.06, 0.08, 0.03, 0.0, -0.04, -0.06),
  set: B(0.85, -0.25, -0.95, -0.45, 0.95, 1.55, 1.3, 0.05, -0.3, -1.35),
  // sitting on the ground, knees up: phone in the hands / head down on the arms / looking up
  huddle: B(0.32, 0.55, 0.62, 1.95, 0.5, 1.85, 2.3, 0.75, 2.2, 0.86),
  huddleHunch: B(0.72, 0.62, 0.55, 2.55, 0.42, 2.45, 2.3, 0.75, 2.2, 0.86),
  huddleUp: B(0.08, -0.22, 0.95, 1.45, 0.8, 1.3, 2.3, 0.75, 2.2, 0.86),
  // half way down (or up): a deep squat
  squat: B(0.62, 0.15, 0.85, 1.25, 0.65, 1.05, 1.45, -0.15, 1.3, -0.6),
  // kneeling at the edge, leaning over, an arm straight down (the tape measure)
  kneelTape: B(0.95, 0.45, -0.85, -0.85, -0.55, -0.2, 0.55, -1.55, 0.42, -1.6),
  // a throw: wind-up, release
  throwBack: B(-0.18, -0.15, -2.35, -1.85, 0.65, 1.1, 0.42, 0.28, -0.32, -0.42),
  throwFwd: B(0.38, 0.1, 2.0, 1.85, -0.45, -0.2, 0.36, 0.1, -0.42, -0.6),
  // looking back over the shoulder (standing)
  lookBack: B(-0.05, -0.35, 0.1, 0.25, -0.1, 0.05, 0.03, 0.0, -0.04, -0.06),
} satisfies Record<string, Body>;
export type BodyName = keyof typeof BP;

export function mixBody(a: Body, b: Body, k: number): Body {
  const o = {} as Body;
  for (const key of ['torso', 'head', 'a1', 'a2', 'b1', 'b2', 'l1', 'l2', 'm1', 'm2'] as const) o[key] = a[key] + (b[key] - a[key]) * k;
  o.front = (a.front ?? 0) + ((b.front ?? 0) - (a.front ?? 0)) * k;
  return o;
}
/** Smooth keyed blend: [[t, body], …]; each transition takes `blend` s ending at its key (smoothstep). */
export function bodyKeys(t: number, ks: [number, Body][], blend = 0.3): Body {
  let p = ks[0]![1];
  for (let i = 1; i < ks.length; i++) {
    const [tk, pk] = ks[i]!;
    if (t < tk - blend) break;
    p = mixBody(p, pk, ease.inOutCubic(clamp((t - (tk - blend)) / blend)));
  }
  return p;
}
const mirror = (p: Body): Body => ({ ...p, a1: p.b1, a2: p.b2, b1: p.a1, b2: p.a2, l1: p.m1, l2: p.m2, m1: p.l1, m2: p.l2 });

/** Cyclic Catmull-Rom through 8 keys (4 + their mirror), at phase φ (one cycle = two steps). */
function cycle(keys: Body[], phi: number): Body {
  const all = [...keys, ...keys.map(mirror)];
  const n = all.length;
  const f = (((phi % 1) + 1) % 1) * n;
  const i = Math.floor(f), u = f - i;
  const p0 = all[(i - 1 + n) % n]!, p1 = all[i]!, p2 = all[(i + 1) % n]!, p3 = all[(i + 2) % n]!;
  const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  const o = {} as Body;
  for (const key of ['torso', 'head', 'a1', 'a2', 'b1', 'b2', 'l1', 'l2', 'm1', 'm2'] as const) o[key] = cr(p0[key], p1[key], p2[key], p3[key]);
  o.front = 0;
  return o;
}
// walk: contact · down · passing · up (near leg leads at contact)
const WALK = [
  B(0.05, 0.02, -0.32, -0.18, 0.3, 0.52, 0.42, 0.32, -0.36, -0.52),
  B(0.07, 0.04, -0.2, -0.05, 0.2, 0.4, 0.3, 0.05, -0.18, -0.85),
  B(0.05, 0.02, 0.0, 0.18, 0.0, 0.18, 0.02, -0.02, 0.32, -0.45),
  B(0.04, 0.0, 0.18, 0.4, -0.18, -0.05, -0.24, -0.34, 0.48, 0.34),
];
// run: contact · down · push · flight
const RUN = [
  B(0.22, -0.05, -0.65, 0.75, 0.65, 2.05, 0.52, 0.34, -0.48, -1.25),
  B(0.26, -0.03, -0.35, 1.0, 0.35, 1.75, 0.28, -0.18, 0.12, -1.6),
  B(0.28, -0.05, 0.25, 1.6, -0.25, 1.15, -0.46, -0.58, 0.95, 0.2),
  B(0.24, -0.06, 0.55, 1.95, -0.55, 0.85, -0.62, -1.15, 0.85, 0.55),
];
/** Walk cycle length (two steps) and run cycle length, in units of the body's height. */
export const WALK_LEN = 0.8, RUN_LEN = 1.9;
export const walkCycle = (phi: number) => cycle(WALK, phi);
export const runCycle = (phi: number) => cycle(RUN, phi);
/** Run flight lift (fraction of height) — both feet off the ground between push and contact. */
export const runLift = (phi: number) => {
  const f = ((phi % 0.5) + 0.5) % 0.5; // per step
  return f > 0.25 ? 0.075 * Math.sin(Math.PI * (f - 0.25) / 0.25) : 0;
};
/** Phase from distance travelled (px) for a body of height S: feet stay planted. */
export const walkPhase = (dist: number, S: number) => dist / (WALK_LEN * S);
export const runPhase = (dist: number, S: number) => dist / (RUN_LEN * S);

/** Idle: breathing and a slow weight shift. */
export function idle(p: Body, t: number, k = 1): Body {
  const br = Math.sin(t * 1.9) * 0.022 * k, sway = Math.sin(t * 0.7) * 0.015 * k;
  return { ...p, torso: p.torso + br + sway, head: p.head + br * 0.6, a1: p.a1 + br * 0.5, b1: p.b1 + br * 0.5 };
}
/** Air drag in a long fall: limbs flutter (deterministic in t). */
export function flutter(p: Body, t: number, k = 1): Body {
  const f = (s: number, w: number) => Math.sin(t * w + s) * Math.sin(t * w * 0.63 + s * 2) * 0.12 * k;
  return { ...p, a1: p.a1 + f(1, 9), a2: p.a2 + f(2, 11), b1: p.b1 + f(3, 8.5), b2: p.b2 + f(4, 10), l1: p.l1 + f(5, 7), l2: p.l2 + f(6, 8), m1: p.m1 + f(7, 7.5), m2: p.m2 + f(8, 9) };
}

// ------------------------------------------------------------------ kinematics
export const DIM = { torso: 0.29, thigh: 0.25, shin: 0.235, upper: 0.155, fore: 0.15, neck: 0.145, head: 0.08, foot: 0.085, wLeg: 0.085, wArm: 0.075, wTorso: 0.135, seat: 0.07 };
const d = (th: number) => [Math.sin(th), Math.cos(th)] as const;

export interface Joints {
  hip: [number, number]; shoulder: [number, number]; head: [number, number];
  kneeN: [number, number]; ankleN: [number, number]; toeN: [number, number];
  kneeF: [number, number]; ankleF: [number, number]; toeF: [number, number];
  elbowN: [number, number]; handN: [number, number]; elbowF: [number, number]; handF: [number, number];
}
/** Joint positions in figure space (hip at the origin, y down, facing +x), for height S. */
export function fk(p: Body, S: number): Joints {
  const T = p.torso;
  const sh: [number, number] = [Math.sin(T) * DIM.torso * S, -Math.cos(T) * DIM.torso * S];
  const ha = T + p.head;
  const head: [number, number] = [sh[0] + Math.sin(ha) * DIM.neck * S, sh[1] - Math.cos(ha) * DIM.neck * S];
  const leg = (t1: number, t2: number, sideOut: number) => {
    const [ux, uy] = d(t1), [vx, vy] = d(t2);
    const knee: [number, number] = [ux * DIM.thigh * S, uy * DIM.thigh * S];
    const ankle: [number, number] = [knee[0] + vx * DIM.shin * S, knee[1] + vy * DIM.shin * S];
    // foot: roughly flat and forward (a little perpendicular to the shin); when the shin lies back (kneeling, the push
    // of a stride) it points back along the shin, lying flat on its top; front view turns it outward
    const fr = p.front ?? 0;
    const w = clamp((-t2 - 0.75) / 0.55);
    let px = Math.cos(t2) * 0.6 + 0.4, py = -Math.sin(t2) * 0.25;
    const pn = Math.hypot(px, py) || 1; px /= pn; py /= pn;
    let fx = lerp(lerp(px, Math.sin(t2), w), sideOut, fr), fy = lerp(lerp(py, Math.cos(t2), w), 0, fr);
    const n = Math.hypot(fx, fy) || 1; fx /= n; fy /= n;
    const toe: [number, number] = [ankle[0] + fx * DIM.foot * S, ankle[1] + fy * DIM.foot * S];
    return { knee, ankle, toe };
  };
  const arm = (t1: number, t2: number) => {
    const o: [number, number] = [sh[0] * 0.94, sh[1] * 0.94];
    const [ux, uy] = d(T + t1), [vx, vy] = d(T + t2);
    const elbow: [number, number] = [o[0] + ux * DIM.upper * S, o[1] + uy * DIM.upper * S];
    const hand: [number, number] = [elbow[0] + vx * DIM.fore * S, elbow[1] + vy * DIM.fore * S];
    return { elbow, hand };
  };
  const N = leg(p.l1, p.l2, 1), F = leg(p.m1, p.m2, -1), AN = arm(p.a1, p.a2), AF = arm(p.b1, p.b2);
  return { hip: [0, 0], shoulder: sh, head, kneeN: N.knee, ankleN: N.ankle, toeN: N.toe, kneeF: F.knee, ankleF: F.ankle, toeF: F.toe, elbowN: AN.elbow, handN: AN.hand, elbowF: AF.elbow, handF: AF.hand };
}

/** Contact points with their radii (for resting on the ground). */
function contacts(j: Joints, S: number): [number, number, number][] {
  const r = DIM.wLeg * S / 2;
  return [
    [j.ankleN[0], j.ankleN[1], r], [j.toeN[0], j.toeN[1], r * 0.85], [j.ankleF[0], j.ankleF[1], r], [j.toeF[0], j.toeF[1], r * 0.85],
    [j.kneeN[0], j.kneeN[1], r], [j.kneeF[0], j.kneeF[1], r],
    [j.handN[0], j.handN[1], DIM.wArm * S / 2], [j.handF[0], j.handF[1], DIM.wArm * S / 2],
    [0, -0.02 * S, DIM.wTorso * S / 2], // the seat: exactly the drawn bottom of the torso (no hovering when sitting)
    [j.head[0], j.head[1], DIM.head * S],
  ];
}

export interface BodyStyle { color?: string; dir?: 1 | -1; rot?: number; alpha?: number; outline?: string; far?: number }
/** Hip y such that the body rests on the support (ground height at world x), given its x, facing and roll. */
export function restHipY(x: number, p: Body, S: number, support: (wx: number) => number, o: BodyStyle = {}): number {
  const j = fk(p, S), dir = o.dir ?? 1, r = (o.rot ?? 0) * dir;
  const cr = Math.cos(r), sr = Math.sin(r);
  let best = Infinity;
  for (const [px, py, rad] of contacts(j, S)) {
    const lx = px * dir;
    const wx = x + lx * cr - py * sr, wy = lx * sr + py * cr;
    best = Math.min(best, support(wx) - (wy + rad));
  }
  return best;
}
/** Hip y such that the lowest point of the body sits at `y` (in flight: the path of the feet). */
export function lowestHipY(p: Body, S: number, y: number, o: BodyStyle = {}): number {
  return restHipY(0, p, S, () => y, o);
}

/** Draw the body with its hip at (x, hipY). Returns the joints in canvas space (head first). */
export function drawBody(c: CanvasRenderingContext2D, x: number, hipY: number, S: number, p: Body, o: BodyStyle = {}) {
  const dir = o.dir ?? 1, rot = o.rot ?? 0;
  const col = o.color ?? rgba('bone', 1);
  const j = fk(p, S);
  const pass = (color: string, farColor: string, extra: number) => {
    c.save();
    c.translate(x, hipY); c.rotate(rot * dir); c.scale(dir, 1);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const seg = (pts: [number, number][], w: number, cc: string) => {
      c.strokeStyle = cc; c.lineWidth = w * S + extra;
      c.beginPath(); c.moveTo(pts[0]![0], pts[0]![1]); for (const q of pts.slice(1)) c.lineTo(q[0], q[1]); c.stroke();
    };
    // far limbs (dimmer: depth), torso, near limbs, head
    seg([[0, 0], j.kneeF, j.ankleF], DIM.wLeg, farColor);
    seg([j.ankleF, j.toeF], DIM.wLeg * 0.8, farColor);
    seg([[j.shoulder[0] * 0.94, j.shoulder[1] * 0.94], j.elbowF, j.handF], DIM.wArm, farColor);
    seg([[0, -0.02 * S], [j.shoulder[0] * 0.92, j.shoulder[1] * 0.92]], DIM.wTorso, color);
    seg([[0, 0], j.kneeN, j.ankleN], DIM.wLeg, color);
    seg([j.ankleN, j.toeN], DIM.wLeg * 0.8, color);
    seg([[j.shoulder[0] * 0.94, j.shoulder[1] * 0.94], j.elbowN, j.handN], DIM.wArm, color);
    c.fillStyle = color;
    c.beginPath(); c.arc(j.head[0], j.head[1], DIM.head * S + extra / 2, 0, TAU); c.fill();
    c.restore();
  };
  c.save();
  c.globalAlpha *= o.alpha ?? 1;
  const farK = o.far ?? 0.72;
  if (o.outline) {
    pass(o.outline, o.outline, 3);
    pass(rgba('ink', 1), rgba('ink', 1), 0);
  } else pass(col, dimCss(col, farK), 0);
  c.restore();
  const cr = Math.cos(rot * dir), sr = Math.sin(rot * dir);
  const w = (q: [number, number]) => ({ x: x + q[0] * dir * cr - q[1] * sr, y: hipY + q[0] * dir * sr + q[1] * cr });
  return { head: w(j.head), handN: w(j.handN), handF: w(j.handF), hip: w([0, 0]) };
}
function dimCss(css: string, k: number): string {
  const m = css.match(/[\d.]+/g);
  if (!m) return css;
  const [r, g, b, a] = m.map(Number);
  return `rgba(${(r! * k).toFixed(0)},${(g! * k).toFixed(0)},${(b! * k).toFixed(0)},${a ?? 1})`;
}

// ------------------------------------------------------------------ ballistics
export interface JumpSpec {
  tTake: number; // take-off (feet leave the ground)
  air: number; // seconds airborne (screen time: slow motion just lengthens it)
  from: { x: number; y: number }; // feet at take-off
  to: { x: number; y: number }; // feet at landing
  apex: number; // px above the higher of the two
  crouch?: number; // anticipation length (s)
  recover?: number; // landing recovery length (s)
  pre?: Body; // the pose before the crouch
  post?: Body; // the pose after recovery
  airPose?: (u: number) => Body; // the pose in flight at u = 0..1
}
export interface BodyState { x: number; y: number; mode: 'ground' | 'air'; pose: Body; landed: number }
/** A jump: anticipation, take-off, parabolic flight (constant gravity), absorbing landing, recovery. */
export function jumpState(t: number, j: JumpSpec): BodyState {
  const cr = j.crouch ?? 0.22, rec = j.recover ?? 0.45;
  const pre = j.pre ?? BP.stand, post = j.post ?? BP.stand;
  const tLand = j.tTake + j.air;
  if (t < j.tTake) {
    const k = clamp((t - (j.tTake - cr)) / cr);
    // crouch down, then (last 30%) extend into the take-off
    const pose = k < 0.7 ? mixBody(pre, BP.crouch, ease.inOutCubic(k / 0.7)) : mixBody(BP.crouch, BP.takeoff, ease.inQuad((k - 0.7) / 0.3));
    return { x: j.from.x, y: j.from.y, mode: 'ground', pose, landed: 0 };
  }
  if (t < tLand) {
    const u = (t - j.tTake) / j.air;
    const top = Math.min(j.from.y, j.to.y) - j.apex;
    // a parabola through from (u=0), top, to (u=1): y = a u² + b u + c with the vertex at u*
    const h0 = j.from.y - top, h1 = j.to.y - top;
    const us = Math.sqrt(h0) / (Math.sqrt(h0) + Math.sqrt(h1));
    const a = h0 / (us * us);
    const y = top + a * (u - us) * (u - us);
    const x = lerp(j.from.x, j.to.x, u);
    const pose = j.airPose ? j.airPose(u) : u < 0.25 ? mixBody(BP.takeoff, BP.leap, ease.outCubic(u / 0.25)) : u < 0.7 ? BP.leap : mixBody(BP.leap, BP.reach, ease.inOutCubic((u - 0.7) / 0.3));
    return { x, y, mode: 'air', pose, landed: 0 };
  }
  const v = t - tLand;
  // absorb: knees give fast (0.1 s), then recover with a small overshoot (spring)
  const give = ease.outCubic(clamp(v / 0.1));
  const up = clamp((v - 0.1) / rec);
  const spring = up >= 1 ? 1 : 1 - Math.exp(-6 * up) * Math.cos(9 * up);
  const pose = up <= 0 ? mixBody(BP.reach, BP.land, give) : mixBody(BP.land, post, clamp(spring, 0, 1.08));
  return { x: j.to.x, y: j.to.y, mode: 'ground', pose, landed: v };
}

/** A crowd hop (front view): crouch, spring up, land soft. Period-free: give the take-off time and height. */
export function hopState(t: number, tTake: number, height: number, S: number, base: Body = BP.cheer): { lift: number; pose: Body } {
  const g = 9.81 * (S / 1.75); // px/s² for a body of height S (1.75 m)
  const air = 2 * Math.sqrt((2 * height) / g);
  const v = t - tTake;
  if (v < -0.16 || v > air + 0.3) return { lift: 0, pose: base };
  if (v < 0) return { lift: 0, pose: mixBody(base, BP.hopCrouch, ease.inOutCubic((v + 0.16) / 0.16)) };
  if (v < air) { const u = v / air; return { lift: 4 * height * u * (1 - u), pose: mixBody(BP.hopCrouch, BP.hopAir, ease.outCubic(clamp(u / 0.3))) }; }
  const w = (v - air) / 0.3;
  return { lift: 0, pose: w < 0.35 ? mixBody(BP.hopAir, BP.hopCrouch, ease.outCubic(w / 0.35)) : mixBody(BP.hopCrouch, base, ease.inOutCubic((w - 0.35) / 0.65)) };
}
/** Real gravity for a body of height S (px/s²). */
export const gravity = (S: number) => 9.81 * (S / 1.75);

// ------------------------------------------------------------------ choreography
/**
 * A track: a person's x, pose and facing over time, from a list of moves, each starting at `at`:
 *   { at, pose, x?, face? }               — settle into a pose (blending from the last over `blend` s)
 *   { at, walk: x1, dur, face?, back? }   — walk to x1 (eased start and stop; legs phased by distance, so feet
 *                                            don't skate); `back`: stepping backwards while facing `face`
 *   { at, run: x1, dur, face? }           — run (with flight), ending in `end` (default: stand)
 * Returns the state at t, and `lift` (run flight, fraction of height) to subtract from the rest height.
 */
export interface Move { at: number; pose?: Body; x?: number; face?: 1 | -1; blend?: number; walk?: number; run?: number; dur?: number; back?: boolean; end?: Body; accel?: boolean; ph0?: number }
export interface TrackState { x: number; pose: Body; dir: 1 | -1; lift: number; moving: boolean }
export function track(t: number, moves: Move[], S: number, x0: number, pose0: Body = BP.stand, dir0: 1 | -1 = 1): TrackState {
  let st: TrackState = { x: x0, pose: pose0, dir: dir0, lift: 0, moving: false };
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i]!;
    if (t < m.at) break;
    const next = moves[i + 1];
    const tt = next ? Math.min(t, next.at) : t; // evaluate this move up to t or to the next move's start
    st = evalMove(tt, m, st, S);
  }
  return st;
}
function evalMove(t: number, m: Move, from: TrackState, S: number): TrackState {
  const v = t - m.at;
  if (m.walk !== undefined || m.run !== undefined) {
    const run = m.run !== undefined;
    const x1 = (run ? m.run : m.walk)!;
    const dur = m.dur ?? Math.abs(x1 - from.x) / (run ? 2.6 * S : 0.75 * S);
    const k = clamp(v / dur);
    // eased start and stop (a run may only accelerate: it ends at speed, e.g. into a jump)
    const e = run && m.accel ? k * k : run ? (k < 0.15 ? 0.5 * k * k / 0.15 : k - 0.075) / 0.925 : k * k * (3 - 2 * k);
    const x = lerp(from.x, x1, clamp(e));
    const dist = Math.abs(x - from.x);
    const face: 1 | -1 = m.face ?? (x1 >= from.x ? 1 : -1);
    const sgn = m.back ? -1 : 1;
    const phase = (m.ph0 ?? 0) + sgn * (run ? runPhase(dist, S) : walkPhase(dist, S));
    const cyc = run ? runCycle(phase) : walkCycle(phase);
    const end = m.end ?? BP.stand;
    // blend in from the previous pose (turning through the front view if the facing changes), out into the end pose
    const tin = face !== from.dir ? 0.4 : 0.22;
    const bin = clamp(v / tin), bout = run && m.accel ? 0 : clamp((v - dur + 0.22) / 0.22);
    let pose: Body, dir = face;
    if (face !== from.dir && bin < 0.5) { pose = mixBody(from.pose, BP.standFront, ease.inOutCubic(bin * 2)); dir = from.dir; }
    else if (face !== from.dir) pose = mixBody(BP.standFront, cyc, ease.inOutCubic(bin * 2 - 1));
    else pose = mixBody(from.pose, cyc, ease.inOutCubic(bin));
    if (bout > 0) pose = mixBody(pose, end, ease.inOutCubic(bout));
    const lift = run ? runLift(phase) * (1 - bout) * bin : 0;
    return { x, pose, dir, lift, moving: k < 1 };
  }
  const blend = m.blend ?? 0.35;
  const k = ease.inOutCubic(clamp(v / blend));
  const x = m.x !== undefined ? lerp(from.x, m.x, k) : from.x;
  const target = m.pose ?? from.pose;
  if (m.face !== undefined && m.face !== from.dir) {
    // a turn: through the front view, flipping at the half-way point
    const kk = clamp(v / Math.max(blend, 0.4));
    if (kk < 0.5) return { x, pose: mixBody(from.pose, BP.standFront, ease.inOutCubic(kk * 2)), dir: from.dir, lift: 0, moving: false };
    return { x, pose: mixBody(BP.standFront, target, ease.inOutCubic(kk * 2 - 1)), dir: m.face, lift: 0, moving: false };
  }
  return { x, pose: mixBody(from.pose, target, k), dir: m.face ?? from.dir, lift: 0, moving: false };
}

/**
 * A dancing crowd member (front view), a pure function of the beat. Everyone is loosely in time (a little personal
 * timing jitter) and moves in their own way, picked by seed:
 *   0 jumper  — hops on every beat (a real parabola, crouching between), arms flung up in the air
 *   1 pumper  — knees bouncing, one fist pumping up on the beat, the other hand on the hip
 *   2 waver   — both arms up, swaying side to side over two beats
 *   3 clapper — clapping overhead on every beat
 *   4 stepper — side-steps, weight shifting from foot to foot, arms swinging
 * `energy` (0..1) scales everything (at 0: a light sway). Returns the pose, the lift (fraction of h) and a sideways
 * shift (px).
 */
export function crowdDance(t: number, beat: number, seed: number, h: number, energy = 1): { pose: Body; lift: number; dx: number } {
  const hs = (k: number) => { const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const style = Math.floor(hs(1) * 5);
  const bt = beat + (hs(2) - 0.5) * 0.14; // personal timing
  const ph = bt - Math.floor(bt); // 0 on the beat
  const e = clamp(energy) * (0.75 + 0.25 * hs(3));
  const dip = (0.5 + 0.5 * Math.cos(TAU * ph)) * (0.45 + 0.55 * e); // knees most bent on the beat
  const sway = Math.sin(Math.PI * bt + hs(4) * 0.6); // a two-beat side to side
  const legs = (k: number) => ({ l1: lerp(0.09, 0.55, k), l2: lerp(0.07, -0.12, k), m1: lerp(-0.09, -0.55, k), m2: lerp(-0.07, 0.12, k) });
  let lift = 0, dx = 0;
  let p: Body;
  if (style === 0) {
    // hop: take-off at ph 0.08, a parabola lasting `af` of the beat, crouch around the landing
    const af = 0.62, u = (ph - 0.08) / af;
    const H = (0.05 + 0.05 * hs(5)) * e;
    lift = u > 0 && u < 1 ? 4 * H * u * (1 - u) : 0;
    const air = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
    const crouch = u <= 0 ? 1 - ph / 0.08 * 0.6 : u >= 1 ? clamp((u - 1) * af / (1 - 0.08 - af)) : 0;
    p = { torso: 0.05 * sway, head: -0.1 * air, a1: lerp(0.5, 2.6, air) + 0.2 * sway, a2: lerp(0.3, 2.8, air), b1: lerp(-0.5, -2.6, air) + 0.2 * sway, b2: lerp(-0.3, -2.8, air), ...legs(0.55 * crouch * e + 0.1 * air), front: 1 };
  } else if (style === 1) {
    const pump = Math.exp(-ph * 6) * (0.6 + 0.4 * e);
    p = { torso: 0.06 * sway, head: 0.1 * sway - 0.12 * pump, a1: 1.7 + 1.15 * pump, a2: 2.0 + 0.9 * pump, b1: -0.55, b2: 0.75, ...legs(0.32 * dip), front: 1 };
  } else if (style === 2) {
    const sw = 0.38 * sway * (0.5 + 0.5 * e);
    p = { torso: 0.12 * sway * e, head: 0.15 * sway, a1: 2.55 + sw, a2: 2.75 + sw * 1.3, b1: -2.55 + sw, b2: -2.75 + sw * 1.3, ...legs(0.18 * dip), front: 1 };
  } else if (style === 3) {
    const cl = Math.exp(-ph * 7); // hands together on the beat, apart between
    p = { torso: 0.04 * sway, head: -0.15 * cl, a1: lerp(2.35, 2.8, cl), a2: lerp(2.0, 3.65, cl), b1: lerp(-2.35, -2.8, cl), b2: lerp(-2.0, -3.65, cl), ...legs(0.25 * dip), front: 1 };
  } else {
    const st = Math.sin(Math.PI * bt); // weight on the near foot (+) / far foot (−)
    dx = 0.08 * h * st * e;
    const L = legs(0.2 * dip);
    p = { torso: -0.07 * st * e, head: 0.1 * st, a1: 0.6 + 0.5 * st * e, a2: 1.8 + 0.4 * st, b1: -0.6 + 0.5 * st * e, b2: -1.8 + 0.4 * st, ...L, l1: L.l1 + 0.22 * Math.max(0, -st) * e, m1: L.m1 - 0.22 * Math.max(0, st) * e, front: 1 };
  }
  return { pose: p, lift, dx };
}
