// measure — verse 1a: "They said count the cost before you leap / Measure twice and think it through".
// A (line 0): close on the person, sitting at the edge with a notebook. Beside them a bone-paper card fills with the
//    costs, one per word, each a reason not to (COULD FALL · COULD LOOK STUPID · WHAT WILL THEY SAY…), totalled.
// B (line 1): kneeling at the edge, they lower a tape measure into the dark; the camera follows it down. It never
//    finds the bottom. On "twice" it is reeled in and dropped again, longer. The readout counts metres, then "?".
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse } from '../engine/util';
import { drawKaraoke, mono, poseKeys, type Pose } from './_ff';
import { applyCam, breath, camKeys, drawCounter, drawWorld, M, person, S, SP, type Cam } from './_story';

const KNEEL: Pose = { torso: 0.62, head: 0.65, a1: 0.05, a2: 0.0, b1: -0.25, b2: 0.25, l1: 1.55, l2: -0.85, m1: 1.3, m2: -1.25, hip: 0.2 };
const COSTS = ['COULD FALL', 'COULD LOOK STUPID', 'WHAT WILL THEY SAY', 'BAD TIMING', 'NOT READY YET', 'IT’S LATE', 'MAYBE TOMORROW', 'ONE MORE LIST'];

export default class Measure extends Scene {
  L = new Layer2D();
  l0!: Line; l1!: Line;
  tB = 0;

  override init() {
    const { lyrics, audio } = this.ctx;
    this.l0 = lyrics.lines[0]!; this.l1 = lyrics.lines[1]!;
    this.tB = audio.timeOfBeat(Math.floor(audio.beatAt(this.l1.words[0]!.start + 0.05)));
  }

  /** Tape length (world px) at t: a first drop, reeled in on "twice", dropped again much longer. */
  tape(t: number) {
    const w = this.l1.words;
    const d1 = prog(t, this.tB + 0.15, w[1]!.start, ease.outCubic) * 820;
    if (t < w[1]!.start) return d1;
    const up = 1 - prog(t, w[1]!.start, w[1]!.start + 0.45, ease.inCubic);
    if (t < w[1]!.start + 0.5) return 820 * up;
    return prog(t, w[1]!.start + 0.55, this.ctx.end, (x) => 1 - Math.pow(1 - x, 1.6)) * 2600;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const st = { family: F.archivo(112.5, 900), size: 72, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('signal', 1), lead: 0.4 } as const;
    let hit = 0;
    if (t < this.tB) {
      // ---- A: the notebook and the list of costs
      const cam: Cam = camKeys(t, [[this.ctx.start, { x: -120, y: -110, z: 1.9 }], [this.tB, { x: -90, y: -120, z: 2.1 }]]);
      c.save(); applyCam(c, cam);
      drawWorld(c, cam, { t, fear: 1, door: 0.25, glow: 1.2 });
      const head = person(c, -150, 0, S, breath(SP.write, t, 0.5), { sitting: true });
      c.fillStyle = rgba('bone', 0.9); c.fillRect(head.x + 0.14 * S, head.y + 0.3 * S, 0.16 * S, 0.1 * S); // the notebook
      c.restore();
      // the card
      const w = this.l0.words;
      const cx = 1150, cy = 290, cw = 560;
      const ck = prog(t, this.ctx.start, this.ctx.start + 0.4, ease.outCubic);
      c.save(); c.globalAlpha = ck;
      c.fillStyle = rgba('bone', 1);
      c.fillRect(cx, cy, cw, 600);
      mono(c, 'THE COST OF LEAPING', cx + 34, cy + 52, { size: 15, color: rgba('ink', 1), track: 4, weight: 600 });
      c.strokeStyle = rgba('ink', 0.4); c.lineWidth = 1;
      c.beginPath(); c.moveTo(cx + 34, cy + 72); c.lineTo(cx + cw - 34, cy + 72); c.stroke();
      COSTS.forEach((s, i) => {
        const ti = w[Math.min(i, w.length - 1)]!.start + (i >= w.length ? (i - w.length + 1) * 0.2 : 0);
        if (t < ti) return;
        const k = prog(t, ti, ti + 0.1);
        c.globalAlpha = ck * k;
        mono(c, `${i + 1}. ${s}`, cx + 34, cy + 116 + i * 52, { size: 20, color: rgba('ink', 1), track: 2 });
        hit = Math.max(hit, pulse(t, ti, 0.05) * 0.3);
      });
      c.globalAlpha = ck;
      const n = COSTS.filter((_, i) => t >= w[Math.min(i, w.length - 1)]!.start).length;
      mono(c, `REASONS NOT TO: ${n}`, cx + 34, cy + 570, { size: 16, color: rgba('signal', 1), track: 3, weight: 600 });
      c.restore();
      drawKaraoke(c, this.l0, 104, 160, t, st);
    } else {
      // ---- B: the tape measure into the dark
      const len = this.tape(t);
      const cam: Cam = camKeys(t, [[this.tB, { x: 40, y: -60, z: 1.4 }], [this.tB + 1.4, { x: 140, y: 420, z: 0.8 }], [end, { x: 160, y: 1500, z: 0.62 }]]);
      c.save(); applyCam(c, cam);
      drawWorld(c, cam, { t, fear: 1, door: 0.25, glow: 1.2 });
      person(c, -60, 0, S, KNEEL, {});
      // the case at the hand, the tape down the face
      const hx = 26, hy = -12;
      c.fillStyle = rgba('signal', 1); c.fillRect(hx - 14, hy - 10, 28, 22);
      c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 3 / cam.z;
      c.beginPath(); c.moveTo(hx + 4, hy + 12); c.lineTo(hx + 4 + Math.sin(t * 2) * 3, hy + 12 + len); c.stroke();
      // ticks every 10 cm
      for (let y = 0; y < len; y += 0.1 * M) {
        const big = Math.round(y / (0.1 * M)) % 10 === 0;
        c.beginPath(); c.moveTo(hx + 4, hy + 12 + y); c.lineTo(hx + (big ? 14 : 9), hy + 12 + y); c.stroke();
      }
      c.fillStyle = rgba('bone', 1); c.fillRect(hx - 2, hy + 12 + len, 12, 6); // the hook
      c.restore();
      const m = len / M;
      mono(c, 'TAPE OUT', 1340, 400, { size: 13, color: rgba('ash', 0.85), track: 4 });
      const w1 = this.l1.words;
      const lost = t > w1[3]!.start; // "think"
      mono(c, lost ? `${m.toFixed(1)} m · NO BOTTOM` : `${m.toFixed(2)} m`, 1340, 444, { size: 36, color: rgba('signal', 1), track: 2, weight: 500 });
      if (t > w1[1]!.start) mono(c, 'ATTEMPT 2', 1340, 486, { size: 14, color: rgba('bone', 0.8), track: 4 });
      drawKaraoke(c, this.l1, 104, 160, t, st);
      hit = pulse(t, w1[1]!.start, 0.08);
    }
    drawCounter(c, t);
    comp.draw(renderer, L.upload(), out);
    const sh = hit * 8;
    void lerp; void font;
    return { bloom: 0.6, vignette: 0.45, frame: 1 - prog(t, this.ctx.start, this.ctx.start + 0.5, ease.inCubic), shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number] };
  }
}
