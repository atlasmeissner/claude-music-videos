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
import { drawKaraoke, mono } from './_ff';
import { bodyKeys, jumpState, track, type Body } from './_body';
import { applyCam, breath, camKeys, drawCounter, drawWorld, DOOR_X, person, S, SP, TRUE_DROP, type Cam } from './_story';

export default class Runup extends Scene {
  L = new Layer2D();
  l4!: Line; l5!: Line;

  override init() { const ly = this.ctx.lyrics; this.l4 = ly.lines[4]!; this.l5 = ly.lines[5]!; }

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
    const ghostAt = (x: number, y: number, pose: Body, col: string, a: number, dir: 1 | -1 = 1) => {
      c.save(); c.globalAlpha = a;
      person(c, x, y, S, pose, { outline: col, dir, support: (wx) => (wx <= 0 ? 0 : TRUE_DROP) });
      c.restore();
    };
    const ghostAir = (x: number, y: number, pose: Body, col: string, a: number) => {
      c.save(); c.globalAlpha = a; person(c, x, y, S, pose, { outline: col, air: true }); c.restore();
    };
    // ghost 1: the worst — jumps, lands, the momentum carries on: a stumble, caught on the hands, sat down
    const g1t = w4[4]!.start;
    const air1 = clamp(tSt - g1t, 0.45, 0.66), take1 = tSt - air1;
    if (t > take1 - 0.7 && t < w5[0]!.start + 0.3) {
      const a = prog(t, take1 - 0.7, take1 - 0.4) * (1 - prog(t, w5[0]!.start - 0.2, w5[0]!.start + 0.3));
      const j = jumpState(t, { tTake: take1, air: air1, from: { x: -16, y: 0 }, to: { x: 214, y: TRUE_DROP }, apex: 36, crouch: 0.3 });
      if (j.mode === 'air') ghostAir(j.x, j.y, j.pose, rgba('ash', 0.9), a);
      else if (j.landed <= 0) ghostAt(j.x, 0, j.pose, rgba('ash', 0.9), a);
      else {
        const v = j.landed;
        const pose = bodyKeys(v, [[0, SP.reach], [0.08, SP.land], [0.3, SP.stumble], [0.52, SP.fours], [1.25, SP.sitGround]], 0.2);
        const x = 214 + 96 * ease.outCubic(clamp(v / 0.75));
        ghostAt(x, TRUE_DROP, pose, rgba('ash', 0.9), a);
        mono(c, 'WORST CASE: −1 (A STUMBLE)', x - 60, TRUE_DROP + 40, { size: 13, color: rgba('ash', 0.9 * a * prog(v, 0.3, 0.6)), track: 3 });
      }
    }
    // ghost 2: the best — jumps on "best", lands clean, walks into the light
    const g2t = w5[1]!.start;
    if (t > g2t - 0.7) {
      const a = prog(t, g2t - 0.7, g2t - 0.4) * (1 - prog(t, end - 1.0, end - 0.6));
      const j = jumpState(t, { tTake: g2t, air: 0.6, from: { x: -16, y: 0 }, to: { x: 300, y: TRUE_DROP }, apex: 70, crouch: 0.3 });
      if (j.mode === 'air') ghostAir(j.x, j.y, j.pose, rgba('ember', 0.95), a);
      else if (j.landed <= 0) ghostAt(j.x, 0, j.pose, rgba('ember', 0.95), a);
      else {
        const tw = g2t + 0.6 + 0.55;
        const tr = track(t, [{ at: tw, walk: DOOR_X + 40, dur: Math.max(0.8, tBe + 0.5 - tw), end: SP.cheer }], S, 300, j.pose);
        ghostAt(tr.x, TRUE_DROP, t < tw ? j.pose : tr.pose, rgba('ember', 0.95), a, tr.dir);
      }
      if (open > 0) mono(c, 'BEST CASE: SOMETHING BEAUTIFUL', DOOR_X - 120, TRUE_DROP + 40, { size: 13, color: rgba('signal', open * a), track: 3 });
    }
    // the person: turns and walks back from the edge (on the first line), turns, watches; then sets, and runs
    const tSet = end - 1.35, tRun = end - 0.85;
    const tr = track(t, [
      { at: this.ctx.start + 0.1, walk: -560, dur: w4[3]!.start - this.ctx.start - 0.1, face: -1 },
      { at: w4[3]!.start + 0.15, pose: SP.stand, face: 1, blend: 0.5 },
      { at: tSet, pose: SP.set, blend: 0.4 },
      { at: tRun, run: -40, dur: end - tRun, accel: true },
    ], S, -104, SP.breathe);
    person(c, tr.x, 0, S, breath(tr.pose, t, tr.moving ? 0 : 0.6), { dir: tr.dir, lift: tr.lift });
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
