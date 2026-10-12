// PLATES — the List of Plates after the last hit (silent): every image in the video, numbered as it
// was captioned in the atlas, with its creator and licence. Two pages, like the index of a printed atlas.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { F, font, measure } from '../engine/type';
import { prog, ease } from '../engine/util';
import { manifest, licName, LIN, rgba, W, H, type ImgMeta } from './_kit';

export default class Plates extends Scene {
  L = new Layer2D();
  list: ImgMeta[] = [];
  override async init() { this.list = Object.values(await manifest()).sort((a, b) => a.plate - b.plate); }
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const c = this.L.ctx; this.L.clear();
    const half = (f.end - f.start) / 2;
    const page = t - f.start < half ? 0 : 1;
    const a = prog(t, f.start + page * half, f.start + page * half + 0.5) * (1 - prog(t, f.start + (page + 1) * half - 0.4, f.start + (page + 1) * half));
    const per = Math.ceil(this.list.length / 2);
    const items = this.list.slice(page * per, (page + 1) * per);
    c.globalAlpha = a;
    c.font = font(F.mono(500), 15); c.letterSpacing = '4px'; c.fillStyle = rgba('bone', 0.9);
    c.fillText(`LIST OF PLATES · ${page + 1} / 2`, 96, 70);
    c.font = font(F.serif(400, true), 22); c.letterSpacing = '0px'; c.fillStyle = rgba('ash', 0.9);
    c.fillText('Creative Commons and public-domain images, recoloured, cropped, inverted and animated. Full links in CREDITS.md.', 96, 102);
    const cols = 2, rows = Math.ceil(items.length / cols), lh = (H - 170) / rows, cw = (W - 192) / cols;
    c.font = font(F.mono(400), 12.5);
    items.forEach((m, i) => {
      const x = 96 + Math.floor(i / rows) * cw, y = 140 + (i % rows) * lh;
      const title = m.title.replace(/\s+/g, ' ');
      const who = (m.creator || 'unknown').replace(/\s+/g, ' ');
      let s = `${String(m.plate).padStart(3, ' ')}  ${title} — ${who}`;
      const lic = `${licName(m.license)}`;
      while (measure(s, F.mono(400), 12.5) > cw - 120 && s.length > 20) s = s.slice(0, -2);
      if (s.length < `${String(m.plate).padStart(3, ' ')}  ${title} — ${who}`.length) s = s.trimEnd() + '…';
      c.fillStyle = rgba('bone', 0.85); c.fillText(s, x, y);
      c.fillStyle = rgba('signal', 0.9); c.fillText(lic, x + cw - 110, y);
    });
    c.globalAlpha = 1;
    comp.draw(renderer, this.L.upload(), out);
    return { bloom: 0.4, vignette: 0.3, grain: 0.04 };
  }
}
