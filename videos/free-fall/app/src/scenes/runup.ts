// runup — pre-chorus 1: "The worst that happens is a stumble / The best is something beautiful".
// Dawn, the true drop. The person walks back from the edge to take a run-up, and imagines both outcomes as hairline
// ghosts of themselves: on "stumble" a ghost jumps, lands, trips and sits down (−1, deadpan); on "beautiful" a second
// ghost lands clean and the door swings wide, light pouring out. Then the real one crouches, sets, and runs — and on
// the chorus downbeat the leap (which, it turns out, is only a daydream).
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse } from '../engine/util';
import { drawKaraoke, mono, poseKeys, runPose } from './_ff';
import { applyCam, breath, camKeys, drawCounter, drawWorld, DOOR_X, person, S, SP, TRUE_DROP, walkPose, type Cam } from './_story';

type P2 = { x: number; y: number };

export default class Runup extends Scene {
  L = new Layer2D();
  l4!: Line; l5!: Line;

  override init() { const ly = this.ctx.lyrics; this.l4 = ly.lines[4]!; this.l5 = ly.lines[5]!; }

  /** A ghost's jump launched at t0 from the edge, landing at x1 on the lower ground after T s; feet position. */
  ghost(tb: number, t0: number, x1: number, T = 0.55): P2 & { u: number } {
    const u = (tb - t0) / T;
    const x0 = -10;
    if (u <= 0) return { x: x0, y: 0, u };
    if (u >= 1) return { x: x1, y: TRUE_DROP, u };
    const h = 120; // apex above the edge
    const y = lerp(0, TRUE_DROP, u) - 4 * h * u * (1 - u);
    return { x: lerp(x0, x1, u), y, u };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const w4 = this.l4.words, w5 = this.l5.words;
    const tSt = w4[6]!.start, tBe = w5[4]!.start;
    const open = prog(t, tBe, tBe + 0.6, ease.outCubic);
    const cam: Cam = camKeys(t, [[this.ctx.start, { x: 230, y: 20, z: 0.95 }], [end - 1.0, { x: 180, y: -10, z: 1.0 }], [end, { x: 60, y: -40, z: 1.25 }]]);
    c.save(); applyCam(c, cam);
    drawWorld(c, cam, { t, fear: 0, door: 0.25 + 0.75 * open * (1 - prog(t, tBe + 1.0, tBe + 1.4)), glow: 1.4 + open, dawn: 1, stars: 0 });
    // ghost 1: the worst — jumps on "is a", lands, trips on "stumble", sits
    const g1t = w4[4]!.start;
    if (t > g1t - 0.3 && t < w5[0]!.start + 0.3) {
      const a = prog(t, g1t - 0.3, g1t) * (1 - prog(t, w5[0]!.start - 0.2, w5[0]!.start + 0.3));
      const g = this.ghost(t, g1t, 230, tSt - g1t);
      const pose = g.u <= 0 ? SP.set : g.u < 1 ? SP.leap : poseKeys(t, [[0, SP.land], [tSt + 0.15, SP.stumble], [tSt + 0.6, SP.sit]], 0.15);
      const roll = g.u >= 1 ? prog(t, tSt + 0.05, tSt + 0.5, ease.outCubic) * 50 : 0;
      c.save(); c.globalAlpha = a;
      person(c, g.x + roll, g.y, S, pose, { color: rgba('ash', 0.9), sitting: t > tSt + 0.5 });
      person(c, g.x + roll, g.y, S * 0.965, pose, { color: rgba('ink', 1), sitting: t > tSt + 0.5 });
      c.restore();
      if (g.u >= 1) mono(c, 'WORST CASE: −1 (A STUMBLE)', g.x + roll - 40, TRUE_DROP + 40, { size: 13, color: rgba('ash', 0.9 * a), track: 3 });
    }
    // ghost 2: the best — jumps on "best", lands clean, walks into the light
    const g2t = w5[1]!.start;
    if (t > g2t - 0.3) {
      const a = prog(t, g2t - 0.3, g2t) * (1 - prog(t, end - 1.0, end - 0.6));
      const g = this.ghost(t, g2t, 300, 0.6);
      let x = g.x;
      let pose = g.u <= 0 ? SP.set : g.u < 1 ? SP.leap : SP.land;
      if (g.u >= 1 && t > g2t + 0.85) { const k = prog(t, g2t + 0.85, tBe + 0.6); x = lerp(300, DOOR_X + 40, k); pose = k < 1 ? walkPose(f.beat / 2) : SP.cheer; }
      c.save(); c.globalAlpha = a;
      person(c, x, g.y, S, pose, { color: rgba('ember', 0.95) });
      person(c, x, g.y, S * 0.965, pose, { color: rgba('ink', 1) });
      c.restore();
      if (open > 0) mono(c, 'BEST CASE: SOMETHING BEAUTIFUL', DOOR_X - 120, TRUE_DROP + 40, { size: 13, color: rgba('signal', open * a), track: 3 });
    }
    // the person: walks back from the edge (on the first line), watches, then sets and runs at the end
    const tSet = end - 1.25, tRun = end - 0.7;
    let px = -60, pose = SP.stand;
    const back = prog(t, this.ctx.start + 0.1, w4[3]!.start, ease.inOutQuad);
    px = lerp(-60, -560, back);
    if (back > 0 && back < 1) { pose = walkPose(-f.beat / 2); }
    else pose = breath(SP.stand, t, 0.6);
    if (t > tSet) pose = poseKeys(t, [[0, SP.stand], [tSet + 0.25, SP.set]], 0.25);
    if (t > tRun) { const k = prog(t, tRun, end, ease.inQuad); px = lerp(-560, -40, k); pose = runPose(f.beat, 0.35); }
    person(c, px, 0, S, pose, { dir: back > 0 && back < 1 ? -1 : 1 });
    c.restore();
    // the lyric
    const st = { family: F.archivo(112.5, 900), size: 74, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('signal', 1), lead: 0.4 } as const;
    const sw = prog(t, this.l5.start - 0.15, this.l5.start + 0.05);
    if (sw < 1) { c.save(); c.globalAlpha = 1 - sw; drawKaraoke(c, this.l4, 104, 170, t, st); c.restore(); }
    if (sw > 0) { c.save(); c.globalAlpha = sw; drawKaraoke(c, this.l5, 104, 170, t, st); c.restore(); }
    mono(c, 'RUN-UP: 4 STEPS', 104, 228, { size: 13, color: rgba('ash', 0.8 * prog(t, w4[3]!.start, w4[3]!.start + 0.4)), track: 4 });
    drawCounter(c, t, { alpha: 0.6 });
    comp.draw(renderer, L.upload(), out);
    const hit = pulse(t, tSt, 0.08) * 0.8 + pulse(t, tBe, 0.12) * 0.8 + prog(t, tRun, end) * 0.6;
    const sh = hit * 6;
    void clamp;
    return { bloom: 0.9, vignette: 0.3, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number], zoom: 1 + prog(t, tRun, end, ease.inQuad) * 0.06 };
  }
}
