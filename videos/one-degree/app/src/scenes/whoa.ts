// whoa — "One degree, whoa" ×3, then the instrumental break.
// A fan of rays from one pivot, one ray per degree the world has turned so far, one degree apart (true scale).
// Each "degree" adds a ray; each "whoa" stretches and the fan burns. Then the camera pulls back: the fan is a
// sliver of a 360-tick ring — 12 of 360 lit — which turns slowly and goes quiet.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { Lyrics } from '../engine/lyrics';
import { clamp, ease, lerp, prog, pulse } from '../engine/util';
import { degreeTimes, drawCompound, heading, mono, needleTip, rad, rollPost } from './_od';

export default class Whoa extends Scene {
  lb = new LineBatch(12000);
  text = new Layer2D();
  ls: Line[] = [];
  all: number[] = [];

  override init() {
    const ly = this.ctx.lyrics;
    this.ls = [20, 21, 22].map((i) => ly.lines[i]!);
    this.all = degreeTimes(ly).filter((d) => d < this.ctx.end);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const st0 = this.ctx.start;
    const lastLine = this.ls[2]!;
    const pull = prog(t, lastLine.words[2]!.start + 1.2, lastLine.words[2]!.start + 7, ease.inOutCubic);
    const quiet = prog(t, this.ctx.end - 4.5, this.ctx.end - 0.2, ease.inOutQuad);
    const cx = lerp(1180, W / 2, pull), cy = lerp(1040, 560, pull);
    const z = lerp(1, 0.4, pull);
    const RL = 960; // ray length (world px)
    // whoa glow: while any "whoa" is held
    let whoa = 0;
    for (const l of this.ls) { const w = l.words[2]!; whoa = Math.max(whoa, prog(t, w.start, w.start + 0.3) * (1 - prog(t, l.end, l.end + 0.6))); }
    whoa = Math.max(whoa, 0.6 * (1 - pull) * f.a.vocal);
    // rays: earlier degrees appear in a quick stagger at the cut, this plate's on their words
    const eighth = 30 / audio.bpm;
    this.all.forEach((d, n) => {
      const born = d < st0 ? st0 + n * eighth * 0.5 : d;
      const k = prog(t, born - 0.02, born + 0.35, ease.outExpo);
      if (k <= 0) return;
      const a = rad(-90 + n);
      const hot = pulse(t, born, 0.3);
      const L = RL * k;
      const I = (0.55 + 0.5 * whoa + 1.6 * hot) * (1 - quiet * 0.85);
      const col: [number, number, number] = n === this.all.length - 1 || hot > 0.05 ? [LIN.signal[0] * I * 1.5, LIN.signal[1] * I * 1.5, LIN.signal[2] * I * 1.5] : [LIN.bone[0] * I * 0.75, LIN.bone[1] * I * 0.75, LIN.bone[2] * I * 0.75];
      lb.seg2(cx, cy, cx + Math.cos(a) * L * z, cy + Math.sin(a) * L * z, 1.3 + whoa * 0.8, col, 0.9);
    });
    // the ring of 360 ticks, revealed by the pull-back
    if (pull > 0) {
      const n = this.all.filter((d) => d <= t).length;
      const spin = rad((t - (this.ctx.end - 10)) * 0.6) * clamp(pull);
      for (let i = 0; i < 360; i++) {
        const a = rad(-90 + i) + 0 * spin;
        const lit = i < n;
        const L = i % 30 === 0 ? 40 : i % 10 === 0 ? 26 : 14;
        const R = RL * z;
        const al = pull * (lit ? 1 : 0.35) * (1 - quiet * (lit ? 0.4 : 0.8));
        lb.seg2(cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a) * (R + L), cy + Math.sin(a) * (R + L), lit ? 2 : 1, lit ? LIN.signal : LIN.bone, al);
      }
    }
    needleTip(lb, cx, cy, t, 0.8, 0.8 * (1 - quiet * 0.7));
    lb.render(renderer, out);

    // ----- type: three rows, "whoa" stretching as it's held
    const T = this.text, c = T.ctx; T.clear();
    const size = 92, rowY = [360, 490, 620];
    const ta = 1 - prog(t, lastLine.end + 0.2, lastLine.end + 1.4);
    if (ta > 0) {
      c.save(); c.globalAlpha = ta; c.textBaseline = 'alphabetic';
      this.ls.forEach((l, r) => {
        if (t < l.start - 0.6) return;
        let x = 120;
        l.words.forEach((w, i) => {
          const isWhoa = i === 2;
          const s = isWhoa ? prog(t, w.start, l.end, ease.inOutQuad) : 0;
          const fam = isWhoa ? F.archivo(lerp(100, 125, s), lerp(800, 300, s)) : F.archivo(100, 800);
          const tr = isWhoa ? lerp(-1, 22, s) : -1.5;
          const wd = measure(w.w, fam, size, tr);
          c.font = font(fam, size); c.letterSpacing = `${tr}px`;
          c.fillStyle = rgba('bone', 0.15); c.fillText(w.w, x, rowY[r]!);
          const p = Lyrics.wordProgress(w, t);
          if (t >= w.start) {
            c.save(); c.beginPath(); c.rect(x - 8, rowY[r]! - size * 1.2, (wd + 16) * Math.min(1, p * 1.1 + (isWhoa ? 1 : 0)), size * 1.6); c.clip();
            const hot = clamp(1 - (t - w.end) / 0.35);
            c.fillStyle = hot > 0 ? `rgba(${(255 - 15 * (1 - hot)).toFixed(0)},${(106 + 129 * (1 - hot)).toFixed(0)},${(31 + 193 * (1 - hot)).toFixed(0)},1)` : rgba('bone', 1);
            c.fillText(w.w, x, rowY[r]!);
            c.restore();
          }
          x += wd + size * 0.27;
        });
      });
      c.restore();
    }
    if (pull > 0) {
      const n = this.all.filter((d) => d <= t).length;
      c.save(); c.globalAlpha = pull * (1 - quiet * 0.5);
      mono(c, `${n} / 360`, cx, cy + 12, { size: 22, color: rgba('signal', 1), track: 3, align: 'center', weight: 500 });
      mono(c, 'OF ONE TURN', cx, cy + 40, { size: 12, color: rgba('ash', 0.85), track: 4, align: 'center' });
      c.restore();
    }
    drawCompound(c, 120, 990, t, { ly: lyrics });
    comp.draw(renderer, T.upload(), out);
    return { ...rollPost(lyrics, t), bloom: 0.7, ca: 0.5, vignette: 0.45 };
  }
}
