// coda — the outro to silence.
// Straight down over the islet at night, the lamp on it; the camera pulls back over the whole walk while the
// country darkens to its contour lines, as it was in the first frame when only the horn's call lit it. The sheet's
// frame comes back around it, very faint. When the horn plays alone for the last time everything goes but the
// lamp and the title; then the lamp too, into vast silence.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { rgba } from '../engine/palette';
import { ease, lerp, prog } from '../engine/util';
import { ISLET, track } from './_world';
import { drawTrack, lamp, lerpView, mono, neatline, Terrain, w2s } from './_mt';

export default class Coda extends Scene {
  terrain = new Terrain();
  lb = new LineBatch(4000);
  text = new Layer2D();
  tHorn = 0;

  override init() {
    // the last horn: the band drops out ten bars before the end (the analysis shows drums gone from here)
    const d = this.ctx.audio.downbeats;
    this.tHorn = d.find((x) => x > this.ctx.end - 8.5) ?? this.ctx.end - 7.8;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const k = prog(t, t0, this.tHorn, ease.inOutSine);
    const v = lerpView({ cx: ISLET.x - 2, cy: ISLET.y, s: 40, rot: 0.08 }, { cx: 50, cy: 50, s: 9.2, rot: 0 }, k);
    const dark = prog(t, t0 + 3, this.tHorn, ease.inOutSine);
    const end = prog(t, this.tHorn, this.tHorn + 2.5, ease.inOutSine);
    this.terrain.draw(renderer, out, { view: v, terrInk: 0.4 * (1 - dark), relief: 3.2, t, ghost: dark, contour: 0.05, fadeOut: 0.15 + 0.6 * dark + 0.25 * end, sun: [-0.5, -0.6, 0.5] });
    const lb = this.lb; lb.clear();
    const T = track();
    drawTrack(lb, v, T.total, t, { width: 2.2, head: 0, I: 1 - end });
    const p = T.pts[T.pts.length - 1]!, q = w2s(v, p.x, p.y);
    const horn = audio.env('other', t);
    const out1 = prog(t, t1 - 2.4, t1 - 0.2, ease.inOutSine);
    lamp(lb, q.x, q.y, t, 1 + 0.5 * horn * end, (1 - out1) * (0.9 + 0.5 * horn * end));
    lb.render(renderer, out);
    const L = this.text, c = L.ctx; L.clear();
    neatline(c, v, rgba('bone', 0.35 * dark * (1 - end)), { k: dark, step: 10, labels: false });
    // the title, for the last horn
    const ta = prog(t, this.tHorn + 0.8, this.tHorn + 2.4, ease.outCubic) * (1 - prog(t, t1 - 2.6, t1 - 0.8));
    if (ta > 0) {
      const title = 'MAPS & TERRITORY';
      const fam = F.archivo(125, 300), size = 64, tr = 22;
      c.save(); c.globalAlpha = ta;
      c.font = font(fam, size); c.letterSpacing = `${tr}px`; c.fillStyle = rgba('bone', 0.95); c.textBaseline = 'alphabetic';
      const w = measure(title, fam, size, tr);
      c.fillText(title, 960 - w / 2 + tr / 2, 300);
      mono(c, 'JOBURGALEX', 960, 352, { size: 16, color: rgba('signal', 1), track: 12, align: 'center', weight: 500 });
      c.restore();
    }
    void lerp;
    comp.draw(renderer, L.upload(), out);
    return { bloom: 0.7, vignette: 0.55, ca: 0.45, halation: 0.3, fade: prog(t, t1 - 0.9, t1 - 0.05) };
  }
}
