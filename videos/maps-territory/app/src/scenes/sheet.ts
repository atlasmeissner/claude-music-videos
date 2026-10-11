// sheet — intro, the last eight bars before the voice.
// A fresh sheet of paper. A plotter draws the empty map, a bar or two per element: the neatline and its
// graticule, the coast and the lake printed in, the compass star, the scale bar, the legend; then it writes the
// title, "The Plan", and parks on HOME, ready for the first line.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { rgba } from '../engine/palette';
import { clamp, ease, prog } from '../engine/util';
import { PLAN, WORLD } from './_world';
import { mono, placeMark, Terrain, w2s } from './_mt';
import { drawFurniture, penCross, SHEET_VIEW } from './_sheet';

export default class Sheet extends Scene {
  terrain = new Terrain();
  text = new Layer2D();
  bar = 1.72;

  override init() { const d = this.ctx.audio.downbeats; const i = d.findIndex((x) => x >= this.ctx.start - 0.01); this.bar = d[i + 1]! - d[i]!; }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, B = this.bar;
    const b = (n: number) => t0 + n * B;
    const v = SHEET_VIEW;
    const k = {
      frame: prog(t, b(0.1), b(2.6), ease.inOutSine),
      star: prog(t, b(2.7), b(3.4), ease.outCubic),
      scale: prog(t, b(3.3), b(4.0), ease.inOutCubic),
      legend: prog(t, b(4.0), b(5.4), ease.linear),
      title: prog(t, b(5.4), b(7.2), ease.inOutSine),
    };
    const coast = prog(t, b(1.2), b(3.2), ease.inOutCubic);
    this.terrain.draw(renderer, out, { view: v, mapMix: 1, contourInk: 0, paperInk: coast, t });
    const T = this.text, c = T.ctx; T.clear();
    let pen = drawFurniture(c, v, k);
    // the frame's pen position while it is being drawn
    if (k.frame > 0 && k.frame < 1) {
      const kk = clamp(k.frame / 0.8);
      const cs = [w2s(v, 0, 0), w2s(v, WORLD, 0), w2s(v, WORLD, WORLD), w2s(v, 0, WORLD)];
      const seg = Math.min(3, Math.floor(kk * 4)), u = kk * 4 - seg;
      const p = cs[seg]!, q = cs[(seg + 1) % 4]!;
      pen = { x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u };
    }
    if (!pen && k.star > 0 && k.star < 1) pen = { x: 1520, y: 215 };
    if (!pen && k.legend > 0 && k.legend < 1) pen = { x: 120 + 40 * (k.legend * 4 % 1), y: 802 + Math.floor(k.legend * 4) * 34 };
    // HOME: the last bar marks the start of the road
    const home = PLAN[0]!, hp = w2s(v, home.x, home.y);
    const hk = prog(t, b(7.25), b(7.6), ease.outCubic);
    placeMark(c, hp.x, hp.y, 9, rgba('ink', 0.9), hk);
    if (hk > 0) { c.save(); c.globalAlpha = hk; mono(c, 'HOME', hp.x + 16, hp.y - 12, { size: 13, color: rgba('ink', 0.95), track: 3, weight: 600 }); c.restore(); }
    if (!pen && t > b(7.2)) pen = { x: hp.x, y: hp.y };
    if (pen) penCross(c, pen.x, pen.y, prog(t, t0, b(0.4)));
    // paper margin notes
    c.globalAlpha = prog(t, b(0.5), b(1.5));
    mono(c, 'SURVEYED  NO', 1610, 1010, { size: 11, color: rgba('ink', 0.55), track: 3, align: 'right' });
    mono(c, 'DRAWN  FROM IMAGINATION', 750, 1010, { size: 11, color: rgba('ink', 0.55), track: 3 });
    c.globalAlpha = 1;
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.15, vignette: 0.22, ca: 0.25, halation: 0, paper: 1, fade: 1 - prog(t, t0, t0 + 0.35) };
  }
}
