// coda — "One degree" ×2 / "One degree was all I need" ×2 / "One degree" ×2.
// Night again, and the opening's protractor. The needle stands upright on screen — but only because the world
// (scale and all) has turned around it: the turned degrees fill in orange between the needle and the scale's 90°,
// one more on each "degree", until the needle reads 66° and the count is 24. The lyric, like the needle, is level.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { ease, prog, pulse } from '../engine/util';
import { degreeTimes, drawKaraoke, heading, mono, needle, pivot, rad, rollPost } from './_od';

const CX = 960, CY = 540, R = 440;

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
    const h = heading(lyrics, t);
    const intro = prog(t, this.ctx.start, this.ctx.start + 1.2, ease.outCubic) * (1 - prog(t, this.ctx.end - 1.6, this.ctx.end - 0.1, ease.inOutCubic));
    const flare = this.degs.reduce((m, d) => Math.max(m, pulse(t, d, 0.35)), 0);
    // the protractor (world: it turns with the world)
    const n = 180;
    for (let i = 0; i < n; i++) {
      const a0 = rad(180 + i), a1 = rad(181 + i);
      lb.seg2(CX + Math.cos(a0) * R, CY + Math.sin(a0) * R, CX + Math.cos(a1) * R, CY + Math.sin(a1) * R, 1.3, LIN.bone, 0.8 * intro);
    }
    lb.seg2(CX - R - 40, CY, CX + R + 40, CY, 1.1, LIN.bone, 0.5 * intro);
    for (let i = 0; i <= 180; i++) {
      const a = rad(180 + i);
      const L = i % 10 === 0 ? 26 : i % 5 === 0 ? 16 : 9;
      lb.seg2(CX + Math.cos(a) * R, CY + Math.sin(a) * R, CX + Math.cos(a) * (R - L), CY + Math.sin(a) * (R - L), i % 10 === 0 ? 1.4 : 1, LIN.bone, (i % 5 === 0 ? 0.85 : 0.55) * intro);
    }
    // the turned sector: from the scale's 90° back to the needle, one ray per whole degree
    const whole = Math.floor(h + 1e-6);
    for (let d = 0; d <= whole; d++) {
      const a = rad(-90 - d);
      const last = d === whole;
      const I = last ? 1 + 1.5 * flare : 0.6;
      lb.seg2(CX + Math.cos(a) * R * 0.25, CY + Math.sin(a) * R * 0.25, CX + Math.cos(a) * (R + 22), CY + Math.sin(a) * (R + 22), 1.1,
        [LIN.signal[0] * I, LIN.signal[1] * I, LIN.signal[2] * I], (d === 0 ? 0.9 : 0.55) * intro);
    }
    // the arc of the turned sector, outside the scale
    const ar = R + 34;
    for (let s = 0; s < 48; s++) {
      const a0 = rad(-90 - (h * s) / 48), a1 = rad(-90 - (h * (s + 1)) / 48);
      lb.seg2(CX + Math.cos(a0) * ar, CY + Math.sin(a0) * ar, CX + Math.cos(a1) * ar, CY + Math.sin(a1) * ar, 2, LIN.signal, 0.95 * intro);
    }
    // the needle: upright on screen (world angle −90° − heading)
    pivot(lb, CX, CY, 8, LIN.bone, 0.9);
    needle(lb, CX, CY, rad(-90 - h), R - 30, t, { width: 1.6, tail: 30 });
    lb.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    // scale labels (world)
    c.save(); c.globalAlpha = intro;
    c.font = font(F.mono(400), 13); c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let deg = 0; deg <= 180; deg += 10) {
      const a = rad(180 + deg), r = R - 46;
      c.save(); c.translate(CX + Math.cos(a) * r, CY + Math.sin(a) * r); c.rotate(a + Math.PI / 2);
      c.fillStyle = rgba('ash', 0.85); c.fillText(String(deg), 0, 0); c.restore();
    }
    c.restore();
    // level (counter-rotated) type: the lyric and the readout
    c.save();
    c.translate(CX, CY); c.rotate(rad(-h)); c.translate(-CX, -CY);
    const st = { family: F.serif(400, true), size: 84, tracking: 0, sung: rgba('bone', 0.96), unsung: rgba('bone', 0.14), active: rgba('signal', 1), lead: 0.6, align: 'center' as const };
    this.ls.forEach((l, i) => {
      const nx = this.ls[i + 1];
      const a = prog(t, l.start - 0.7, l.start - 0.25) * (nx ? 1 - prog(t, nx.start - 0.7, nx.start - 0.3) : 1 - prog(t, this.ctx.end - 1.5, this.ctx.end - 0.2));
      if (a <= 0) return;
      c.save(); c.globalAlpha = a;
      drawKaraoke(c, l, CX, 760, t, st);
      c.restore();
    });
    const reading = 90 - h;
    mono(c, `READING ${reading.toFixed(1)}°`, CX, 880, { size: 14, color: rgba('bone', 0.85 * intro), track: 4, align: 'center', weight: 500 });
    mono(c, `TURNED ${h.toFixed(1)}°  ·  ${degreeTimes(lyrics).filter((d) => d <= t).length} / 24`, CX, 908, { size: 13, color: rgba('signal', intro), track: 4, align: 'center' });
    c.restore();
    comp.draw(renderer, T.upload(), out);
    void W;
    return { ...rollPost(lyrics, t), bloom: 0.6, ca: 0.4, vignette: 0.45 };
  }
}
