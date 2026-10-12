// message — verse 2: "They said what if nobody answers / What if all your words get lost / But a whisper costs you
// nothing / And silence is the only cost".
// The goal has someone behind it. The person tries to say something instead of jumping.
//   A (line 11): the phone, close: a message typed, word by word, then deleted on "answers"; DRAFTS counts up.
//   B (line 12): wide: they fold the drafts into paper planes and throw them at the door; every one falls short into
//      the abyss.
//   C (line 13): a whisper — a small "hi" floats across the gap and reaches the door. Price tag: €0.00.
//   D (line 14): …but they don't send it. Silence: the days race past and the door's light dims. The only cost.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { drawKaraoke, mono } from './_ff';
import { bodyKeys } from './_body';
import { applyCam, breath, camKeys, daysAt, drawCounter, drawWorld, DOOR_X, dropAt, ledgeTop, M, person, S, SP, type Cam } from './_story';
import { drawPlane } from './letter-planes';
import { stamp } from './ledger-kit';

const DRAFTS = ['hey, this might be out of the blue, but', 'hi! long time. i was wondering if', 'so. i’ve been meaning to ask you'];
const FEAR = 0.35;

export default class Message extends Scene {
  L = new Layer2D();
  ls: Line[] = [];
  cuts: number[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    this.ls = [11, 12, 13, 14].map((i) => lyrics.lines[i]!);
    this.cuts = this.ls.map((l) => audio.timeOfBeat(Math.floor(audio.beatAt(l.words[0]!.start + 0.05))));
    this.cuts[0] = this.ctx.start;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    let k = 0; this.cuts.forEach((x, i) => { if (t >= x) k = i; });
    const line = this.ls[k]!;
    let hit = 0;
    const D = dropAt(FEAR);
    const dim = k === 3 ? prog(t, this.ls[3]!.words[1]!.start, this.ctx.end, ease.inOutCubic) : 0;
    if (k === 0) hit = this.phone(c, t);
    else {
      const cam: Cam = camKeys(t, [[this.cuts[1]!, { x: 560, y: 220, z: 0.55 }], [this.ctx.end, { x: 520, y: 200, z: 0.58 }]]);
      c.save(); applyCam(c, cam);
      drawWorld(c, cam, { t, fear: FEAR, door: 0.2, glow: 1.3 * (1 - 0.75 * dim), stars: 1 });
      // the person (standing now, a few steps from the edge): three throws — wind-up, release, follow-through;
      // the whisper; then sits back down, head on the arms
      const tl = this.ls[1]!.words;
      const throws = [tl[1]!.start, tl[3]!.start, tl[5]!.start];
      const PX = -60;
      let pose = breath(SP.stand, t, 0.6);
      if (k === 1) {
        for (const tt of throws) if (t > tt - 0.45 && t < tt + 0.75) pose = bodyKeys(t, [[tt - 0.45, SP.stand], [tt - 0.12, SP.throwBack], [tt + 0.06, SP.throwFwd], [tt + 0.7, SP.stand]], 0.26);
        // the planes: released from the hand toward the door, they arc, stall and spiral into the dark
        throws.forEach((tt, i) => {
          const u = t - tt;
          if (u < 0) return;
          const x = PX + 86 + 300 * u + 40 * Math.sin(u * 3 + i) * clamp(u * 2);
          const y = -1.0 * S - 160 * u + 0.5 * 520 * u * u;
          c.save(); c.globalAlpha = 1 - prog(u, 2.6, 3.2);
          drawPlane(c, x, y, 100, Math.atan2(-160 + 520 * u, 300) * 0.9 + Math.sin(u * 6) * 0.2);
          c.restore();
        });
      }
      if (k === 2) pose = breath(bodyKeys(t, [[0, SP.stand], [line.words[1]!.start, SP.breathe]], 0.5), t, 0.6);
      if (k === 3) pose = breath(bodyKeys(t, [[0, SP.stand], [this.cuts[3]! + 0.45, SP.squat], [this.cuts[3]! + 1.1, SP.huddleHunch]], 0.5), t, 0.4);
      if (k === 2) {
        // the whisper: a small "hi" floating across the gap, reaching the door
        const tw = line.words[2]!.start;
        const u = prog(t, tw, line.words[5]!.start + 0.2, ease.inOutCubic);
        if (t > tw) {
          const x = lerp(40, DOOR_X - 20, u), y = lerp(-0.85 * S, D - 1.6 * M, u) - Math.sin(u * Math.PI) * 140;
          c.font = font(F.serif(600, true), 84); c.fillStyle = rgba('bone', 0.95); c.textAlign = 'center';
          c.fillText('hi', x, y);
          for (let i = 1; i < 6; i++) { const uu = Math.max(0, u - i * 0.03); c.fillStyle = rgba('bone', 0.12); c.fillText('hi', lerp(40, DOOR_X - 20, uu), lerp(-0.85 * S, D - 1.6 * M, uu) - Math.sin(uu * Math.PI) * 140); }
        }
      }
      const back = k === 3 ? 40 * ease.inOutCubic(prog(t, this.cuts[3]! + 0.05, this.cuts[3]! + 0.75)) : 0; // sitting down, the weight goes back
      person(c, PX - back, 0, S, pose, { support: ledgeTop(D) });
      c.restore();
      if (k === 2) {
        const tc = line.words[3]!.start; // "costs"
        stamp(c, 1500, 330, ['COST: €0.00'], t, tc, { size: 34, rot: -0.08 });
      }
      if (k === 3) {
        const tc = line.words[line.words.length - 1]!.start; // "cost"
        mono(c, 'THE COST OF SILENCE', 1420, 300, { size: 13, color: rgba('ash', 0.85), track: 4 });
        mono(c, `${Math.max(0, daysAt(t) - 41)} DAYS`, 1420, 346, { size: 38, color: rgba('signal', 1), track: 2, weight: 500 });
        hit = pulse(t, tc, 0.1);
      }
      if (k === 1) mono(c, 'DRAFTS SENT: 0', 1420, 330, { size: 20, color: rgba('signal', 1), track: 3, weight: 500 });
    }
    drawKaraoke(c, line, 104, 170, t, { family: F.archivo(112.5, 900), size: 78, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('signal', 1), lead: 0.4 });
    drawCounter(c, t);
    comp.draw(renderer, L.upload(), out);
    const sh = hit * 7;
    void H; void TAU; void clamp;
    return { bloom: 0.6, vignette: 0.45, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number] };
  }

  /** A: the phone, close — drafts typed and deleted. */
  phone(c: CanvasRenderingContext2D, t: number) {
    const l = this.ls[0]!, w = l.words;
    const x0 = 620, y0 = 250, pw = 680, ph = 560;
    c.save();
    c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 3;
    c.fillStyle = rgba('ink2', 1);
    c.beginPath(); c.roundRect(x0, y0, pw, ph + 200, 60); c.fill(); c.stroke();
    c.fillStyle = rgba('bone', 0.95); c.beginPath(); c.roundRect(x0 + 24, y0 + 24, pw - 48, ph + 152, 40); c.fill();
    mono(c, 'NEW MESSAGE', x0 + 60, y0 + 96, { size: 16, color: rgba('ink', 0.7), track: 4, weight: 600 });
    mono(c, 'TO: the other side', x0 + 60, y0 + 136, { size: 18, color: rgba('ink', 1), track: 1 });
    c.strokeStyle = rgba('ink', 0.25); c.lineWidth = 1; c.beginPath(); c.moveTo(x0 + 60, y0 + 160); c.lineTo(x0 + pw - 60, y0 + 160); c.stroke();
    // which draft, how much of it typed (typed through the line, deleted fast at "answers")
    const tDel = w[w.length - 1]!.start;
    const span = (tDel - (this.ctx.start + 0.1)) / 2;
    const di = clamp(Math.floor((t - this.ctx.start - 0.1) / span), 0, 2);
    const td0 = this.ctx.start + 0.1 + di * span;
    const txt = DRAFTS[di]!;
    let n = Math.floor(prog(t, td0, td0 + span * 0.7) * txt.length);
    n -= Math.floor(prog(t, td0 + span * 0.78, td0 + span, ease.inQuad) * txt.length);
    if (t > tDel) n = Math.floor(prog(t, tDel + 0.4, this.cuts[1]! - 0.2) * txt.length);
    const shown = txt.slice(0, Math.max(0, n));
    c.font = font(F.mono(400), 34); c.fillStyle = rgba('ink', 1); c.textBaseline = 'alphabetic';
    // wrap at the screen width
    const words = shown.split(' ');
    let lineS = '', yy = y0 + 220;
    for (const wd of words) {
      const test = lineS ? lineS + ' ' + wd : wd;
      if (c.measureText(test).width > pw - 140) { c.fillText(lineS, x0 + 60, yy); yy += 50; lineS = wd; } else lineS = test;
    }
    c.fillText(lineS, x0 + 60, yy);
    if (frameIdx(t) % 30 < 18) { c.fillStyle = rgba('signal', 1); c.fillRect(x0 + 62 + c.measureText(lineS).width, yy - 30, 4, 38); }
    mono(c, `DRAFT ${di + 1 + (t > tDel ? 1 : 0)}`, x0 + 60, y0 + ph + 60, { size: 16, color: rgba('ink', 0.7), track: 3 });
    // the send button, never pressed
    c.fillStyle = rgba('ink', 0.12); c.beginPath(); c.roundRect(x0 + pw - 220, y0 + ph + 30, 150, 50, 25); c.fill();
    mono(c, 'SEND', x0 + pw - 145, y0 + ph + 62, { size: 16, color: rgba('ink', 0.35), track: 4, align: 'center', weight: 600 });
    // the imagined reply status
    const nr = prog(t, w[3]!.start, w[3]!.start + 0.3);
    mono(c, 'READ · NO REPLY', x0 + pw - 60, y0 + ph - 30, { size: 14, color: rgba('signal', nr * (1 - prog(t, tDel, tDel + 0.3))), track: 3, align: 'right' });
    c.restore();
    void W;
    return pulse(t, tDel, 0.08) * 0.6;
  }
}
