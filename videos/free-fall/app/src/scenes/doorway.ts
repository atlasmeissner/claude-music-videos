// doorway — pre-chorus 2: "The door says no or the door swings wide / Either way I'm on the other side".
// The person stands at the edge and plays the two outcomes out.
//   Line 1: "says no" — a prohibition sign slams onto the shut door and its light dims; "swings wide" — the sign
//   falls away and the leaf swings open, light pouring out.
//   Line 2: split screen. Left: NO — an ember ghost of the person stands at the shut door. Right: WIDE — the ghost
//   walks in. Both are down there, past the drop: OTHER SIDE, either way. On the held "side" the split closes and the
//   person walks back to take a run-up and sets — straight into chorus 2.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse } from '../engine/util';
import { drawKaraoke, drawNo, mono, poseKeys } from './_ff';
import { applyCam, breath, camKeys, drawCounter, drawWorld, DOOR_X, dropAt, M, person, S, SP, walkPose, type Cam } from './_story';
import { stamp } from './ledger-kit';

const FEAR = 0.3;

export default class Doorway extends Scene {
  L = new Layer2D();
  l15!: Line; l16!: Line;

  override init() { const ly = this.ctx.lyrics; this.l15 = ly.lines[15]!; this.l16 = ly.lines[16]!; }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const w15 = this.l15.words, w16 = this.l16.words;
    const tNo = w15[3]!.start, tOr = w15[4]!.start, tWide = w15[8]!.start, tSide = w16[6]!.start;
    const D = dropAt(FEAR);
    const split = prog(t, this.l16.start - 0.15, this.l16.start + 0.25, ease.inOutCubic) * (1 - prog(t, tSide + 1.0, tSide + 1.6, ease.inOutCubic));
    // the person on the ledge: watching; after the split, walks back for the run-up and sets
    const tBack = tSide + 1.3, tSet = end - 0.7;
    const personAt = (): { x: number; pose: ReturnType<typeof breath>; dir: 1 | -1 } => {
      if (t < tBack) return { x: -40, pose: breath(t > tSide ? SP.breathe : SP.stand, t, 0.6), dir: 1 };
      const k = prog(t, tBack, tSet, ease.inOutQuad);
      if (k < 1) return { x: lerp(-40, -520, k), pose: walkPose(-f.beat / 2), dir: -1 };
      return { x: -520, pose: poseKeys(t, [[0, SP.stand], [tSet + 0.3, SP.set]], 0.3), dir: 1 };
    };
    const pa = personAt();
    // one view of the world with a given door state and ghost
    const view = (cam: Cam, open: number, noSign: number, ghost: { x: number; pose: ReturnType<typeof breath>; a: number } | null) => {
      c.save(); applyCam(c, cam);
      drawWorld(c, cam, { t, fear: FEAR, door: open, glow: 0.4 + 1.2 * open + 0.5 * (1 - noSign), stars: 1 });
      if (noSign > 0) drawNo(c, DOOR_X + 0.47 * M, D - 1.2 * M, 0.38 * M * noSign, 1);
      if (ghost && ghost.a > 0) {
        c.save(); c.globalAlpha = ghost.a;
        person(c, ghost.x, D, S, ghost.pose, { color: rgba('ember', 0.95) });
        person(c, ghost.x, D, S * 0.965, ghost.pose, { color: rgba('ink', 1) });
        c.restore();
      }
      person(c, pa.x, 0, S, pa.pose, { dir: pa.dir });
      c.restore();
    };
    if (split < 0.001) {
      const open = t < tOr ? 0 : prog(t, tWide - 0.05, tWide + 0.5, ease.outBack) * (1 - prog(t, this.l16.start - 0.3, this.l16.start)) + (t > tSide + 1.2 ? 0.25 : 0);
      const noSign = t < tNo - 0.02 ? 0 : clamp(1 - prog(t, tOr, tOr + 0.3)) * ease.outBack(clamp((t - tNo) / 0.15), 2);
      const cam: Cam = t < tBack ? camKeys(t, [[this.ctx.start, { x: 420, y: 230, z: 0.62 }], [this.l16.start, { x: 460, y: 240, z: 0.66 }]]) : camKeys(t, [[tBack, { x: 200, y: 120, z: 0.7 }], [end, { x: -200, y: 40, z: 0.95 }]]);
      view(cam, Math.min(1, open), noSign, null);
    } else {
      // split screen: NO (left) | WIDE (right); each half sees ledge, gap and door
      const cam: Cam = { x: 420, y: 330, z: 0.5 };
      const half = W / 2;
      for (const side of [0, 1]) {
        c.save();
        const x0 = side === 0 ? 0 : half + (1 - split) * half, x1 = side === 0 ? half - (1 - split) * half : W;
        c.beginPath(); c.rect(x0, 0, x1 - x0, H); c.clip();
        c.translate(side === 0 ? -half / 2 * split : half / 2 * split, 0);
        const gk = prog(t, w16[0]!.start, w16[2]!.start, ease.outCubic);
        const gx = side === 0 ? lerp(140, DOOR_X - 140, gk) : lerp(140, DOOR_X + 40, prog(t, w16[0]!.start, tSide, ease.inOutCubic));
        const gpose = side === 0 ? (gk < 1 ? walkPose(f.beat / 2) : breath(SP.stand, t)) : (prog(t, w16[0]!.start, tSide) < 1 ? walkPose(f.beat / 2) : SP.cheer);
        view(cam, side === 0 ? 0 : 1, side === 0 ? 1 : 0, { x: gx, pose: gpose, a: prog(t, w16[0]!.start - 0.2, w16[0]!.start + 0.2) });
        c.restore();
        mono(c, side === 0 ? 'IF THE DOOR SAYS NO' : 'IF IT SWINGS WIDE', side === 0 ? 104 : half + 60, 300, { size: 15, color: rgba(side === 0 ? 'ash' : 'signal', 0.9 * split), track: 5 });
      }
      c.fillStyle = rgba('bone', 0.9 * split); c.fillRect(half - 1, 0, 2, H);
      if (t > tSide) {
        stamp(c, half / 2, 820, ['OTHER SIDE'], t, tSide, { size: 32, rot: -0.08 });
        stamp(c, half * 1.5, 820, ['OTHER SIDE'], t, tSide + 0.1, { size: 32, rot: 0.06 });
      }
    }
    // the lyric
    const st = { family: F.archivo(112.5, 900), size: 76, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('signal', 1), lead: 0.4 } as const;
    const sw = prog(t, this.l16.start - 0.15, this.l16.start + 0.05);
    if (sw < 1) { c.save(); c.globalAlpha = 1 - sw; drawKaraoke(c, this.l15, 104, 170, t, st); c.restore(); }
    if (sw > 0) { c.save(); c.globalAlpha = sw; drawKaraoke(c, this.l16, 104, 170, t, st); c.restore(); }
    if (t > tBack) mono(c, 'RUN-UP', W - 104, 96, { size: 13, color: rgba('signal', 0.9), track: 6, align: 'right' });
    drawCounter(c, t);
    comp.draw(renderer, L.upload(), out);
    const hit = pulse(t, tNo, 0.08) + pulse(t, tWide, 0.1) * 0.7 + pulse(t, tSide, 0.1) * 0.6;
    const sh = hit * 7;
    return { bloom: 0.7, vignette: 0.4, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number] };
  }
}
