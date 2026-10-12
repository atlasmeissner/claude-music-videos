// through — the last "Free fall, free fall" and the outro.
// Through the door: the frame is light. Then a long pull-back from the doorway reveals the whole place, small: the
// ledge, the true drop, the crowd, the lit door with the person in it. The readouts land one per downbeat — DROP
// 1.40 m · TIME IN THE AIR 0.53 s · TIME ON THE LEDGE 412 DAYS — then the title. In the last seconds the crop-mark
// frame closes back in and everything else goes dark: the video's first frame, so it loops.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, hash, lerp, prog, pulse } from '../engine/util';
import { bigWord, mono, wordColor } from './_ff';
import { applyCam, camKeys, drawWorld, DOOR_X, M, person, S, SP, TRUE_DROP, type Cam } from './_story';

export default class Through extends Scene {
  L = new Layer2D();
  l!: Line;
  D: number[] = [];

  override init() {
    this.l = this.ctx.lyrics.lines[31]!;
    this.D = this.ctx.audio.downbeats.filter((d) => d >= this.ctx.start - 0.01);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, s0 = this.ctx.start, end = this.ctx.end, D = this.D;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const gone = 1 - prog(t, end - 3.4, end - 1.3, ease.inOutCubic);
    const frame = prog(t, end - 3.4, end - 1.1, ease.inOutCubic);
    // the light: the frame starts flooded (inside the doorway) and the pull-back reveals the scene
    const pull = prog(t, s0, D[3]! + 0.5, ease.inOutCubic);
    const cam: Cam = camKeys(t, [[s0, { x: DOOR_X + 0.47 * M, y: TRUE_DROP - 1.1 * M, z: 2.4 }], [D[3]! + 0.5, { x: 300, y: 80, z: 0.62 }], [end, { x: 280, y: 60, z: 0.58 }]]);
    c.save(); c.globalAlpha = gone; applyCam(c, cam);
    drawWorld(c, cam, { t, fear: 0, door: 1, glow: 3.2, dawn: 1, stars: 0 });
    // the crowd, small, and the person in the doorway (a silhouette against the light)
    for (let i = 0; i < 12; i++) {
      const bx = DOOR_X - 520 + ((i + 0.5) / 12) * 1300 + (hash(i, 1) - 0.5) * 40;
      if (Math.abs(bx - (DOOR_X + 0.47 * M)) < 90) continue;
      const h = Math.max(0, Math.sin(Math.PI * clamp(f.beatPhase * 1.6))) * 10 * hash(i, 3);
      person(c, bx, TRUE_DROP - h, S * (0.58 + 0.17 * hash(i, 4)), SP.cheer, { color: rgba('ash', 0.8), dir: hash(i, 7) > 0.5 ? 1 : -1 });
    }
    person(c, DOOR_X + 0.47 * M, TRUE_DROP, S, SP.cheer, { color: rgba('ink', 1) });
    // the dimension of the drop, drawn in as the ledge comes into view
    const dk = prog(t, D[2]!, D[2]! + 0.8, ease.outCubic);
    if (dk > 0) {
      c.strokeStyle = rgba('bone', 0.9 * dk); c.lineWidth = 2 / cam.z;
      c.beginPath(); c.moveTo(-160, 0); c.lineTo(-160, TRUE_DROP * dk); c.stroke();
      c.setLineDash([8 / cam.z, 6 / cam.z]); c.beginPath(); c.moveTo(-200, TRUE_DROP); c.lineTo(0, TRUE_DROP); c.stroke(); c.setLineDash([]);
    }
    c.restore();
    // the white-out at the start (inside the light), clearing as we pull back
    const white = 1 - prog(t, s0, s0 + 1.6, ease.inOutCubic);
    if (white > 0) { c.fillStyle = rgba('ember', 0.85 * white); c.fillRect(0, 0, W, 1080); }
    c.save(); c.globalAlpha = gone;
    // the last "Free fall, free fall" — two words at a time, centred, gentle
    const w = this.l.words;
    const pair = t < w[2]!.start - 0.1 ? 0 : 2;
    if (t < w[3]!.end + 1.2) {
      for (let i = pair; i < pair + 2; i++) {
        const wd = w[i]!;
        if (t < wd.start - 0.05) continue;
        const k = prog(t, wd.start, wd.start + 0.3, ease.outCubic);
        c.save(); c.globalAlpha *= k * (1 - prog(t, (pair === 0 ? w[2]!.start : w[3]!.end + 0.6) - 0.3, (pair === 0 ? w[2]!.start : w[3]!.end + 1.2)));
        c.font = font(F.archivo(125, 900), 200); c.letterSpacing = '-6px'; c.textAlign = 'center';
        c.fillStyle = wordColor(wd, t, rgba(white > 0.4 ? 'ink' : 'bone', 1));
        c.fillText(wd.w.toUpperCase(), W / 2 + (i % 2 ? 330 : -330), 300);
        c.restore();
      }
    }
    // readouts, one per downbeat
    const ro: [string, string][] = [['DROP', '1.40 m'], ['TIME IN THE AIR', '0.53 s'], ['TIME ON THE LEDGE', '412 DAYS'], ['WORTH IT', 'YES']];
    ro.forEach(([a, b], i) => {
      const tr = D[3 + i]!;
      const k = prog(t, tr, tr + 0.3, ease.outCubic);
      if (k <= 0) return;
      c.save(); c.globalAlpha *= k * (1 - prog(t, D[8]! - 0.3, D[8]!));
      mono(c, a, 104 + i * 430, 880, { size: 13, color: rgba('ash', 0.9), track: 4 });
      mono(c, b, 104 + i * 430, 926, { size: 36, color: rgba(i === 3 ? 'signal' : 'bone', 1), track: 2, weight: 500 });
      c.restore();
    });
    // the title
    const kt = prog(t, D[8]! - 0.02, D[8]! + 0.2, ease.outCubic);
    if (kt > 0) {
      const s1 = 1 + 0.25 * (1 - ease.outBack(clamp((t - D[8]!) / 0.14), 2));
      bigWord(c, 'FREE', 104, 330, 230, { align: 'left', sx: s1, sy: s1 });
      if (t > D[8]! + 0.42) { const s2 = 1 + 0.25 * (1 - ease.outBack(clamp((t - D[8]! - 0.42) / 0.14), 2)); bigWord(c, 'FALL', 104, 545, 230, { align: 'left', color: rgba('signal', 1), sx: s2, sy: s2 }); }
      const ka = prog(t, D[9]!, D[9]! + 0.5, ease.outCubic);
      if (ka > 0) {
        c.save(); c.globalAlpha *= ka;
        c.font = font(F.mono(500), 24); c.letterSpacing = '15px'; c.fillStyle = rgba('bone', 0.95);
        c.fillText('JOBURGALEX', 112, 625);
        c.restore();
        mono(c, 'MAPS & TERRITORY', 112, 666, { size: 14, color: rgba('ash', 0.9 * ka), track: 6 });
      }
      const kc = prog(t, D[10]!, D[10]! + 0.5, ease.outCubic);
      if (kc > 0) mono(c, 'VIDEO RENDERED IN CODE · AFTER MEXICAT/PDOOM-VIDEO', 112, 712, { size: 12, color: rgba('ash', 0.7 * kc), track: 4 });
    }
    c.restore();
    comp.draw(renderer, L.upload(), out);
    let hit = 0;
    for (const x of w) hit = Math.max(hit, pulse(t, x.start, 0.08) * 0.6);
    void lerp; void pull;
    return { bloom: 0.9, vignette: 0.35, frame, flash: 0, shake: [0, 0], zoom: 1 + hit * 0.008 };
  }
}
