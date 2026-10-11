// return — the outro: the horn comes back alone, then the band and the wordless "oh".
// Night again, and the picture from the album cover: standing out at sea, looking west at the country. The
// mountains on the horizon are ridgelines, the sea is water lines, and the gold track is drawn across the land to
// the islet in front of us. Over the mountains the compass star rises with the horn, a column of its light on
// the water.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, frameIdx, lerp, prog } from '../engine/util';
import { ISLET, track } from './_world';
import { compassStar, lamp, mixRGB, mono, sc } from './_mt';
import { HORIZON, ridgeLinesDir, SKY_FRAG } from './vista';

export default class Return extends Scene {
  sky = new FSPass(SKY_FRAG, { horizon: { value: HORIZON }, tw: { value: 0 }, warmth: { value: 0 }, stars: { value: 1 } });
  ridges = new LineBatch(40000, { blend: 'normal' });
  lb = new LineBatch(6000);
  text = new Layer2D();
  tBand = 0;

  override init() { this.tBand = this.ctx.audio.downbeats.find((d) => d > this.ctx.start + 6)!; }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const k = prog(t, t0, t1, ease.inOutSine);
    this.sky.u.tw!.value = frameIdx(t) / 8;
    this.sky.u.warmth!.value = 0.12;
    this.sky.u.stars!.value = 1;
    this.sky.render(renderer, out);
    // the star: rises with the horn over the mountains
    const horn = audio.env('other', t);
    const rise = prog(t, t0 + 0.3, this.tBand + 1.5, ease.outCubic);
    const sx = 960, sy = lerp(HORIZON - 20, 190, rise);
    const lb = this.lb; lb.clear();
    // its column of light on the water
    for (let i = 0; i < 70; i++) {
      const y = HORIZON + 6 + i * 9, w = 40 + i * 5 + 30 * Math.sin(i * 1.7 + t * 2);
      const a = (0.25 + 0.2 * horn) * (1 - i / 70) * rise;
      lb.seg2(sx - w / 2, y, sx + w / 2, y, 1.4, sc(LIN.ember, 0.9), a);
    }
    // looking west from out at sea, drifting slowly in toward the islet
    const camX = lerp(ISLET.x + 9, ISLET.x + 5.5, k), camY = ISLET.y + lerp(0.6, -0.4, k);
    const yaw = Math.PI + lerp(0.06, -0.04, k);
    const R = this.ridges; R.clear();
    const proj = ridgeLinesDir(R, camX, camY, yaw, {
      rows: 120, dz: 0.75, z0: 0.6,
      col: (fade, land) => land ? [LIN.bone, 0.1 + 0.6 * fade * fade] : [mixRGB(LIN.acid, LIN.bone, 0.3), 0.04 + 0.28 * fade * fade],
    });
    R.render(renderer, out);
    // the track across the land, gold, as on the cover
    const T = track();
    let prev: { x: number; y: number; z: number } | null = null;
    const draw = prog(t, t0 + 1, this.tBand + 4, ease.inOutSine);
    const nMax = Math.floor(T.pts.length * draw);
    for (let i = T.pts.length - 1; i >= T.pts.length - nMax; i--) {
      const p = T.pts[i]!;
      const q = proj(p.x, p.y, 0);
      if (q && prev) lb.seg2(prev.x, prev.y, q.x, q.y, 1.2 + 4 / q.z, sc(LIN.signal, 1.2 + 1.5 / q.z), 0.9);
      prev = q;
    }
    const isl = proj(T.pts[T.pts.length - 1]!.x, T.pts[T.pts.length - 1]!.y, 0.05);
    if (isl) lamp(lb, isl.x, isl.y, t, 1.4, 1);
    lb.render(renderer, out);
    const L = this.text, c = L.ctx; L.clear();
    compassStar(c, sx, sy, 34 + 10 * horn, { col: rgba('ember', 0.9), fill: rgba('ember', 1), lw: 1, alpha: rise, minor: true });
    c.globalAlpha = prog(t, t0 + 1.5, t0 + 3) * (1 - prog(t, t1 - 1, t1));
    mono(c, 'LOOKING BACK  ·  FACING WEST  ·  FROM THE ISLET’S WATER', 960, 1010, { size: 12, color: rgba('bone', 0.6), track: 4, align: 'center' });
    c.globalAlpha = 1;
    comp.draw(renderer, L.upload(), out);
    void clamp;
    return { bloom: 0.8, vignette: 0.55, ca: 0.5, halation: 0.35, fade: 1 - prog(t, t0, t0 + 0.8) };
  }
}
