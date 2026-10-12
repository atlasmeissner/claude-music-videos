// The camera: keyframes through world space. Zoom interpolates in log space so pull-backs over
// several orders of magnitude feel even. A key's ease shapes the segment that ends at that key.
import { type Cam } from './draw';
import { clamp, ease, noise1 } from './util';

export type Ease = (u: number) => number;
export interface CamKey { t: number; x: number; y: number; z: number; r?: number; e?: Ease }

export function camAt(keys: CamKey[], t: number): Cam {
  if (t <= keys[0]!.t) return { x: keys[0]!.x, y: keys[0]!.y, z: keys[0]!.z, r: keys[0]!.r ?? 0 };
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!;
    if (t < k.t) {
      const p = keys[i - 1]!;
      const u = (k.e ?? ease.inOutCubic)(clamp((t - p.t) / Math.max(1e-6, k.t - p.t)));
      // position follows the zoom so that zooming toward a point keeps it steady on screen:
      // interpolate the screen-space offset (x * z) linearly in log zoom.
      const lz = Math.log(p.z) + (Math.log(k.z) - Math.log(p.z)) * u;
      const z = Math.exp(lz);
      let x: number, y: number;
      const dz = Math.abs(Math.log(k.z / p.z));
      if (dz > 0.05) {
        // world point under the screen centre moves so the transition looks like a dolly toward
        // the target: weight by how far the zoom has progressed (in log space)
        const w = (lz - Math.log(p.z)) / (Math.log(k.z) - Math.log(p.z));
        x = p.x + (k.x - p.x) * w;
        y = p.y + (k.y - p.y) * w;
      } else {
        x = p.x + (k.x - p.x) * u;
        y = p.y + (k.y - p.y) * u;
      }
      const r = (p.r ?? 0) + ((k.r ?? 0) - (p.r ?? 0)) * u;
      return { x, y, z, r };
    }
  }
  const l = keys[keys.length - 1]!;
  return { x: l.x, y: l.y, z: l.z, r: l.r ?? 0 };
}

/** Camera shake (screen pixels) after impacts at the given times. */
export function shake(t: number, hits: { t: number; amp: number; hl?: number }[]) {
  let dx = 0, dy = 0, dr = 0;
  for (const h of hits) {
    if (t < h.t || t > h.t + 2) continue;
    const k = h.amp * Math.pow(0.5, (t - h.t) / (h.hl ?? 0.08));
    dx += noise1((t - h.t) * 38, h.t * 13) * k;
    dy += noise1((t - h.t) * 41, h.t * 7 + 3) * k;
    dr += noise1((t - h.t) * 23, h.t * 5 + 9) * k * 0.0006;
  }
  return { dx, dy, dr };
}
