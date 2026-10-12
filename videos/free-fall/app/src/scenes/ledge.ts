// ledge — the intro. Crop-marked (the bookend). Night. Far below and across a gap, a doorway glows orange: the
// goal. Between them the drop looks bottomless, because that is how it feels (fear = 1).
//   A (wide): a tiny person sitting on the edge of a huge cliff, a tiny light far below. A slow push in.
//   B (close): on the downbeats — head in hands; stands up; walks to the edge; peers over…
//   C (POV): …the abyss, the door a speck at the bottom; vertigo push.
//   D: recoils, steps back, sits down again and takes out the phone. The stomps land the title (FREE · FALL ·
//      JOBURGALEX) and the counter starts: DAYS ON THE LEDGE 1.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, frameIdx, hash, prog, pulse } from '../engine/util';
import { bigWord, mono } from './_ff';
import { track } from './_body';
import { applyCam, breath, camKeys, drawCounter, drawPhone, drawWorld, dropAt, ledgeTop, person, S, SP, type Cam } from './_story';

export default class Ledge extends Scene {
  L = new Layer2D();
  db: number[] = [];
  stomps: number[] = [];

  override init() {
    const au = this.ctx.audio;
    this.db = au.downbeats.filter((d) => d < this.ctx.end + 0.1);
    this.stomps = au.events('kick', 19.6, this.ctx.end + 0.1).filter(([, s]) => s >= 0.8).map(([t]) => t);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, db = this.db;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const D = dropAt(1);
    // ---- the camera
    const wide: Cam = { x: 700, y: D * 0.43, z: 0.33 };
    const wide2: Cam = { x: 420, y: D * 0.36, z: 0.42 };
    const close: Cam = { x: -60, y: -150, z: 1.55 };
    const pov: Cam = { x: 260, y: D * 0.55, z: 0.5 };
    const povIn: Cam = { x: 300, y: D * 0.62, z: 0.78 };
    const tB = db[5]!, tC = db[8]!, tD = db[9]!, tE = db[11]!; // 9.41, 14.42, 16.09, 19.43
    let cam: Cam;
    if (t < tB) cam = camKeys(t, [[db[0]! - 0.6, wide], [tB, wide2]]);
    else if (t < tC) cam = camKeys(t, [[tB, close], [tC, { x: -20, y: -140, z: 1.7 }]]);
    else if (t < tD) cam = camKeys(t, [[tC, pov], [tD, povIn]]);
    else if (t < tE) cam = camKeys(t, [[tD, { x: -120, y: -150, z: 1.45 }], [tE, { x: -80, y: -130, z: 1.5 }]]);
    else cam = camKeys(t, [[tE, { x: -480, y: 60, z: 0.95 }], [this.ctx.end, { x: -500, y: 40, z: 1.02 }]]);
    const fadeIn = prog(t, db[0]! - 0.4, db[0]! + 1.6, ease.inOutCubic);
    c.save();
    c.globalAlpha = fadeIn;
    applyCam(c, cam);
    drawWorld(c, cam, { t, fear: 1, door: 0.25, glow: 1.2, dawn: 0, stars: 1 });
    // ---- the person: sitting on the edge → head in hands → up onto one knee → stands → walks to the edge → peers →
    // recoils, steps back → sits down on the rock, away from the edge, and takes out the phone
    const bt = (i: number) => db[i]!;
    const tr = track(t, [
      { at: bt(5) - 0.5, pose: SP.hunch, blend: 0.7 },
      { at: bt(6) - 1.1, pose: SP.kneelUp, x: -96, blend: 0.8 },
      { at: bt(6) - 0.2, pose: SP.stand, x: -112, blend: 0.7 },
      { at: bt(6) + 0.25, walk: -236, dur: 1.3, face: -1 }, // pacing
      { at: bt(7), walk: -34, dur: 1.2, face: 1 },
      { at: bt(7) + 1.15, pose: SP.peer, blend: 0.45 },
      { at: tD, pose: SP.recoil, blend: 0.14 },
      { at: tD + 0.22, walk: -190, dur: 0.85, back: true, face: 1, end: SP.stand },
      { at: bt(10) - 0.75, pose: SP.squat, blend: 0.45 },
      { at: bt(10) - 0.3, pose: SP.huddle, blend: 0.55 },
    ], S, -18, SP.sit);
    const pose = breath(tr.pose, t, tr.moving ? 0 : 0.6);
    const me = person(c, tr.x, 0, S, pose, { dir: tr.dir, support: ledgeTop(D), lift: tr.lift });
    // the phone, lit, in the hands
    if (t >= bt(10)) drawPhone(c, me, prog(t, bt(10) + 0.2, bt(10) + 0.6));
    c.restore();
    // ---- deadpan annotation in the wide shot, the POV readout
    if (t < tB) mono(c, 'THE GOAL', 960 + (900 - cam.x) * cam.z, 540 + (dropAt(1) - 380 - cam.y) * cam.z, { size: 12, color: rgba('ash', 0.8 * fadeIn * prog(t, 4, 5)), track: 5 });
    if (t >= tC && t < tD) {
      const k = prog(t, tC + 0.2, tC + 0.6);
      mono(c, 'DROP (ESTIMATED)', 1300, 220, { size: 13, color: rgba('ash', 0.85 * k), track: 4 });
      mono(c, `${(18 + (t - tC) * 60).toFixed(0)} m?`, 1300, 262, { size: 34, color: rgba('signal', k), track: 2, weight: 500 });
    }
    // ---- the title on the stomps
    const st = this.stomps;
    const slam = (t0: number) => clamp((t - t0) / 0.12);
    if (st[0] && t > st[0] - 0.02) { const k = slam(st[0]); const s = 1 + 0.25 * (1 - ease.outBack(k, 2)); bigWord(c, 'FREE', 120, 330, 240, { align: 'left', sx: s, sy: s, alpha: clamp(k * 3) }); }
    if (st[1] && t > st[1] - 0.02) { const k = slam(st[1]); const s = 1 + 0.25 * (1 - ease.outBack(k, 2)); bigWord(c, 'FALL', 120, 555, 240, { align: 'left', color: rgba('signal', 1), sx: s, sy: s, alpha: clamp(k * 3) }); }
    if (st[2] && t > st[2] - 0.02) {
      const k = prog(t, st[2], st[2] + 0.5, ease.outCubic);
      c.save(); c.globalAlpha = k;
      c.font = font(F.mono(500), 22); c.letterSpacing = '14px'; c.fillStyle = rgba('bone', 0.95);
      c.fillText('JOBURGALEX', 128, 632);
      c.restore();
      mono(c, 'MAPS & TERRITORY', 128, 668, { size: 13, color: rgba('ash', 0.8 * k), track: 5 });
    }
    if (st[3]) drawCounter(c, t, { alpha: prog(t, st[3], st[3] + 0.4) });
    comp.draw(renderer, L.upload(), out);
    let hit = 0;
    for (const s of st) hit = Math.max(hit, pulse(t, s, 0.12));
    hit = Math.max(hit, pulse(t, tC, 0.1) * 0.6, pulse(t, tD, 0.08) * 0.8);
    const sh = hit * 7;
    void hash;
    return { bloom: 0.6, vignette: 0.45, frame: 1, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number], zoom: 1 + hit * 0.01 };
  }
}
