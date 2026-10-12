// 3D line structures (metres, y up, the entrance faces +z):
//  - OLD: the inherited building's bones (its structural frame, as the strip-out left it), for the x-ray;
//  - NAVE: the cathedral built from first principles — piers, pointed arcades, transverse arches, rib vaults,
//    aisle vaults, flying buttresses, an apse and a rose — every member tagged with a build stage and order.
import * as THREE from 'three';
import { W, H } from '../engine/gl';
import { hash } from '../engine/util';
import type { AudioData } from '../engine/audio';
import type { LineBatch } from '../engine/lines';

export type V3 = [number, number, number];
export interface Seg3 { a: V3; b: V3; w: number; stage: number; order: number; m: number }

let member = 0;
function pushPoly(out: Seg3[], pts: V3[], w: number, stage: number, order: number) {
  member++;
  for (let i = 1; i < pts.length; i++) out.push({ a: pts[i - 1]!, b: pts[i]!, w, stage, order, m: member });
}

// ------------------------------------------------------------------ the old frame
const GX = [-7.7, -6.05, -4.4, -3.75, -2.25, -0.75, 0.75, 2.25, 3.75, 4.4, 6.05, 7.7];
const GZ = [0, -1.2, -3.6, -6.0];
export const OLD: Seg3[] = (() => {
  const o: Seg3[] = [];
  const top = (x: number) => (Math.abs(x) > 4.3 ? 5.4 : 6.0);
  for (const z of GZ) for (const x of GX) {
    if (z === -1.2 && Math.abs(x) > 4.3) continue;
    if (z === 0 && Math.abs(x) <= 4.3 && Math.abs(x) > 0.5 && ![-3.75, -2.25, -0.75, 0.75, 2.25, 3.75].includes(x)) continue;
    pushPoly(o, [[x, 0, z], [x, top(x), z]], 2, 0, 0);
  }
  for (const z of GZ) for (const y of [0.42, 2.7]) pushPoly(o, [[-7.7, y, z], [7.7, y, z]], 1.6, 0, 0);
  for (const z of GZ) { pushPoly(o, [[-7.7, 5.4, z], [-4.4, 5.4, z]], 1.6, 0, 0); pushPoly(o, [[4.4, 5.4, z], [7.7, 5.4, z]], 1.6, 0, 0); pushPoly(o, [[-4.4, 6, z], [4.4, 6, z]], 1.6, 0, 0); }
  for (const x of GX) for (const y of [0.42, 2.7, top(x)]) pushPoly(o, [[x, y, 0], [x, y, -6]], 1.2, 0, 0);
  // pediment truss and ridge
  for (const z of [0, -6]) { pushPoly(o, [[-4.4, 6, z], [0, 7.7, z], [4.4, 6, z]], 1.6, 0, 0); pushPoly(o, [[0, 6, z], [0, 7.7, z]], 1.2, 0, 0); }
  pushPoly(o, [[0, 7.7, 0], [0, 7.7, -6]], 1.4, 0, 0);
  // dome: ring and arches
  const cz = -3.6, R = 1.65, ry = 8.0;
  const ring: V3[] = [];
  for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2; ring.push([Math.cos(a) * R, ry, cz + Math.sin(a) * R]); }
  pushPoly(o, ring, 1.6, 0, 0);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, p: V3[] = [];
    for (let i = 0; i <= 12; i++) { const u = (i / 12) * (Math.PI / 2); p.push([Math.cos(a) * R * Math.cos(u), ry + R * Math.sin(u), cz + Math.sin(a) * R * Math.cos(u)]); }
    pushPoly(o, p, 1.2, 0, 0);
  }
  for (const [x, z] of [[-R, cz], [R, cz], [0, cz - R], [0, cz + R]] as const) pushPoly(o, [[x, 6, z], [x, ry, z]], 1.4, 0, 0);
  // bracing in the end bays
  for (const z of [0, -6]) for (const [a, b] of [[-7.7, -6.05], [6.05, 7.7]]) { pushPoly(o, [[a, 0.42, z], [b, 2.7, z]], 1, 0, 0); pushPoly(o, [[b, 0.42, z], [a, 2.7, z]], 1, 0, 0); }
  return o;
})();

// ------------------------------------------------------------------ the nave
/** pointed arch from p to q (springing at their own heights), apex `rise` above the higher springing */
export function pointed(p: V3, q: V3, rise: number, n = 12): V3[] {
  const pts: V3[] = [];
  const y0 = Math.max(p[1], q[1]);
  for (let i = 0; i <= 2 * n; i++) {
    const u = i / (2 * n);
    // two circular arcs meeting at the apex: for the left half angle goes 180°→120° about the far springing
    const half = u <= 0.5;
    const v = half ? u * 2 : (1 - u) * 2; // 0 at springing, 1 at apex
    const a = Math.PI - (Math.PI / 3) * v; // 180 -> 120
    const xx = 1 + Math.cos(a); // 0 -> 0.5 (fraction of span from this springing)
    const yy = Math.sin(a) / Math.sin(Math.PI / 3); // 0 -> 1
    const f = half ? xx : 1 - xx;
    pts.push([p[0] + (q[0] - p[0]) * f, (half ? p[1] : q[1]) + (y0 - (half ? p[1] : q[1])) * yy + rise * yy, p[2] + (q[2] - p[2]) * f]);
  }
  return pts;
}

export const NAVE_BAYS = 8, BAY = 5, NW = 5, AW = 10, PIER_H = 11, CLER_H = 19, VAULT_RISE = 7, AISLE_H = 8;
export const NAVE: Seg3[] = (() => {
  const o: Seg3[] = [];
  const zs = Array.from({ length: NAVE_BAYS + 1 }, (_, i) => -i * BAY);
  let ord = 0;
  // stage 0: piers (clustered: four shafts) and aisle wall piers, bay by bay from the entrance
  zs.forEach((z, i) => {
    for (const s of [-1, 1]) {
      for (const [dx, dz] of [[-0.35, 0], [0.35, 0], [0, -0.35], [0, 0.35]] as const) pushPoly(o, [[s * NW + dx, 0, z + dz], [s * NW + dx, CLER_H, z + dz]], 1.2, 0, i * 2);
      pushPoly(o, [[s * AW, 0, z], [s * AW, AISLE_H, z]], 1.4, 0, i * 2 + 1);
      // buttress pier
      pushPoly(o, [[s * (AW + 4), 0, z], [s * (AW + 4), AISLE_H + 6, z]], 1.6, 0, i * 2 + 1);
    }
  });
  ord = 100;
  // stage 1: arcades along the nave (arches at PIER_H between piers), aisle arcades, aisle wall plates
  for (let i = 0; i < NAVE_BAYS; i++) {
    for (const s of [-1, 1]) {
      pushPoly(o, pointed([s * NW, PIER_H - 3, zs[i]!], [s * NW, PIER_H - 3, zs[i + 1]!], 3), 1.6, 1, ord + i);
      pushPoly(o, pointed([s * NW, CLER_H - 3, zs[i]!], [s * NW, CLER_H - 3, zs[i + 1]!], 2.2), 1.2, 1, ord + i); // clerestory windows
      pushPoly(o, [[s * NW, PIER_H, zs[i]!], [s * NW, PIER_H, zs[i + 1]!]], 1, 1, ord + i);
      pushPoly(o, pointed([s * AW, AISLE_H - 2.5, zs[i]!], [s * AW, AISLE_H - 2.5, zs[i + 1]!], 2.5), 1.2, 1, ord + i);
      // aisle transverse arches
      pushPoly(o, pointed([s * NW, AISLE_H - 2, zs[i]!], [s * AW, AISLE_H - 2, zs[i]!], 2), 1.2, 1, ord + i);
    }
  }
  ord = 200;
  // stage 2: nave vault: transverse arches, diagonal ribs, ridge
  for (let i = 0; i <= NAVE_BAYS; i++) pushPoly(o, pointed([-NW, CLER_H, zs[i]!], [NW, CLER_H, zs[i]!], VAULT_RISE - 2), 1.8, 2, ord + i);
  for (let i = 0; i < NAVE_BAYS; i++) {
    const zc = (zs[i]! + zs[i + 1]!) / 2;
    const apex: V3 = [0, CLER_H + VAULT_RISE, zc];
    for (const [x, z] of [[-NW, zs[i]!], [NW, zs[i]!], [-NW, zs[i + 1]!], [NW, zs[i + 1]!]] as const) {
      const p: V3[] = [];
      for (let k = 0; k <= 14; k++) { const u = k / 14; p.push([x + (0 - x) * u, CLER_H + VAULT_RISE * Math.sin((u * Math.PI) / 2), z + (zc - z) * u]); }
      pushPoly(o, p, 1.4, 2, ord + i + 0.5);
    }
    pushPoly(o, [[0, CLER_H + VAULT_RISE - 2 + 2, zs[i]!], apex, [0, CLER_H + VAULT_RISE, zs[i + 1]!]], 1, 2, ord + i + 0.6);
  }
  ord = 300;
  // stage 3: flying buttresses and pinnacles
  zs.forEach((z, i) => {
    for (const s of [-1, 1]) {
      const p: V3[] = [];
      for (let k = 0; k <= 12; k++) { const u = k / 12; p.push([s * (AW + 4 - (AW + 4 - NW - 0.5) * u), AISLE_H + 6 + (CLER_H - 2 - AISLE_H - 6) * u + 3 * Math.sin(u * Math.PI), z]); }
      pushPoly(o, p, 1.4, 3, ord + i);
      pushPoly(o, [[s * (AW + 4), AISLE_H + 6, z], [s * (AW + 4), AISLE_H + 9.5, z]], 1.2, 3, ord + i);
    }
  });
  // stage 3: apse (half ring of piers and ribs to a boss) and the west rose
  const zA = zs[NAVE_BAYS]!;
  const boss: V3 = [0, CLER_H + VAULT_RISE, zA - 3];
  for (let k = 0; k <= 6; k++) {
    const a = Math.PI + (k / 6) * Math.PI;
    const px = Math.cos(a) * NW, pz = zA + Math.sin(a) * NW * 1.2;
    pushPoly(o, [[px, 0, pz], [px, CLER_H, pz]], 1.4, 3, ord + 20 + k);
    const p: V3[] = [];
    for (let j = 0; j <= 12; j++) { const u = j / 12; p.push([px + (boss[0] - px) * u, CLER_H + VAULT_RISE * Math.sin((u * Math.PI) / 2), pz + (boss[2] - pz) * u]); }
    pushPoly(o, p, 1.2, 3, ord + 20 + k);
  }
  const rose: V3[] = [];
  const rc: V3 = [0, CLER_H - 1, 0.2], rr = 3.2;
  for (let k = 0; k <= 48; k++) { const a = (k / 48) * Math.PI * 2; rose.push([rc[0] + Math.cos(a) * rr, rc[1] + Math.sin(a) * rr, rc[2]]); }
  pushPoly(o, rose, 1.4, 3, ord + 30);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; pushPoly(o, [[rc[0] + Math.cos(a) * 0.8, rc[1] + Math.sin(a) * 0.8, rc[2]], [rc[0] + Math.cos(a) * rr, rc[1] + Math.sin(a) * rr, rc[2]]], 1, 3, ord + 30); }
  // floor: the setting-out lines (stage 0, drawn first)
  pushPoly(o, [[0, 0, 4], [0, 0, zA - 6]], 1, -1, 0);
  for (const s of [-1, 1]) pushPoly(o, [[s * NW, 0, 2], [s * NW, 0, zA]], 0.8, -1, 0);
  return o;
})();
export const NAVE_MEMBERS = (() => { const s = new Set<number>(); for (const x of NAVE) s.add(x.m); return s.size; })();

// ------------------------------------------------------------------ cameras
export function makeCam(fov = 40) { return new THREE.PerspectiveCamera(fov, W / H, 0.1, 500); }
export function aim(cam: THREE.PerspectiveCamera, eye: V3, target: V3, roll = 0) {
  cam.position.set(eye[0], eye[1], eye[2]);
  cam.up.set(Math.sin(roll), Math.cos(roll), 0);
  cam.lookAt(target[0], target[1], target[2]);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
}
/** depth fog factor for a segment midpoint (1 near, ->0 far) */
export function fog(cam: THREE.Camera, p: V3, q: V3, near: number, far: number) {
  const dx = (p[0] + q[0]) / 2 - cam.position.x, dy = (p[1] + q[1]) / 2 - cam.position.y, dz = (p[2] + q[2]) / 2 - cam.position.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Math.max(0, Math.min(1, 1 - (d - near) / (far - near)));
}
export const rnd = (i: number, s = 3) => hash(i, s);
/** project a world point to screen px (for 2D labels) */
export function project(cam: THREE.Camera, p: V3): [number, number, boolean] {
  const v = new THREE.Vector3(p[0], p[1], p[2]).project(cam);
  return [(v.x * 0.5 + 0.5) * W, (1 - (v.y * 0.5 + 0.5)) * H, v.z < 1];
}

// ------------------------------------------------------------------ the build schedule
/** Build groups (members sharing stage+order rise together), in build order. */
export const NAVE_GROUPS: Seg3[][] = (() => {
  const m = new Map<string, Seg3[]>();
  for (const s of NAVE) { const k = `${s.stage}|${s.order}`; if (!m.has(k)) m.set(k, []); m.get(k)!.push(s); }
  return [...m.entries()].sort((a, b) => { const [sa, oa] = a[0].split('|').map(Number); const [sb, ob] = b[0].split('|').map(Number); return sa! - sb! || oa! - ob!; }).map((e) => e[1]);
})();
const schedCache = new WeakMap<AudioData, number[]>();
/**
 * When each build group rises: one per beat through chorus 3 (from its first beat to the bridge), the rest one
 * every 1.5 beats from the final chorus on.
 */
export function buildTimes(au: AudioData): number[] {
  let s = schedCache.get(au);
  if (s) return s;
  s = [];
  const c3 = au.sections.find((x) => x.name === 'chorus3')!, br = au.sections.find((x) => x.name === 'bridge')!;
  const fin = au.sections.find((x) => x.name === 'final')!;
  let b = Math.ceil(au.beatAt(c3.start - 0.01));
  while (s.length < NAVE_GROUPS.length && au.timeOfBeat(b) < br.start - 0.3) { s.push(au.timeOfBeat(b)); b++; }
  let bf = Math.ceil(au.beatAt(fin.start - 0.01));
  while (s.length < NAVE_GROUPS.length) { s.push(au.timeOfBeat(bf)); bf += 1.5; }
  schedCache.set(au, s);
  return s;
}
/** Draw the nave as built at t into a 3D LineBatch: each group draws on over `rise` s with a hot tip. */
export function drawNave(lb: LineBatch, cam: THREE.Camera, au: AudioData, t: number, o: { rise?: number; bone: V3; hot: V3; near?: number; far?: number; alpha?: number; all?: boolean }) {
  const T = buildTimes(au);
  const rise = o.rise ?? 0.35;
  let built = 0;
  NAVE_GROUPS.forEach((g, gi) => {
    const t0 = o.all ? -1e9 : T[gi]!;
    if (t < t0) return;
    built++;
    const k = Math.min(1, (t - t0) / rise);
    const heat = Math.max(0, 1 - (t - t0) / 1.2);
    // segments of each member in order: draw the first k of them
    const byM = new Map<number, Seg3[]>();
    for (const s of g) { if (!byM.has(s.m)) byM.set(s.m, []); byM.get(s.m)!.push(s); }
    for (const segs of byM.values()) {
      const n = segs.length, upto = k * n;
      for (let i = 0; i < n; i++) {
        if (i >= upto) break;
        const s = segs[i]!;
        const f = Math.min(1, upto - i);
        const b: V3 = [s.a[0] + (s.b[0] - s.a[0]) * f, s.a[1] + (s.b[1] - s.a[1]) * f, s.a[2] + (s.b[2] - s.a[2]) * f];
        const fo = fog(cam, s.a, b, o.near ?? 12, o.far ?? 80);
        const al = (0.15 + 0.85 * fo) * (o.alpha ?? 1);
        const c: V3 = [o.bone[0] + (o.hot[0] - o.bone[0]) * heat, o.bone[1] + (o.hot[1] - o.bone[1]) * heat, o.bone[2] + (o.hot[2] - o.bone[2]) * heat];
        lb.seg(s.a[0], s.a[1], s.a[2], b[0], b[1], b[2], s.w, c[0], c[1], c[2], al);
      }
    }
  });
  return built;
}
