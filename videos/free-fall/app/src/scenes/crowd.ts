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
import { clamp, ease, frameIdx, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { mixCss, mono } from './_ff';
import { BP, crowdDance, gravity, hopState, mixBody, track } from './_body';
import { applyCam, breath, camKeys, drawCounter, drawWorld, DOOR_X, dropAt, ledgeTop, person, S, type Cam } from './_story';

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
    // the crowd: each walks in from behind the door, turns to face the ledge, and dances — each in their own way
    // (hopping, fist-pumping, swaying, clapping, side-stepping), loosely in time, more and more as the chant builds —
    // and, when a chant wave reaches them, everyone jumps (real gravity: crouch, push, flight, soft landing)
    const bp = f.beatPhase;
    const dip = 0.5 + 0.5 * Math.cos(TAU * bp); // the groove (for the person on the ledge)
    const energy = 0.35 + 0.65 * prog(t, s0 + 2, end - 5, ease.inOutQuad);
    for (const p of this.people) {
      if (t < p.arrive) continue;
      const h = S * p.s;
      const x0 = DOOR_X + 200, dur = Math.abs(p.x - x0) / (0.75 * h);
      const tr = track(t, [{ at: p.arrive, walk: p.x, dur }, { at: p.arrive + dur + 0.1, pose: BP.standFront, face: hash(p.seed, 7) > 0.5 ? 1 : -1, blend: 0.5 }], h, x0, BP.stand, -1);
      const tIn = p.arrive + dur + 0.5;
      let pose = tr.pose, lift = 0, dx = 0;
      if (t > tIn) {
        const dn = crowdDance(t, f.beat, p.seed, h, energy * prog(t, tIn, tIn + 2.5));
        const k = ease.inOutCubic(prog(t, tIn, tIn + 0.8));
        pose = mixBody(tr.pose, dn.pose, k); lift = dn.lift * k; dx = dn.dx * k;
        let tp = -1;
        const hh = (0.12 + 0.08 * hash(p.seed, 4)) * h, airT = 2 * Math.sqrt((2 * hh) / gravity(h));
        // a jump per wave, skipping a wave that comes while still in the air from the last one
        for (const ts of this.sy) { const tt = ts + Math.abs(p.x - DOOR_X) / 1400 + (hash(p.seed, 6) - 0.5) * 0.06; if (tt - 0.2 <= t && (tp < 0 || tt > tp + airT + 0.35)) tp = tt; }
        if (tp > 0 && t < tp + airT + 0.3) { const hs = hopState(t, tp, hh, h, pose); pose = hs.pose; lift = Math.max(lift * (1 - clamp((t - tp + 0.16) / 0.16)), hs.lift / h); }
      }
      const col = mixCss(rgba('ink', 1), rgba(p.depth > 0.75 ? 'bone' : 'ash', 1), lerp(0.55, 1, p.depth));
      person(c, tr.x + dx, D, h, pose, { color: col, dir: tr.dir, lift });
    }
    // the person on the ledge: head down on the arms → looks up → gets up → walks to the edge → grooves with them,
    // hopping with the last chants, arms up
    const tUp = this.sy[2] ?? s0 + 5, tStand = this.sy[4] ?? s0 + 8;
    const tr = track(t, [
      { at: tUp, pose: BP.huddleUp, blend: 0.6 },
      { at: tStand - 0.1, pose: BP.squat, blend: 0.5 },
      { at: tStand + 0.4, pose: BP.stand, blend: 0.55 },
      { at: tStand + 1.1, walk: -40, dur: 1.6 },
      { at: tStand + 2.8, pose: BP.standFront, blend: 0.5 },
    ], S, -160, BP.huddleHunch);
    let pose = tr.moving ? tr.pose : breath(tr.pose, t, 0.5), lift = 0;
    if (t > tStand + 3.2) {
      const up = prog(t, end - 3.5, end - 2.5, ease.inOutCubic);
      pose = mixBody(mixBody(BP.standFront, BP.cheer, up), BP.hopCrouch, dip * 0.25 * prog(t, tStand + 3.2, tStand + 4));
      let last = -1;
      for (const x of this.sy) if (x > end - 3.5 && x <= t + 0.2 && (last < 0 || x > last + 0.85)) last = x;
      if (last > 0) { const hs = hopState(t, last, 0.12 * S, S, pose); pose = hs.pose; lift = hs.lift / S; }
    }
    person(c, tr.x, 0, S, pose, { dir: tr.dir, lift, support: ledgeTop(D) });
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
