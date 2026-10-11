// outro — the needle alone, upright, and the title card; then dark.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { ease, prog } from '../engine/util';
import { heading, mono, needle, pivot, rad } from './_od';

export default class Outro extends Scene {
  lb = new LineBatch(400);
  text = new Layer2D();

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t, s = this.ctx.start, e = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const keep = 1 - prog(t, e - 3.2, e - 0.6, ease.inOutCubic);
    pivot(lb, 960, 540, 8, LIN.bone, 0.9 * keep);
    needle(lb, 960, 540, rad(-90), 410, t, { width: 1.6, tail: 30, tip: keep });
    lb.render(renderer, out);
    const T = this.text, c = T.ctx; T.clear();
    const a = prog(t, s + 0.8, s + 2.2, ease.outCubic) * keep;
    c.save(); c.globalAlpha = a;
    c.font = font(F.archivo(125, 900), 120); c.letterSpacing = '-3px'; c.textAlign = 'center'; c.fillStyle = rgba('bone', 1);
    c.fillText('ONE DEGREE', W / 2, 760);
    c.restore();
    const b = prog(t, s + 1.8, s + 3, ease.outCubic) * keep;
    c.save(); c.globalAlpha = b;
    mono(c, 'JOBURGALEX', W / 2, 820, { size: 16, color: rgba('bone', 0.9), track: 8, align: 'center', weight: 500 });
    mono(c, `${heading(lyrics, t).toFixed(0)} DEGREES · ONE AT A TIME`, W / 2, 868, { size: 12, color: rgba('signal', 1), track: 5, align: 'center' });
    mono(c, 'MUSIC MADE WITH SUNO · VIDEO RENDERED IN CODE', W / 2, 960, { size: 11, color: rgba('ash', 0.6), track: 4, align: 'center' });
    c.restore();
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.6, ca: 0.4, vignette: 0.45, roll: 0, fade: prog(t, e - 1.2, e, ease.inQuad) };
  }
}
