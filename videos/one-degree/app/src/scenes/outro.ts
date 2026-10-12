// outro — the island, alive, small on its needle above the title card; then dark.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { ease, prog } from '../engine/util';
import { mono } from './_od';
import { View, drawAxes, drawIsland, spreadAt } from './_island';

export default class Outro extends Scene {
  lb = new LineBatch(90000, { blend: 'normal' });
  lbTop = new LineBatch(400);
  view = new View();
  text = new Layer2D();

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t, s = this.ctx.start, e = this.ctx.end;
    const keep = 1 - prog(t, e - 3.2, e - 0.6, ease.inOutCubic);
    const v = this.view;
    v.set(1, { ax: W / 2, ay: 300, fx: 0, fy: 0, zoom: 0.46 + 0.02 * prog(t, s, e) });
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    drawIsland(lb, v, { t, S: spreadAt(lyrics, t), tilt: 1, night: 0.35, surge: [], alpha: keep * prog(t, s - 0.01, s + 0.6) });
    lb.render(renderer, out);
    const top = this.lbTop; top.clear();
    drawAxes(top, v, t, { alpha: keep, needleTo: 640 });
    top.render(renderer, out);
    const T = this.text, c = T.ctx; T.clear();
    const a = prog(t, s + 0.8, s + 2.2, ease.outCubic) * keep;
    c.save(); c.globalAlpha = a;
    c.font = font(F.archivo(125, 900), 120); c.letterSpacing = '-3px'; c.textAlign = 'center'; c.fillStyle = rgba('bone', 1);
    c.fillText('ONE DEGREE', W / 2, 780);
    c.restore();
    const b = prog(t, s + 1.8, s + 3, ease.outCubic) * keep;
    c.save(); c.globalAlpha = b;
    mono(c, 'JOBURGALEX', W / 2, 836, { size: 16, color: rgba('bone', 0.9), track: 8, align: 'center', weight: 500 });
    mono(c, 'ONE DEGREE, ONCE', W / 2, 880, { size: 12, color: rgba('signal', 1), track: 5, align: 'center' });
    mono(c, 'MUSIC MADE WITH SUNO · VIDEO RENDERED IN CODE', W / 2, 960, { size: 11, color: rgba('ash', 0.6), track: 4, align: 'center' });
    c.restore();
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.55, ca: 0.35, vignette: 0.45, roll: 0, fade: prog(t, e - 1.2, e, ease.inQuad) };
  }
}
