// crowd — the post-chorus chant ("yeah, yeah — oh, oh, oh…"), no words.
// After the freeze the person sits on the edge, head in hands. Below, people gather in front of the glowing door —
// one, then dozens — and start to chant: everyone jumps on the beat, a wave runs through them on every syllable
// (stamped big: YEAH, then OH), arms up, calling the person down. The person looks up, stands, starts to bounce with
// them, and by the end stands at the edge with both arms up. A year on the ledge: the counter passes 365.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse } from '../engine/util';
import { mixPose, mono, poseKeys } from './_ff';
import { applyCam, breath, camKeys, drawCounter, drawWorld, DOOR_X, dropAt, person, S, SP, type Cam } from './_story';

const FEAR = 0.15;
const N = 28;

export default class Crowd extends Scene {
  L = new Layer2D();
  sy: number[] = [];
  people: { x: number; s: number; arrive: number; seed: number; depth: number }[] = [];

  override init() {
    const au = this.ctx.audio;
    const ev = au.events('vocal', this.ctx.start + 0.5, this.ctx.end - 0.25).filter(([, s]) => s >= 0.3).map(([t]) => t);
    for (const t of ev) if (!this.sy.length || t - this.sy[this.sy.length - 1]! > 0.38) this.sy.push(t);
    for (let i = 0; i < N; i++) {
      const depth = hash(i, 5); // 0 = back row (smaller, dimmer)
      this.people.push({
        x: 140 + ((i + 0.5) / N + (hash(i, 1) - 0.5) * 0.03) * (DOOR_X + 1000 - 140), s: lerp(0.55, 0.8, depth),
        arrive: this.ctx.start + 0.3 + Math.pow(hash(i, 2), 1.6) * 7, seed: i, depth,
      });
    }
    this.people.sort((a, b) => a.depth - b.depth);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, s0 = this.ctx.start, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const D = dropAt(FEAR);
    const cam: Cam = camKeys(t, [[s0, { x: 560, y: 120, z: 0.6 }], [end - 3, { x: 520, y: 100, z: 0.64 }], [end, { x: 300, y: 20, z: 0.8 }]]);
    c.save(); applyCam(c, cam);
    drawWorld(c, cam, { t, fear: FEAR, door: 0.55, glow: 1.6, stars: 1 });
    // the crowd
    const bp = f.beatPhase;
    for (const p of this.people) {
      if (t < p.arrive) continue;
      const walkIn = prog(t, p.arrive, p.arrive + 1.2, ease.outCubic);
      const x = lerp(DOOR_X + 200, p.x, walkIn);
      // jump on the beat once they are in place; a bigger jump when the wave reaches them
      let h = walkIn >= 1 ? Math.max(0, Math.sin(Math.PI * clamp(bp * 1.6))) * 10 * (0.5 + 0.5 * hash(p.seed, 3)) : 0;
      let wave = 0;
      for (const ts of this.sy) {
        const tp = ts + Math.abs(x - DOOR_X) / 1400;
        const u = t - tp;
        if (u > 0 && u < 0.45) { wave = Math.max(wave, 1 - Math.abs(u / 0.45 - 0.5) * 2); h = Math.max(h, 4 * (u / 0.45) * (1 - u / 0.45) * 46); }
      }
      const pose = walkIn < 1 ? SP.stand : mixPose(SP.jump, SP.cheer, wave);
      const a = lerp(0.55, 1, p.depth);
      person(c, x, D - h, S * p.s, pose, { color: rgba(p.depth > 0.75 ? 'bone' : 'ash', a), dir: hash(p.seed, 7) > 0.5 ? 1 : -1 });
    }
    // the person on the ledge: head in hands → looks up → stands → bounces → arms up at the edge
    const tUp = this.sy[2] ?? s0 + 5, tStand = this.sy[4] ?? s0 + 8;
    let pose = breath(SP.hunch, t, 0.4), sitting = true, px = -170;
    if (t > tUp) pose = poseKeys(t, [[0, SP.hunch], [tUp + 0.4, SP.write]], 0.4);
    if (t > tStand) {
      sitting = false;
      const k = prog(t, tStand, tStand + 2.5, ease.inOutCubic);
      px = lerp(-170, -40, k);
      pose = poseKeys(t, [[0, SP.write], [tStand + 0.5, SP.stand], [end - 3.5, SP.stand], [end - 2.5, SP.cheer]], 0.5);
    }
    const bounce = !sitting ? Math.max(0, Math.sin(Math.PI * clamp(bp * 1.6))) * 8 * prog(t, tStand + 1.5, tStand + 3) : 0;
    person(c, px, -bounce, S, pose, { sitting });
    c.restore();
    // the chant, stamped
    const fam = F.archivo(125, 900);
    this.sy.forEach((ts, i) => {
      const age = t - ts;
      if (age < 0 || age > 0.75) return;
      const word = ts < 107.1 ? 'YEAH' : 'OH';
      const k = clamp(age / 0.1), fade = 1 - prog(age, 0.35, 0.75);
      const sz = 230 + 60 * hash(i, 4);
      const x = 900 + hash(i, 5) * 700, y = 230 + hash(i, 6) * 260;
      c.save(); c.globalAlpha = clamp(k * 3) * fade;
      c.font = font(fam, sz); c.letterSpacing = `${-sz * 0.03}px`; c.textAlign = 'center';
      c.fillStyle = i % 3 === 2 ? rgba('bone', 1) : rgba('signal', 1);
      c.translate(x, y + sz * 0.35); const s = 1 + 0.3 * (1 - ease.outBack(k, 2)); c.scale(s, s);
      c.fillText(word, 0, 0);
      c.restore();
    });
    const here = this.people.filter((p) => t > p.arrive + 0.5).length;
    mono(c, `PEOPLE AT THE DOOR  ${here}`, W - 104, 96, { size: 14, color: rgba('signal', 0.95), track: 4, align: 'right', weight: 500 });
    mono(c, 'ALL OF THEM JUMPED ONCE', W - 104, 124, { size: 12, color: rgba('ash', 0.8 * prog(t, s0 + 6, s0 + 7)), track: 4, align: 'right' });
    drawCounter(c, t);
    comp.draw(renderer, L.upload(), out);
    let hit = 0;
    for (const ts of this.sy) hit = Math.max(hit, pulse(t, ts, 0.07));
    const sh = hit * 6;
    return { bloom: 0.75, vignette: 0.4, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number], zoom: 1 + hit * 0.01 };
  }
}
