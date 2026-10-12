// build — chorus 3. From the point, the new frame rises, one member group per beat: the setting-out lines,
// the piers bay by bay, the arcades, the first transverse arches of the vault. Each member draws itself up with
// a hot tip and cools to bone. Four camera set-ups, a cut on each sung line: low at the first pier, a
// three-quarter exterior, overhead, then down the nave. The chorus is slammed in two rows over the drawing.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { ease, lerp, prog, pulse } from '../engine/util';
import { drawLedger, mono, point, shadeBand, scaleRGB, slamRows, titleBlock } from './_bones';
import { aim, buildTimes, drawNave, makeCam, NAVE_GROUPS, project, type V3 } from './_frame3d';

export default class Build extends Scene {
  lb = new LineBatch(4000, { screen2D: false });
  lp = new LineBatch(300);
  text = new Layer2D();
  cam = makeCam(42);
  L: Line[] = [];
  cuts: number[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    this.L = [20, 21, 22, 23].map((i) => lyrics.lines[i]!);
    this.cuts = [this.ctx.start, ...this.L.slice(1).map((l) => audio.timeOfBeat(Math.floor(audio.beatAt(l.words[0]!.start + 0.02))))];
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    let shot = 0;
    for (let i = 0; i < this.cuts.length; i++) if (t >= this.cuts[i]!) shot = i;
    const ts = this.cuts[shot]!, te = this.cuts[shot + 1] ?? this.ctx.end;
    const u = (t - ts) / (te - ts);
    let eye: V3, tgt: V3;
    switch (shot) {
      case 0: eye = [lerp(-16, -12, u), lerp(2.5, 5, u), lerp(16, 18, u)]; tgt = [0, lerp(5, 7, u), -10]; break;
      case 1: { const a = lerp(0.75, 1.05, u); eye = [Math.sin(a) * 46, 16 + u * 4, -20 + Math.cos(a) * 46]; tgt = [0, 8, -20]; break; }
      case 2: { eye = [lerp(-62, -56, u), lerp(10, 13, u), lerp(-6, -14, u)]; tgt = [0, 10, -20]; break; }
      default: eye = [0, lerp(2, 5, u), lerp(14, 4, ease.inOutQuad(u))]; tgt = [0, 12, -40];
    }
    aim(this.cam, eye, tgt);
    const lb = this.lb; lb.clear();
    // ground grid, faint
    for (let x = -24; x <= 24; x += 4) lb.seg(x, 0, 8, x, 0, -50, 0.6, LIN.graphite[0], LIN.graphite[1], LIN.graphite[2], 0.35);
    for (let z = 8; z >= -50; z -= 4) lb.seg(-24, 0, z, 24, 0, z, 0.6, LIN.graphite[0], LIN.graphite[1], LIN.graphite[2], 0.35);
    const built = drawNave(lb, this.cam, audio, t, { bone: scaleRGB(LIN.bone, 0.95), hot: scaleRGB(LIN.signal, 2.2), near: 14, far: 90 });
    lb.render(renderer, out, this.cam);
    // the point at the foot of the first pier; a ring on each new group
    const lp = this.lp; lp.clear();
    const [px, py, vis] = project(this.cam, [-5, 0, 0]);
    if (vis) point(lp, px, py, t, 1);
    lp.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    shadeBand(c, 0, 520, 0.72);
    let li = 0;
    for (let i = 0; i < 4; i++) if (t >= this.L[i]!.words[0]!.start - 0.12) li = i;
    const ws = this.L[li]!.words;
    const split = li === 2 ? 3 : 3;
    slamRows(c, [{ words: ws.slice(0, split), x: 100, y: 230 }, { words: ws.slice(split), x: 100, y: 370 }], t,
      { family: F.archivo(62, 900), size: 136, tracking: -2, upper: true });
    const T0 = buildTimes(audio);
    const lastT = T0[Math.max(0, built - 1)] ?? 0;
    const hot = pulse(t, lastT, 0.3);
    mono(c, `MEMBERS RAISED  ${String(built).padStart(2, '0')} / ${NAVE_GROUPS.length}`, 102, 430, { size: 13, color: hot > 0.2 ? rgba('signal', 1) : rgba('bone', 0.9), track: 3, weight: 500 });
    mono(c, ['SET OUT FROM ONE POINT', 'EVERY MEMBER CARRIES WHAT IS ABOVE IT', 'NOTHING ON IT THAT IS NOT NEEDED', 'BUILT FROM THE BONES'][li]!, 102, 456, { size: 12, color: rgba('ash', 0.9), track: 3 });
    drawLedger(c, lyrics, audio, 120, 1012, t);
    titleBlock(c, 'S-101', 'FRAME, RISING', [['SCALE', '1:200'], ['METHOD', 'FIRST PRINCIPLES']]);
    comp.draw(renderer, T.upload(), out);
    void prog;
    return { bloom: 0.85, ca: 0.6 + f.a.kick * 0.8, vignette: 0.5, shake: [f.a.kick * 4, f.a.kick * 2] as [number, number] };
  }
}
