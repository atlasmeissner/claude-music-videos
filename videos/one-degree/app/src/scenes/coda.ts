// coda — "One degree" ×2 / "One degree was all I need" ×2 / "One degree" ×2. (Revision 2.)
// The opening's protractor again, level and quiet. The needle that stood at 90° in the first frame now really
// turns: one degree on each "degree", leaving a hairline where it was, until six one-degree steps sit side by side
// next to the 90° mark. At the end, the year in one line: 1.01³⁶⁵ = 37.8.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { ease, prog, pulse } from '../engine/util';
import { degreeTimes, drawCompound, drawKaraoke, mono, needle, pivot, rad, rollPost } from './_od';

const CX = 960, CY = 700, R = 520;

export default class Coda extends Scene {
  lb = new LineBatch(8000);
  text = new Layer2D();
  ls: Line[] = [];
  degs: number[] = [];

  override init() {
    const ly = this.ctx.lyrics;
    this.ls = [32, 33, 34, 35, 36, 37].map((i) => ly.lines[i]!);
    this.degs = degreeTimes(ly).filter((d) => d >= this.ctx.start && d < this.ctx.end);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const intro = prog(t, this.ctx.start, this.ctx.start + 1.2, ease.outCubic) * (1 - prog(t, this.ctx.end - 1.6, this.ctx.end - 0.1, ease.inOutCubic));
    // the needle's angle past 90° (a ratchet per "degree")
    let steps = 0;
    for (const d of this.degs) steps += prog(t, d, d + 0.5, (x) => ease.outBack(x, 1.8));
    const done = this.degs.filter((d) => d <= t).length;
    const flare = this.degs.reduce((m, d) => Math.max(m, pulse(t, d, 0.4)), 0);
    // protractor
    for (let i = 0; i < 180; i++) {
      const a0 = rad(180 + i), a1 = rad(181 + i);
      lb.seg2(CX + Math.cos(a0) * R, CY + Math.sin(a0) * R, CX + Math.cos(a1) * R, CY + Math.sin(a1) * R, 1.3, LIN.bone, 0.75 * intro);
    }
    lb.seg2(CX - R - 40, CY, CX + R + 40, CY, 1.1, LIN.bone, 0.5 * intro);
    for (let i = 0; i <= 180; i++) {
      const a = rad(180 + i);
      const L = i % 10 === 0 ? 28 : i % 5 === 0 ? 17 : 9;
      const lit = i >= 90 && i <= 90 + done;
      lb.seg2(CX + Math.cos(a) * R, CY + Math.sin(a) * R, CX + Math.cos(a) * (R - L), CY + Math.sin(a) * (R - L), i % 10 === 0 ? 1.4 : 1, lit ? LIN.signal : LIN.bone, (lit ? 1 : i % 5 === 0 ? 0.8 : 0.5) * intro);
    }
    // the hairlines it left behind, one per whole degree
    for (let k = 0; k < done; k++) {
      const a = rad(-90 + k);
      lb.seg2(CX, CY, CX + Math.cos(a) * (R - 36), CY + Math.sin(a) * (R - 36), 1, LIN.bone, 0.28 * intro);
    }
    // the wedge it has turned through, as an arc outside the scale
    if (steps > 0.01) {
      const ar = R + 22, n = 24;
      for (let s = 0; s < n; s++) {
        const a0 = rad(-90 + (steps * s) / n), a1 = rad(-90 + (steps * (s + 1)) / n);
        lb.seg2(CX + Math.cos(a0) * ar, CY + Math.sin(a0) * ar, CX + Math.cos(a1) * ar, CY + Math.sin(a1) * ar, 2.2, [LIN.signal[0] * (1 + flare), LIN.signal[1] * (1 + flare), LIN.signal[2] * (1 + flare)], intro);
      }
    }
    pivot(lb, CX, CY, 8, LIN.bone, 0.9 * intro);
    needle(lb, CX, CY, rad(-90 + steps), R - 30, t, { width: 1.6, tail: 30, tip: intro });
    lb.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    c.save(); c.globalAlpha = intro;
    c.font = font(F.mono(400), 13); c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let deg = 0; deg <= 180; deg += 10) {
      const a = rad(180 + deg), r = R + 30;
      c.save(); c.translate(CX + Math.cos(a) * r, CY + Math.sin(a) * r); c.rotate(a + Math.PI / 2);
      c.fillStyle = rgba('ash', 0.85); c.fillText(String(deg), 0, 0); c.restore();
    }
    c.restore();
    // the lyric, under the scale
    const st = { family: F.serif(400, true), size: 80, tracking: 0, sung: rgba('bone', 0.96), unsung: rgba('bone', 0.14), active: rgba('signal', 1), lead: 0.6, align: 'center' as const };
    this.ls.forEach((l, i) => {
      const nx = this.ls[i + 1];
      const a = prog(t, l.start - 0.7, l.start - 0.25) * (nx ? 1 - prog(t, nx.start - 0.7, nx.start - 0.3) : 1 - prog(t, this.ctx.end - 1.5, this.ctx.end - 0.2));
      if (a <= 0) return;
      c.save(); c.globalAlpha = a;
      drawKaraoke(c, l, CX, 850, t, st);
      c.restore();
    });
    mono(c, `${done}° FROM WHERE IT STARTED`, CX, 930, { size: 13, color: rgba('signal', intro), track: 4, align: 'center' });
    // the year in one line, after the last "degree"
    const last = this.degs[this.degs.length - 1] ?? this.ctx.end;
    const y1 = prog(t, last + 0.8, last + 1.8, ease.outCubic) * intro;
    if (y1 > 0) {
      c.save(); c.globalAlpha = y1;
      c.font = font(F.serif(600, true), 48); c.textAlign = 'center'; c.fillStyle = rgba('bone', 0.95);
      c.fillText('1.01³⁶⁵ = 37.8', CX, 120);
      c.restore();
    }
    drawCompound(c, 120, 990, t, { ly: lyrics });
    comp.draw(renderer, T.upload(), out);
    void W;
    return { ...rollPost(lyrics, t), bloom: 0.6, ca: 0.4, vignette: 0.45 };
  }
}
