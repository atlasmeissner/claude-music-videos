// The story kit (revision 3): one person, one ledge, one door.
//  - THE PERSON: the pictogram figure from _ff.ts with a story's worth of extra poses (sitting on the edge, head in
//    hands, on the phone, peering down, recoiling, frozen at the edge, writing), drawn bone on ink.
//  - THE WORLD: a ledge in elevation (origin at the edge's top, x right, y down, px), the lower ground, and the goal
//    — a doorway in a low wall across the gap, spilling orange light. The DROP is drawn the way it feels: `fear`
//    (0..1) pushes the lower ground down into a hatched abyss; at fear 0 it is its true height, 1.40 m — shoulder-high.
//  - DAWN: an engraved horizon glow (orange, the only colour we have) for "the sky is screaming blue".
//  - THE COUNTER: DAYS ON THE LEDGE, the running number (staged in-world, like pdoom's P(doom)).
import { rgba } from '../engine/palette';
import { clamp, ease, hash, lerp, noise1, prog, TAU } from '../engine/util';
import { drawFigure, mixPose, mono, POSES, runPose, type Pose } from './_ff';

// ------------------------------------------------------------------ scale
/** The person's height in world px; metres → px. */
export const S = 260;
export const M = S / 1.75;
/** The true drop: 1.40 m — shoulder height. */
export const TRUE_DROP = 1.4 * M;
/** How much deeper the drop looks at fear = 1. */
export const FEAR_DROP = 2600;
export const dropAt = (fear: number) => TRUE_DROP + FEAR_DROP * fear;
/** The goal: the doorway's x on the lower ground. */
export const DOOR_X = 760;
export const HIP_H = 0.53 * S; // hip height above the feet, standing

// ------------------------------------------------------------------ poses (profile, facing +x unless noted)
const P = (torso: number, head: number, a1: number, a2: number, b1: number, b2: number, l1: number, l2: number, m1: number, m2: number, hip = 0): Pose =>
  ({ torso, head, a1, a2, b1, b2, l1, l2, m1, m2, hip });
export const SP = {
  ...POSES,
  /** sitting on the edge, legs over it (hip on the ledge top: draw with hip at y = -0.05 S) */
  sit: P(0.12, 0.3, 0.75, 1.15, 0.6, 1.0, 1.45, -0.02, 1.35, 0.06),
  /** sitting, elbows on knees, head in hands */
  hunch: P(0.6, 0.45, 0.4, 2.2, 0.3, 2.1, 0.97, -0.5, 0.9, -0.42),
  /** sitting with a notebook or phone on the knees, writing */
  write: P(0.35, 0.55, 1.05, 1.75, 0.85, 1.6, 1.22, -0.25, 1.12, -0.2),
  /** standing, looking at a phone */
  phone: P(0.04, 0.5, 0.35, 2.45, -0.1, -0.05, 0.05, 0.04, -0.05, -0.04),
  /** leaning over the edge, peering down */
  peer: P(0.42, 0.55, -0.55, -0.4, -0.7, -0.55, -0.42, -0.42, -0.3, -0.5),
  /** recoiling from the edge, a hand up */
  recoil: P(-0.22, -0.25, 1.7, 2.3, -0.6, -0.3, 0.25, 0.05, -0.45, -0.62),
  /** frozen at the edge, arms windmilling back */
  freeze: P(0.25, 0.35, -1.5, -1.3, -1.9, -1.6, -0.25, -0.25, -0.35, -0.45),
  /** a deep breath, shoulders up, chin up */
  breathe: P(-0.06, -0.3, 0.25, 0.2, -0.25, -0.2, 0.08, 0.05, -0.08, -0.05),
  /** crouched, ready to run (facing +x) */
  set: P(0.7, -0.2, -0.9, -0.4, 0.9, 1.5, 1.2, -0.35, -0.6, -1.4, 0.12),
  /** standing tall and still (the statue) */
  statue: P(0, 0, 0.14, 0.12, -0.14, -0.12, 0.05, 0.04, -0.05, -0.04),
  /** a wave (front-ish): one arm up */
  wave: P(0, -0.1, 2.6, 3.0, -0.25, -0.2, 0.1, 0.08, -0.1, -0.08),
} satisfies Record<string, Pose>;
export type PoseName = keyof typeof SP;

/** A gentle walk at phase φ. */
export const walkPose = (phi: number) => mixPose(SP.stand, runPose(phi, 0.06), 0.42);
/** Idle breathing on any pose: a tiny torso/head sway. */
export function breath(p: Pose, t: number, k = 1): Pose {
  const s = Math.sin(t * 2.1) * 0.025 * k;
  return { ...p, torso: p.torso + s, head: p.head + s * 0.8 };
}

/** Draw the person with feet on the ground at (x, footY) (world or screen px), height `h` px. */
export function person(c: CanvasRenderingContext2D, x: number, footY: number, h: number, p: Pose, o: { color?: string; dir?: 1 | -1; rot?: number; alpha?: number; sitting?: boolean } = {}) {
  const hipY = o.sitting ? footY - 0.04 * h : footY - 0.53 * h;
  return drawFigure(c, x, hipY, h, p, { color: o.color ?? rgba('bone', 1), dir: o.dir ?? 1, rot: o.rot ?? 0, alpha: o.alpha ?? 1 });
}

// ------------------------------------------------------------------ camera
export interface Cam { x: number; y: number; z: number }
/** Apply a camera: world point (cam.x, cam.y) at the screen centre, zoom z. */
export function applyCam(c: CanvasRenderingContext2D, cam: Cam) {
  c.translate(960, 540); c.scale(cam.z, cam.z); c.translate(-cam.x, -cam.y);
}
export const toScreen = (cam: Cam, x: number, y: number) => ({ x: (x - cam.x) * cam.z + 960, y: (y - cam.y) * cam.z + 540 });
export function lerpCam(a: Cam, b: Cam, k: number): Cam { return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), k)) }; }
/** Blend through camera keys [[t, cam], …] with inOutCubic between neighbours. */
export function camKeys(t: number, ks: [number, Cam][]): Cam {
  if (t <= ks[0]![0]) return ks[0]![1];
  for (let i = 1; i < ks.length; i++) {
    const [t1, c1] = ks[i]!;
    if (t < t1) { const [t0, c0] = ks[i - 1]!; return lerpCam(c0, c1, ease.inOutCubic(clamp((t - t0) / (t1 - t0)))); }
  }
  return ks[ks.length - 1]![1];
}

// ------------------------------------------------------------------ the world
export interface WorldStyle {
  t: number;
  fear: number; // 0 = the true 1.40 m drop, 1 = a bottomless abyss
  door?: number; // 0 shut … 1 swung wide (light spills)
  glow?: number; // the door's light, 0..1+
  dawn?: number; // 0 night … 1 the sky screaming (engraved orange horizon)
  stars?: number;
  ledgeX0?: number; // where the ledge's drawing starts (left)
  groundX1?: number;
  ink?: string; // line colour
}

/** Draw the world (in world coords: call after applyCam). */
export function drawWorld(c: CanvasRenderingContext2D, cam: Cam, w: WorldStyle) {
  const t = w.t, fear = clamp(w.fear), D = dropAt(fear);
  const line = w.ink ?? rgba('bone', 0.92);
  const view = { x0: cam.x - 960 / cam.z - 40, x1: cam.x + 960 / cam.z + 40, y0: cam.y - 540 / cam.z - 40, y1: cam.y + 540 / cam.z + 40 };
  // ---- sky: stars, then the dawn (horizon far below the ledge: world y = D * 0.4 + 900, glow rising with dawn)
  const dawn = clamp(w.dawn ?? 0);
  if ((w.stars ?? 1) > 0 && dawn < 1) {
    const sa = (w.stars ?? 1) * (1 - dawn);
    for (let i = 0; i < 160; i++) {
      const x = view.x0 + hash(i, 1) * (view.x1 - view.x0), y = view.y0 + hash(i, 2) * (view.y1 - view.y0) * 0.75;
      const tw = 0.5 + 0.5 * Math.sin(t * (1 + hash(i, 3) * 3) + i);
      c.fillStyle = rgba('bone', (0.15 + 0.5 * hash(i, 4) * tw) * sa);
      c.fillRect(x, y, 1.6 / cam.z, 1.6 / cam.z);
    }
  }
  if (dawn > 0) {
    // engraved sunrise: horizontal hatch lines of ember, denser and brighter toward the horizon, and rays
    const hy = TRUE_DROP + 420 - dawn * 260; // the horizon (behind the lower ground)
    for (let k = 0; k < 34; k++) {
      const y = hy - k * k * 2.2 - k * 10;
      if (y < view.y0) break;
      if (y > dropAt(clamp(w.fear)) - 2) continue;
      const a = 0.75 * dawn * (1 - k / 34) ** 2;
      c.strokeStyle = rgba(k < 6 ? 'ember' : 'signal', a * 0.9);
      c.lineWidth = Math.max(0.8, 3 - k * 0.05) / cam.z;
      c.beginPath(); c.moveTo(view.x0, y); c.lineTo(view.x1, y); c.stroke();
    }
    // rays from the sun (at the far right on the horizon)
    const sx = DOOR_X + 900, sy = hy + 10;
    for (let i = 0; i < 26; i++) {
      const ang = Math.PI + (i / 25) * Math.PI;
      const L = (900 + 1600 * hash(i, 9)) * dawn;
      c.strokeStyle = rgba('signal', 0.22 * dawn); c.lineWidth = (1 + 2 * hash(i, 8)) / cam.z;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(ang) * L, sy + Math.sin(ang) * L); c.stroke();
    }
    c.fillStyle = rgba('ember', 0.95 * dawn);
    c.beginPath(); c.arc(sx, sy, 70, Math.PI, TAU); c.fill();
  }
  // ---- the lower ground (at D) and the goal
  const gx1 = w.groundX1 ?? DOOR_X + 2600;
  c.strokeStyle = line; c.lineWidth = 2 / cam.z;
  c.beginPath(); c.moveTo(0, D); c.lineTo(gx1, D); c.stroke();
  c.save(); c.beginPath(); c.rect(0, D, gx1, 2000); c.clip();
  c.fillStyle = rgba('ink', 1); c.fillRect(Math.max(0, view.x0), D, Math.min(gx1, view.x1) - Math.max(0, view.x0), 2000);
  c.strokeStyle = rgba('graphite', 0.75); c.lineWidth = 1 / cam.z;
  const hs = Math.max(14, 9 / cam.z);
  for (let x = Math.floor(Math.max(0, view.x0) / hs) * hs - 400; x < Math.min(gx1, view.x1) + 400; x += hs) { c.beginPath(); c.moveTo(x, D); c.lineTo(x - 300, D + 300); c.stroke(); }
  c.restore();
  drawDoor(c, DOOR_X, D, w.door ?? 0, w.glow ?? 0.6, t, cam.z, line);
  // ---- the ledge: a block in section, the face going all the way down to the lower ground
  const x0 = w.ledgeX0 ?? -3200;
  const face = (y: number) => (noise1(y * 0.025, 4) - 0.5) * 14 - Math.max(0, y) * 0.015;
  c.save();
  c.beginPath(); c.moveTo(x0, 0);
  for (let x = x0; x <= 0; x += 20) c.lineTo(x, (noise1(x * 0.01, 2) - 0.5) * 3);
  for (let y = 0; y <= D; y += Math.max(6, D / 220)) c.lineTo(face(y), y);
  c.lineTo(x0, D); c.closePath();
  c.fillStyle = rgba('ink2', 1); c.fill();
  c.clip();
  // strata: denser lines toward the depth, so the abyss reads as deep
  c.strokeStyle = rgba('graphite', 0.85); c.lineWidth = 1 / cam.z;
  const gap = Math.max(11, 15 / cam.z);
  for (let y = 8; y < D; y += gap * (1 + y / 2400)) {
    if (y < view.y0 - 20 || y > view.y1 + 20) continue;
    c.beginPath();
    const xs = Math.max(24, 30 / cam.z);
    for (let x = Math.max(x0, view.x0); x <= Math.min(10, view.x1); x += xs) {
      const yy = y + (noise1(x * 0.008 + y * 0.01, 9) - 0.5) * 10;
      if (x === Math.max(x0, view.x0)) c.moveTo(x, yy); else c.lineTo(x, yy);
    }
    c.stroke();
  }
  c.restore();
  c.strokeStyle = line; c.lineWidth = 2.2 / cam.z;
  c.beginPath();
  for (let x = Math.max(x0, view.x0 - 20); x <= 0; x += 20) { const y = (noise1(x * 0.01, 2) - 0.5) * 3; if (x <= Math.max(x0, view.x0 - 20)) c.moveTo(x, y); else c.lineTo(x, y); }
  for (let y = 0; y <= D; y += Math.max(6, D / 220)) c.lineTo(face(y), y);
  c.stroke();
  // the abyss: mist (graphite hatching thickening with depth) between the ledge and the lower ground
  if (fear > 0.02) {
    for (let y = 120; y < D - 40; y += Math.max(18, 14 / cam.z)) {
      if (y < view.y0 || y > view.y1) continue;
      const a = fear * 0.35 * clamp((y - 120) / 900);
      c.strokeStyle = rgba('graphite', a); c.lineWidth = 1 / cam.z;
      c.beginPath(); c.moveTo(20, y); c.lineTo(Math.min(gx1, view.x1), y + 6); c.stroke();
    }
  }
}

/** The goal: a low wall with a doorway, in elevation, its light spilling onto the ground toward the ledge. */
export function drawDoor(c: CanvasRenderingContext2D, x: number, gy: number, open: number, glow: number, t: number, z: number, line: string) {
  const dw = 0.95 * M, dh = 2.15 * M;
  const wx0 = x - 60, wx1 = x + dw + 520, wh = 2.9 * M;
  // the light: a trapezoid on the ground and a glow in the opening
  const g = glow * (0.9 + 0.1 * Math.sin(t * 7.3) * Math.sin(t * 3.1)) * (0.35 + 0.65 * open);
  if (g > 0.01) {
    const grad = c.createLinearGradient(x, gy, x - 900, gy);
    grad.addColorStop(0, rgba('ember', 0.55 * g)); grad.addColorStop(1, rgba('signal', 0));
    c.fillStyle = grad;
    c.beginPath(); c.moveTo(x, gy); c.lineTo(x + dw, gy); c.lineTo(x - 900 * (0.4 + 0.6 * open), gy + 6); c.lineTo(x - 300, gy + 2); c.closePath(); c.fill();
    c.fillStyle = rgba('ember', Math.min(1, 0.9 * g + 0.15));
    c.fillRect(x, gy - dh, dw, dh);
    // a halo in the opening
    const r = c.createRadialGradient(x + dw / 2, gy - dh / 2, 10, x + dw / 2, gy - dh / 2, dh * 1.4);
    r.addColorStop(0, rgba('signal', 0.35 * g)); r.addColorStop(1, rgba('signal', 0));
    c.fillStyle = r; c.fillRect(x - dh * 1.5, gy - dh * 2, dh * 3 + dw, dh * 2.2);
  } else {
    c.fillStyle = rgba('ink2', 1); c.fillRect(x, gy - dh, dw, dh);
  }
  // the wall (hatched), the frame, the leaf (seen edge-on as it swings toward us: it narrows)
  c.save();
  c.beginPath(); c.rect(wx0, gy - wh, wx1 - wx0, wh); c.rect(x + dw, gy - dh, -dw, dh); c.clip('evenodd');
  c.fillStyle = rgba('ink2', 1); c.fillRect(wx0, gy - wh, wx1 - wx0, wh);
  c.strokeStyle = rgba('graphite', 0.8); c.lineWidth = 1 / z;
  for (let yy = gy - wh + 10; yy < gy; yy += 12) { c.beginPath(); c.moveTo(wx0, yy); c.lineTo(wx1, yy); c.stroke(); }
  c.restore();
  c.strokeStyle = line; c.lineWidth = 2 / z;
  c.strokeRect(wx0, gy - wh, wx1 - wx0, wh);
  c.strokeRect(x, gy - dh, dw, dh);
  const leafW = dw * Math.cos(open * Math.PI * 0.5);
  if (leafW > 1) {
    c.fillStyle = rgba('ink', 1); c.fillRect(x, gy - dh, leafW, dh);
    c.strokeStyle = line; c.strokeRect(x, gy - dh, leafW, dh);
    c.fillStyle = line; c.beginPath(); c.arc(x + leafW * 0.85, gy - dh * 0.48, 4 / z + 2, 0, TAU); c.fill();
  }
}

// ------------------------------------------------------------------ the counter
const DAY_KEYS: [number, number][] = [[0, 1], [24.4, 3], [31.1, 9], [38.6, 9], [44.1, 9], [57.9, 9], [64.1, 41], [77.5, 120], [86.7, 121], [101.3, 300], [120.5, 365], [133.4, 411], [133.5, 412]];
/** DAYS ON THE LEDGE at t (it stops at 412 when they jump). */
export function daysAt(t: number): number {
  let v = 1;
  for (let i = 1; i < DAY_KEYS.length; i++) {
    const [t0, v0] = DAY_KEYS[i - 1]!, [t1, v1] = DAY_KEYS[i]!;
    if (t >= t1) { v = v1; continue; }
    if (t >= t0) v = v0 + (v1 - v0) * ease.inOutQuad(clamp((t - t0) / (t1 - t0)));
    break;
  }
  return Math.floor(v);
}
/** The counter, in the corner: DAYS ON THE LEDGE  37 (with the given label and value when overridden). */
export function drawCounter(c: CanvasRenderingContext2D, t: number, o: { x?: number; y?: number; alpha?: number; label?: string; value?: string; ink?: string; hot?: string } = {}) {
  const x = o.x ?? 104, y = o.y ?? 1000;
  c.save(); c.globalAlpha *= o.alpha ?? 1;
  mono(c, o.label ?? 'DAYS ON THE LEDGE', x, y - 34, { size: 12, color: o.ink ?? rgba('ash', 0.85), track: 4 });
  mono(c, o.value ?? String(daysAt(t)), x, y, { size: 30, color: o.hot ?? rgba('signal', 1), track: 2, weight: 500 });
  c.restore();
}

export { prog, ease, clamp, lerp };
