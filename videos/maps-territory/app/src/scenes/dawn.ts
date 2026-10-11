// dawn — the instrumental, the drop and the build back into the last chorus.
//  A (the drop, drums out): the islet at night, the lamp on it, the sea teal, waves coming in. BEFORE DAWN.
//  B (the build): the ridgeline panorama of `vista` again, seen from the sea looking west at the country; the sky
//    warms bar by bar, the ridges nearest the light turn gold, the sun's glow climbs behind the viewer's shoulder.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, frameIdx, lerp, prog } from '../engine/util';
import { ISLET, track } from './_world';
import { lamp, lerpView, mixRGB, mono, sc, Terrain, w2s } from './_mt';
import { HORIZON, ridgeLinesDir, SKY_FRAG } from './vista';

export default class Dawn extends Scene {
  terrain = new Terrain();
  sky = new FSPass(SKY_FRAG, { horizon: { value: HORIZON }, tw: { value: 0 }, warmth: { value: 0 }, stars: { value: 1 } });
  ridges = new LineBatch(40000, { blend: 'normal' });
  lb = new LineBatch(4000);
  text = new Layer2D();
  tB = 0;

  override init() {
    const d = this.ctx.audio.downbeats;
    // the drums return three bars after the drop
    this.tB = d.find((x) => x > this.ctx.start + 4.5)!;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const L = this.text, c = L.ctx; L.clear();
    const lb = this.lb; lb.clear();
    if (t < this.tB) {
      // ---- A: the islet before dawn
      const v = lerpView({ cx: ISLET.x - 1.5, cy: ISLET.y, s: 44, rot: 0.1 }, { cx: ISLET.x - 0.8, cy: ISLET.y, s: 56, rot: 0.05 }, prog(t, t0, this.tB, ease.inOutSine));
      this.terrain.draw(renderer, out, { view: v, seaAcid: 1, terrInk: 0.4, relief: 3, t, warmth: 0.08 * prog(t, t0, this.tB), sun: [0.7, -0.2, 0.3] });
      const q = w2s(v, track().pts[track().pts.length - 1]!.x, track().pts[track().pts.length - 1]!.y);
      lamp(lb, q.x, q.y, t, 1.2, 1);
      lb.render(renderer, out);
      c.globalAlpha = prog(t, t0 + 0.3, t0 + 1.2) * (1 - prog(t, this.tB - 0.5, this.tB));
      mono(c, 'BEFORE DAWN', 120, 150, { size: 13, color: rgba('acid', 1), track: 6, weight: 600 });
      mono(c, 'THE ISLET  ·  NOT ON ANY SHEET  ·  WAITING FOR THE LIGHT', 120, 176, { size: 12, color: rgba('bone', 0.7), track: 3 });
      c.globalAlpha = 1;
      comp.draw(renderer, L.upload(), out);
      return { bloom: 0.6, vignette: 0.55, ca: 0.5, halation: 0.25 };
    }
    // ---- B: the panorama at sunrise, looking west from the sea
    const k = prog(t, this.tB, t1, ease.inOutSine);
    const warm = prog(t, this.tB, t1 - 1, ease.inOutSine);
    this.sky.u.tw!.value = frameIdx(t) / 8;
    this.sky.u.warmth!.value = warm;
    this.sky.u.stars!.value = 1 - warm * 0.9;
    this.sky.render(renderer, out);
    const camX = lerp(ISLET.x + 6, ISLET.x + 1.5, k), camY = ISLET.y + lerp(1.5, -1, k);
    const yaw = Math.PI + lerp(-0.18, 0.12, k);
    const R = this.ridges; R.clear();
    const proj = ridgeLinesDir(R, camX, camY, yaw, {
      rows: 110, dz: 0.75, z0: 0.6,
      col: (fade, land) => {
        if (!land) return [mixRGB(LIN.acid, LIN.ember, warm * 0.6), (0.05 + 0.35 * fade * fade) * (0.6 + 0.4 * warm)];
        const base = mixRGB(LIN.bone, sc(LIN.ember, 1.05), clamp(warm * (0.4 + 0.8 * (1 - fade))));
        return [base, 0.1 + 0.62 * fade * fade];
      },
    });
    R.render(renderer, out);
    // the track, drawn onto the country in perspective (gold)
    const T = track();
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i < T.pts.length; i += 2) {
      const p = T.pts[i]!;
      const q = proj(p.x, p.y, 0);
      if (q && prev && q.z < 60) lb.seg2(prev.x, prev.y, q.x, q.y, 1.4 + 3 / q.z, sc(LIN.signal, 1.3), 0.85);
      prev = q;
    }
    const isl = proj(T.pts[T.pts.length - 1]!.x, T.pts[T.pts.length - 1]!.y, 0.05);
    if (isl) lamp(lb, isl.x, isl.y, t, 1.2, 1);
    lb.render(renderer, out);
    // the time, deadpan
    const mins = Math.floor(lerp(4 * 60 + 58, 5 * 60 + 41, k));
    c.globalAlpha = prog(t, this.tB, this.tB + 1) * (1 - prog(t, t1 - 1.2, t1 - 0.3));
    mono(c, `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}  ·  FACING WEST  ·  THE SUN BEHIND YOU`, 960, 1000, { size: 12, color: rgba('bone', 0.65), track: 4, align: 'center' });
    c.globalAlpha = 1;
    void font; void F; void measure;
    comp.draw(renderer, L.upload(), out);
    return { bloom: 0.6 + 0.2 * warm, vignette: 0.45, ca: 0.45, halation: 0.25 + 0.15 * warm };
  }
}
