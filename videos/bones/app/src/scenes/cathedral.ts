// cathedral — the final chorus. The frame from chorus 3 is finished: the rib vaults close bay by bay, the
// flying buttresses spring, the apse and the rose. A shot per line: high over the west end; looking straight up
// into the vault; a crane rising beside the nave; then down the nave toward the apse, where on the last
// "bones" the boss of the apse vault — the keystone — is set: it is the point.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { ease, lerp, prog } from '../engine/util';
import { drawLedger, mono, point, shadeBand, ring, scaleRGB, slamRows, titleBlock } from './_bones';
import { aim, buildTimes, drawNave, makeCam, NAVE_GROUPS, project, CLER_H, VAULT_RISE, BAY, NAVE_BAYS, type V3 } from './_frame3d';

export default class Cathedral extends Scene {
  lb = new LineBatch(4000, { screen2D: false });
  lp = new LineBatch(300);
  text = new Layer2D();
  cam = makeCam(44);
  L: Line[] = [];
  cuts: number[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    this.L = [26, 27, 28, 29].map((i) => lyrics.lines[i]!);
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
    let eye: V3, tgt: V3, roll = 0;
    switch (shot) {
      case 0: { const a = lerp(0.55, 0.8, u); eye = [Math.sin(a) * 52, lerp(34, 40, u), 10 + Math.cos(a) * 30]; tgt = [0, 8, -22]; break; }
      case 1: eye = [0.01, 1.6, lerp(-6, -14, u)]; tgt = [0, 40, -24 - u * 4]; roll = lerp(0, 0.5, ease.inOutQuad(u)); break;
      case 2: eye = [-48, lerp(4, 30, ease.inOutCubic(u)), lerp(-12, -24, u)]; tgt = [0, lerp(12, 14, u), -22]; break;
      default: eye = [0, lerp(7, 9, u), lerp(12, -6, ease.inOutQuad(u))]; tgt = [0, lerp(27, 34, u), -48];
    }
    aim(this.cam, eye, tgt, roll);
    const lb = this.lb; lb.clear();
    for (let x = -28; x <= 28; x += 4) lb.seg(x, 0, 10, x, 0, -52, 0.6, LIN.graphite[0], LIN.graphite[1], LIN.graphite[2], 0.3);
    for (let z = 10; z >= -52; z -= 4) lb.seg(-28, 0, z, 28, 0, z, 0.6, LIN.graphite[0], LIN.graphite[1], LIN.graphite[2], 0.3);
    const built = drawNave(lb, this.cam, audio, t, { bone: scaleRGB(LIN.bone, 1.0), hot: scaleRGB(LIN.signal, 2.4), near: 14, far: 95 });
    lb.render(renderer, out, this.cam);
    // the keystone: the boss of the apse vault, set on the last "bones"
    const lp = this.lp; lp.clear();
    const bones = this.L[3]!.words[5]!;
    const zA = -NAVE_BAYS * BAY;
    const boss: V3 = [0, CLER_H + VAULT_RISE, zA - 3];
    const [bx, by, bv] = project(this.cam, boss);
    const kk = prog(t, bones.start - 0.4, bones.start, ease.inQuad);
    if (bv && kk > 0) {
      const [sx, sy] = project(this.cam, [boss[0], boss[1] + 30 * (1 - kk), boss[2]]);
      point(lp, sx, sy, t, 1.4, 1);
      ring(lp, bx, by, t, bones.start, { rgb: LIN.signal, speed: 420, life: 1.8, alpha: 0.8 });
      ring(lp, bx, by, t, bones.start + 0.15, { rgb: LIN.bone, speed: 300, life: 2.2, alpha: 0.4 });
    }
    const [px, py, pv] = project(this.cam, [-5, 0, 0]);
    if (pv) point(lp, px, py, t, 0.9);
    lp.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    shadeBand(c, 0, 520, 0.72);
    let li = 0;
    for (let i = 0; i < 4; i++) if (t >= this.L[i]!.words[0]!.start - 0.12) li = i;
    const ws = this.L[li]!.words;
    const split = li === 2 ? 3 : 3;
    slamRows(c, [{ words: ws.slice(0, split), x: 960, y: 210, align: 'center' }, { words: ws.slice(split), x: 960, y: 360, align: 'center' }], t,
      { family: F.archivo(62, 900), size: 150, tracking: -2, upper: true });
    mono(c, `MEMBERS RAISED  ${String(built).padStart(2, '0')} / ${NAVE_GROUPS.length}`, 960, 420, { size: 13, color: rgba('bone', 0.85), track: 3, weight: 500, align: 'center' });
    if (t > bones.start) mono(c, 'KEYSTONE SET', 960, 446, { size: 13, color: rgba('signal', prog(t, bones.start, bones.start + 0.3)), track: 6, weight: 600, align: 'center' });
    drawLedger(c, lyrics, audio, 120, 1012, t);
    titleBlock(c, 'S-201', t > bones.start ? 'NAVE, CLOSED' : 'NAVE, VAULTING', [['SCALE', '1:200'], ['BUILT FROM', '1 POINT']]);
    comp.draw(renderer, T.upload(), out);
    void buildTimes;
    return { bloom: 0.9, ca: 0.6 + f.a.kick * 0.8, vignette: 0.5, halation: 0.35, shake: [f.a.kick * 4, f.a.kick * 2] as [number, number] };
  }
}
