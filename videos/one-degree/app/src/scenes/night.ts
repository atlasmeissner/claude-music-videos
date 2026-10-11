// night — "One night folds into the years" / "But something's gathering here".
// Star trails around the pole over a dark horizon: each night an arc; the years close the arcs into rings; then
// the rings gather in on the pole star, which becomes the warm needle tip.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { ease, hash, lerp, noise1, prog, TAU } from '../engine/util';
import { drawHeading, drawKaraoke, heading, mono, needleTip, rollPost } from './_od';

const PX = 1240, PY = 330, HORIZON = 820;
const N = 520;

export default class Night extends Scene {
  lb = new LineBatch(40000);
  text = new Layer2D();
  l12!: Line; l13!: Line;
  stars: { r: number; a: number; m: number; warm: boolean }[] = [];

  override init() {
    const ly = this.ctx.lyrics;
    this.l12 = ly.lines[12]!; this.l13 = ly.lines[13]!;
    for (let i = 0; i < N; i++) {
      const r = 30 + Math.pow(hash(i, 1), 0.75) * 1500;
      this.stars.push({ r, a: hash(i, 2) * TAU, m: Math.pow(hash(i, 3), 2.2), warm: hash(i, 4) < 0.06 });
    }
  }

  horizon(x: number) { return HORIZON + (noise1(x * 0.004, 7) - 0.5) * 70 + (noise1(x * 0.02, 3) - 0.5) * 14; }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const years = this.l12.words[this.l12.words.length - 1]!;
    // trail sweep: one night (~120°) through "folds", closing to full rings by "years"
    const sweep = lerp(0.15, 2.1, prog(t, this.ctx.start, this.l12.words[2]!.start, ease.outCubic)) + (TAU - 2.1) * prog(t, this.l12.words[2]!.start, years.end, ease.inOutCubic);
    const gather = prog(t, this.l13.words[2]!.start - 0.2, this.ctx.end, ease.inOutCubic);
    const rot = t * 0.05;
    for (const s of this.stars) {
      const r = s.r * lerp(1, 0.02, Math.pow(gather, 0.8 + s.r / 1500));
      const segs = Math.max(2, Math.ceil((sweep * r) / 14));
      const a1 = s.a + rot, a0 = a1 - sweep;
      const col = s.warm ? LIN.ember : LIN.bone;
      const al = 0.18 + s.m * 0.75;
      let px = PX + Math.cos(a0) * r, py = PY + Math.sin(a0) * r;
      for (let i = 1; i <= segs; i++) {
        const a = a0 + (sweep * i) / segs;
        const qx = PX + Math.cos(a) * r, qy = PY + Math.sin(a) * r;
        const fade = 0.35 + 0.65 * (i / segs);
        if (py < this.horizon(px) && qy < this.horizon(qx)) lb.seg2(px, py, qx, qy, 0.8 + s.m * 1.1, col, al * fade);
        px = qx; py = qy;
      }
    }
    // the horizon (a hairline ridge)
    let hx = 0, hy = this.horizon(0);
    for (let x = 12; x <= W + 12; x += 12) { const y = this.horizon(x); lb.seg2(hx, hy, x, y, 1.3, LIN.bone, 0.8); hx = x; hy = y; }
    needleTip(lb, PX, PY, t, 0.45 + gather * 0.35, 0.45 + gather * 0.45);
    lb.render(renderer, out);

    const L = this.text, c = L.ctx; L.clear();
    const st = { family: F.archivo(100, 700), size: 84, tracking: -1, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.5 } as const;
    // line 12, then line 13 in its place
    const sw = prog(t, Math.min(this.l12.end, this.l13.start) - 0.05, this.l13.start + 0.12, ease.inOutCubic);
    if (sw < 1) { c.save(); c.globalAlpha = 1 - sw; drawKaraoke(c, this.l12, 120, 930 - sw * 30, t, st); c.restore(); }
    if (sw > 0) { c.save(); c.globalAlpha = sw; drawKaraoke(c, this.l13, 120, 960 - sw * 30, t, st); c.restore(); }
    const nights = Math.round(Math.pow(sweep / TAU, 3) * 3650) + 1;
    mono(c, 'EXPOSURE', 120, 150, { size: 12, color: rgba('ash', 0.75), track: 3 });
    mono(c, `${nights.toLocaleString('en-US')} NIGHT${nights > 1 ? 'S' : ''}`, 120, 176, { size: 18, color: rgba('bone', 0.9), track: 2, weight: 500 });
    mono(c, 'POLARIS  ALT 47.8°', PX + 26, PY - 18, { size: 12, color: rgba('ash', 0.8), track: 2 });
    drawHeading(c, W - 340, 150, heading(lyrics, t));
    comp.draw(renderer, L.upload(), out);
    return { ...rollPost(lyrics, t), bloom: 0.6, ca: 0.5, vignette: 0.45 };
  }
}
