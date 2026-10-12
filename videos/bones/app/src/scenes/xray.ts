// xray — the instrumental break after chorus 1 (full band, the choir's "oh"). What the strip-out left: the old
// building's bones, in 3D, glowing like an x-ray. Four shots, a cut every two bars: an orbit, a low
// three-quarter view, straight down the portico, a high plan-like view. A signal-orange section plane scans
// through on each downbeat; mono annotations count what is actually holding anything up.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, lerp, prog, pulse } from '../engine/util';
import { drawLedger, mono, point, scaleRGB, titleBlock } from './_bones';
import { OLD, aim, fog, makeCam, project, type V3 } from './_frame3d';

export default class Xray extends Scene {
  lb = new LineBatch(4000, { screen2D: false });
  lp = new LineBatch(400);
  text = new Layer2D();
  cam = makeCam(38);
  cuts: number[] = [];
  dbs: number[] = [];

  override init() {
    const { audio, start, end } = this.ctx;
    this.dbs = audio.downbeats.filter((d) => d >= start - 0.01 && d < end);
    this.cuts = [start, ...this.dbs.filter((_, i) => i > 0 && i % 2 === 0)].filter((d) => d < end - 1);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    let shot = 0;
    for (let i = 0; i < this.cuts.length; i++) if (t >= this.cuts[i]!) shot = i;
    const ts = this.cuts[shot]!, te = this.cuts[shot + 1] ?? this.ctx.end;
    const u = (t - ts) / (te - ts);
    const C: V3 = [0, 3.6, -3];
    let eye: V3;
    switch (shot % 4) {
      case 0: { const a = lerp(0.55, 1.05, u); eye = [Math.sin(a) * 19, 5 + u * 2, -3 + Math.cos(a) * 19]; break; }
      case 1: { const a = lerp(-0.7, -0.45, u); eye = [Math.sin(a) * 21, 1.4, -3 + Math.cos(a) * 21]; break; }
      case 2: { eye = [0, 2.4, lerp(19, 14, ease.inOutQuad(u))]; break; }
      default: { const a = lerp(2.4, 2.9, u); eye = [Math.sin(a) * 12, 22, -3 + Math.cos(a) * 12]; }
    }
    aim(this.cam, eye, shot % 4 === 2 ? [0, 3.4, -3] : C);
    const scanZ = (() => {
      const d = this.dbs.filter((x) => x <= t).pop() ?? ts;
      return lerp(1.5, -7.5, prog(t, d, d + 1.7, ease.inOutQuad));
    })();
    const lb = this.lb; lb.clear();
    const kick = f.a.kick;
    for (const s of OLD) {
      const fo = fog(this.cam, s.a, s.b, 10, 34);
      const near = Math.abs((s.a[2] + s.b[2]) / 2 - scanZ);
      const hot = Math.max(0, 1 - near / 0.6);
      const col = hot > 0.05 ? scaleRGB(LIN.signal, 1.4 * hot + 0.5) : scaleRGB(LIN.bone, 0.85 + kick * 0.2);
      lb.seg(s.a[0], s.a[1], s.a[2], s.b[0], s.b[1], s.b[2], s.w * 0.75, col[0], col[1], col[2], (0.12 + 0.88 * fo * fo) * (hot > 0.05 ? 1 : 0.85));
    }
    // the section plane's outline
    const pl: V3[] = [[-9, -0.2, scanZ], [9, -0.2, scanZ], [9, 10.5, scanZ], [-9, 10.5, scanZ], [-9, -0.2, scanZ]];
    for (let i = 1; i < pl.length; i++) lb.seg(pl[i - 1]![0], pl[i - 1]![1], pl[i - 1]![2], pl[i]![0], pl[i]![1], pl[i]![2], 0.8, LIN.signal[0], LIN.signal[1], LIN.signal[2], 0.35);
    // ground grid
    for (let x = -12; x <= 12; x += 2) lb.seg(x, 0, 6, x, 0, -12, 0.6, LIN.graphite[0], LIN.graphite[1], LIN.graphite[2], 0.5);
    for (let z = 6; z >= -12; z -= 2) lb.seg(-12, 0, z, 12, 0, z, 0.6, LIN.graphite[0], LIN.graphite[1], LIN.graphite[2], 0.5);
    lb.render(renderer, out, this.cam);
    const lp = this.lp; lp.clear();
    const [px, py, vis] = project(this.cam, [0, 0, 0]);
    if (vis) point(lp, px, py, t, 0.9);
    lp.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    const k = prog(t, ts, ts + 0.3, ease.outCubic);
    const notes = [
      ['THE BONES', 'COLUMNS 38 · BEAMS 64 · ARCHES 8'],
      ['LOOKING UP', 'WHAT HOLDS IT: THE FRAME'],
      ['DOWN THE PORTICO', 'WHAT HELD THE GOLD: NOTHING'],
      ['FROM ABOVE', 'WHAT IS LEFT IS WHAT IS TRUE'],
    ][shot % 4]!;
    mono(c, `VIEW ${shot + 1}/${this.cuts.length} · ${notes[0]}`, 120, 150, { size: 14, color: rgba('bone', 0.9 * k), track: 4, weight: 500 });
    mono(c, notes[1]!, 120, 176, { size: 12, color: rgba('ash', 0.9 * k), track: 3 });
    mono(c, `SECTION z = ${(-scanZ).toFixed(2)} m`, 120, 202, { size: 12, color: rgba('signal', 0.9 * k), track: 3 });
    // a few member tags projected into the image
    const tags: [V3, string][] = [[[-7.7, 5.4, 0], 'C-01'], [[3.75, 6, 0], 'C-09'], [[0, 7.7, 0], 'APEX'], [[1.65, 8, -3.6], 'RING']];
    for (const [p, lab] of tags) {
      const [x, y, v] = project(this.cam, p);
      if (!v || x < 60 || x > 1860 || y < 60 || y > 1020) continue;
      c.save(); c.globalAlpha = 0.85 * k; c.strokeStyle = rgba('ash', 0.8); c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 30, y - 30); c.lineTo(x + 80, y - 30); c.stroke(); c.restore();
      mono(c, lab, x + 34, y - 36, { size: 11, color: rgba('bone', 0.85 * k), track: 2 });
    }
    drawLedger(c, lyrics, audio, 120, 1012, t);
    titleBlock(c, 'D-401', 'THE BONES (X-RAY)', [['SCALE', 'AS FOUND'], ['INSTRUMENTS', 'FULL BAND + CHOIR']]);
    comp.draw(renderer, T.upload(), out);
    const cutFlash = pulse(t, ts, 0.12) * (shot > 0 ? 1 : 0);
    void clamp;
    return { bloom: 0.8, ca: 0.6 + kick * 0.8, vignette: 0.5, flash: cutFlash * 0.006, shake: [kick * 3, kick * 2] as [number, number] };
  }
}
