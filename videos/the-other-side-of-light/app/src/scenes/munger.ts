// MUNGER — the instrumental break between chorus 1 and verse 2.
// Back in the dark. Charlie Munger's version of the maxim is typed out in the machine voice, under an
// engraving of the man; on the last beat the lamp marks "there" on the atlas with a cross: noted, avoided.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { ease, prog, clamp, lerp, frameIdx } from '../engine/util';
import { sparkHead } from './_motifs';
import { PlateDrawer, loadImages, caption, LIN, rgba, W, H, kc, LOOK, xMark } from './_kit';

const IMG = 'bc3176b9';
const Q = ['“All I want to know is where', 'I’m going to die, so I’ll', 'never go there.”'];

export default class Munger extends Scene {
  L = new Layer2D();
  plates = new PlateDrawer();
  lb = new LineBatch(1000, { blend: 'add' });
  override async init() { await loadImages([IMG]); }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, dur = f.end - f.start;
    clearRT(renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear(); this.lb.clear();
    const k = prog(t, f.start, f.start + 0.6, ease.outCubic);
    this.plates.draw(renderer, out, IMG, { x: 1100, y: 140, w: 700, h: 800, zoom: 1.15 + (t - f.start) * 0.02, panX: -0.2, ...LOOK.photo, freq: 0.24, light: kc(0.6, LIN.bone), alpha: k, reveal: 'wipe', rp: k * 1.1, rdir: Math.PI / 2, rsoft: 0.2 });
    caption(c, IMG, 1100, 980, { size: 11, short: true });
    // typed quote
    const total = Q.join('').length;
    const typed = Math.floor(prog(t, f.start + 0.3, f.start + dur * 0.72) * total);
    c.font = font(F.mono(400), 40);
    let n = typed, y = 420, cx = 120, cy = 420;
    Q.forEach((line, i) => {
      const s = line.slice(0, Math.max(0, n)); n -= line.length;
      c.fillStyle = rgba('bone', 0.95);
      c.fillText(s, 120, y + i * 64);
      if (s.length) { cx = 120 + measure(s, F.mono(400), 40); cy = y + i * 64; }
    });
    if (typed < total || frameIdx(t) % 30 < 15) { c.fillStyle = rgba('signal', 1); c.fillRect(cx + 4, cy - 34, 22, 42); }
    c.font = font(F.mono(500), 16); c.letterSpacing = '3px'; c.fillStyle = rgba('ash', 0.9 * prog(t, f.start + dur * 0.72, f.start + dur * 0.8));
    c.fillText('— CHARLIE MUNGER, ON INVERSION', 120, y + 3 * 64 + 20); c.letterSpacing = '0px';
    // the cross on "there"
    const xk = prog(t, f.end - 0.75, f.end - 0.6, ease.outBack);
    const thereX = 120 + measure('never go ', F.mono(400), 40), thereY = y + 2 * 64 - 14;
    if (xk > 0) xMark(this.lb, thereX + 60, thereY - 50, 22 * xk, 2.4, 4);
    sparkHead(this.lb, xk > 0 ? thereX + 60 : cx + 16, xk > 0 ? thereY - 50 : cy - 14, t, 0.8, 1);
    this.lb.render(renderer, out);
    comp.draw(renderer, this.L.upload(), out);
    return { bloom: 0.7, vignette: 0.5, fade: 1 - prog(t, f.start, f.start + 0.4) };
  }
}
