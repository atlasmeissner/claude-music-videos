// reveal — verse 1b: "But the cliff is only shoulder-high / And the sky is screaming blue".
// The turn. The tape hits something. On "cliff" the abyss collapses: the lower ground rises out of the dark until the
// drop is what it always was — 1.40 m. A hairline outline of the person stands on the lower ground beside the face:
// the ledge's edge is at their shoulder. Dimensioned, stamped. Then dawn: the horizon ignites (engraved orange, the
// only colour we have), the door is right there across the gap, and the person stands up into the light; BLUE is
// set huge and held.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse } from '../engine/util';
import { drawKaraoke, mono, wordColor } from './_ff';
import { track } from './_body';
import { applyCam, breath, camKeys, drawCounter, drawWorld, dropAt, ledgeTop, M, person, S, SP, TRUE_DROP, type Cam } from './_story';
import { stamp } from './ledger-kit';

export default class Reveal extends Scene {
  L = new Layer2D();
  l2!: Line; l3!: Line;
  tB = 0;

  override init() {
    const { lyrics, audio } = this.ctx;
    this.l2 = lyrics.lines[2]!; this.l3 = lyrics.lines[3]!;
    this.tB = audio.timeOfBeat(Math.floor(audio.beatAt(this.l3.words[0]!.start + 0.05)));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const w2 = this.l2.words, w3 = this.l3.words;
    const tCliff = w2[2]!.start, tSh = w2[5]!.start;
    const fear = 1 - prog(t, tCliff - 0.1, tSh + 0.25, ease.inOutCubic);
    const D = dropAt(fear);
    const dawn = prog(t, w3[2]!.start - 0.2, w3[5]!.start + 0.3, ease.inOutCubic);
    // camera: from down in the dark (where the tape was) up to a two-shot of ledge and door, then wide for dawn
    const cam: Cam = camKeys(t, [
      [this.ctx.start, { x: 160, y: 1350, z: 0.6 }],
      [tCliff, { x: 160, y: 900, z: 0.62 }],
      [tSh + 0.3, { x: 260, y: 60, z: 1.05 }],
      [this.tB, { x: 300, y: 40, z: 1.1 }],
      [end, { x: 420, y: -40, z: 0.82 }],
    ]);
    c.save(); applyCam(c, cam);
    drawWorld(c, cam, { t, fear, door: 0.25 + 0.15 * dawn, glow: 1.2 + 0.4 * dawn, dawn, stars: 1 });
    // the tape, lying from the case to the (rising) ground
    c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 3 / cam.z;
    c.beginPath(); c.moveTo(30, 0); c.lineTo(30, D); c.stroke();
    c.fillStyle = rgba('signal', 1); c.fillRect(16, -22, 28, 22);
    // the person: kneeling at the edge → stands up → (dawn) breathes in, chin up
    // (kneeling at the edge → sits up on one knee, looking down at it → stands → breathes in, chin up)
    const tr = track(t, [
      { at: tSh + 0.1, pose: SP.kneelUp, x: -92, blend: 0.7 },
      { at: this.tB - 0.35, pose: SP.stand, x: -104, blend: 0.75 },
      { at: w3[5]!.start - 0.2, pose: SP.breathe, blend: 0.6 },
    ], S, -64, SP.kneelTape);
    person(c, tr.x, 0, S, breath(tr.pose, t, 0.6), { support: ledgeTop(D) });
    // the outline on the lower ground: the drop is shoulder-high
    const ok = prog(t, tSh - 0.1, tSh + 0.4, ease.outCubic);
    if (ok > 0) {
      c.save(); c.globalAlpha = ok * (1 - 0.6 * dawn);
      person(c, 110, D, S, SP.stand, { outline: rgba('ash', 0.9) });
      // shoulder line and dimension
      c.setLineDash([8, 6]); c.strokeStyle = rgba('signal', 1); c.lineWidth = 2 / cam.z;
      c.beginPath(); c.moveTo(-40, 0); c.lineTo(200, 0); c.stroke(); c.setLineDash([]);
      c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 1.5 / cam.z;
      const dx = 260;
      c.beginPath(); c.moveTo(dx, 0); c.lineTo(dx, D); c.stroke();
      for (const [y, d] of [[0, 1], [D, -1]] as const) { c.fillStyle = rgba('bone', 0.9); c.beginPath(); c.moveTo(dx, y); c.lineTo(dx - 6, y + d * 14); c.lineTo(dx + 6, y + d * 14); c.closePath(); c.fill(); }
      c.restore();
    }
    c.restore();
    if (ok > 0) {
      const p = { x: (260 - cam.x) * cam.z + 960, y: (D / 2 - cam.y) * cam.z + 540 };
      mono(c, `${(D / M).toFixed(2)} m`, p.x + 16, p.y + 8, { size: 26, color: rgba('bone', ok), track: 2, weight: 500 });
      mono(c, 'SHOULDER HEIGHT, ADULT', p.x + 16, p.y + 36, { size: 12, color: rgba('ash', 0.8 * ok), track: 3 });
    }
    stamp(c, 1500, 330, ['ONLY', 'SHOULDER-HIGH'], t, tSh + 0.5, { size: 26, rot: -0.1 });
    // the fear readout falling with the ground
    if (t < this.tB) {
      mono(c, 'DROP', 1340, 860, { size: 13, color: rgba('ash', 0.85), track: 4 });
      mono(c, fear > 0.02 ? `${(D / M).toFixed(1)} m` : '1.40 m', 1340, 904, { size: 36, color: rgba('signal', 1), track: 2, weight: 500 });
    }
    // the lyric
    const st = { family: F.archivo(112.5, 900), size: 76, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.18), active: rgba('signal', 1), lead: 0.4 } as const;
    if (t < this.tB) drawKaraoke(c, this.l2, 104, 170, t, st);
    else {
      const sub: Line = { ...this.l3, words: w3.slice(0, 5), text: w3.slice(0, 5).map((x) => x.w).join(' '), end: w3[4]!.end };
      drawKaraoke(c, sub, 104, 170, t, st);
      const blue = w3[5]!;
      const k = prog(t, blue.start, blue.start + 0.5, ease.outBack);
      if (t > this.l3.start - 0.4) {
        c.save();
        c.font = font(F.archivo(125, 900), 230); c.letterSpacing = `${lerp(-6, 40, clamp(k))}px`;
        c.fillStyle = t < blue.start ? rgba('bone', 0.14) : wordColor(blue, t);
        c.translate(104, 420); c.scale(1 + 0.15 * k, 1 + 0.15 * k);
        c.fillText('BLUE', 0, 0);
        c.restore();
      }
    }
    drawCounter(c, t, { alpha: 1 - dawn * 0.5 });
    comp.draw(renderer, L.upload(), out);
    const hit = pulse(t, tSh + 0.5, 0.1) + pulse(t, w3[5]!.start, 0.15) * 0.8;
    const sh = hit * 7;
    return { bloom: 0.6 + 0.4 * dawn, vignette: 0.45 - 0.2 * dawn, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number], zoom: 1 + hit * 0.01 };
  }
}
