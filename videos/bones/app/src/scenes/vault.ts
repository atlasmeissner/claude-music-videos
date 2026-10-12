// vault — the tag ("From the bones") and the choir. The nave, finished, from inside: one continuous slow walk
// from the west door to the apse, looking up. The choir lights the structure: on every beat a node of the
// frame (a springing, a rib crossing, a pier head) takes a small flame, until the vault is a constellation.
// "From the bones" is the echo, in italic, under the vault.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, hash, lerp, prog } from '../engine/util';
import { drawFlow, drawLedger, mono, point, scaleRGB, titleBlock } from './_bones';
import { aim, drawNave, makeCam, NAVE, project, type V3 } from './_frame3d';

export default class Vault extends Scene {
  lb = new LineBatch(4000, { screen2D: false });
  lp = new LineBatch(3000);
  text = new Layer2D();
  cam = makeCam(60);
  l30!: Line;
  nodes: { p: V3; t: number }[] = [];

  override init() {
    const { lyrics, audio, start, end } = this.ctx;
    this.l30 = lyrics.lines[30]!;
    // candidate nodes: the upper ends of members (springings, crossings, heads), deduplicated, shuffled
    const seen = new Set<string>();
    const pts: V3[] = [];
    for (const s of NAVE) for (const p of [s.a, s.b]) {
      if (p[1] < 6) continue;
      const k = p.map((v) => Math.round(v * 2)).join(',');
      if (seen.has(k)) continue;
      seen.add(k); pts.push(p);
    }
    pts.sort((a, b) => hash(a[0] * 7 + a[1] * 13 + a[2], 5) - hash(b[0] * 7 + b[1] * 13 + b[2], 5));
    // lit on the beats from the choir in, several per beat as it swells
    let i = 0;
    const b0 = Math.ceil(audio.beatAt(this.l30.end));
    for (let b = b0; audio.timeOfBeat(b) < end + 20 && i < pts.length; b++) {
      const n = 2 + Math.floor((audio.timeOfBeat(b) - start) / 3);
      for (let k = 0; k < n && i < pts.length; k++) this.nodes.push({ p: pts[i++]!, t: audio.timeOfBeat(b) + k * 0.06 });
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t, s0 = this.ctx.start, e = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const u = (t - s0) / (e - s0);
    const z = lerp(8, -20, ease.inOutQuad(u));
    aim(this.cam, [Math.sin(u * 3) * 0.8, 2.2 + u * 2, z], [0, 24, z - 16], Math.sin(u * 2.2) * 0.08);
    const lb = this.lb; lb.clear();
    drawNave(lb, this.cam, audio, t, { bone: scaleRGB(LIN.bone, 0.85), hot: scaleRGB(LIN.signal, 2.4), near: 10, far: 70, all: true });
    lb.render(renderer, out, this.cam);
    const lp = this.lp; lp.clear();
    let lit = 0;
    for (const n of this.nodes) {
      if (t < n.t) continue;
      const [x, y, v] = project(this.cam, n.p);
      if (!v || x < -40 || x > 1960 || y < -40 || y > 1120) continue;
      lit++;
      const fresh = clamp(1 - (t - n.t) / 0.6);
      const d = Math.hypot(n.p[0] - this.cam.position.x, n.p[1] - this.cam.position.y, n.p[2] - this.cam.position.z);
      point(lp, x, y, t + n.t, Math.max(0.25, Math.min(1, 14 / d)) * (0.8 + fresh * 0.6), 0.7 + fresh * 0.3);
    }
    lp.render(renderer, out);
    const T = this.text, c = T.ctx; T.clear();
    const ec = prog(t, this.l30.start - 0.4, this.l30.start, ease.outCubic) * (1 - prog(t, this.l30.end + 0.8, this.l30.end + 2.2));
    if (ec > 0) {
      c.save(); c.globalAlpha = ec;
      drawFlow(c, this.l30, 960, 760, t, { family: F.serif(400, true), size: 120, sung: rgba('bone', 1), unsung: rgba('bone', 0.15), active: rgba('signal', 1), lead: 0.5, align: 'center' });
      c.restore();
    }
    const ca = prog(t, this.l30.end + 1.5, this.l30.end + 2.5);
    mono(c, 'ALL VOICES', 960, 960, { size: 13, color: rgba('ash', 0.85 * ca), track: 8, align: 'center' });
    mono(c, `LIGHTS ${String(lit).padStart(3, '0')}`, 960, 986, { size: 13, color: rgba('signal', ca), track: 6, align: 'center', weight: 500 });
    drawLedger(c, lyrics, audio, 120, 1012, t);
    titleBlock(c, 'S-202', 'NAVE, INTERIOR', [['SCALE', '1:1'], ['INSTRUMENTS', 'EVERYTHING']]);
    comp.draw(renderer, T.upload(), out);
    return { bloom: 1.0, ca: 0.6 + f.a.kick * 0.6, vignette: 0.55, halation: 0.45, shake: [f.a.kick * 2, f.a.kick * 1] as [number, number] };
  }
}
