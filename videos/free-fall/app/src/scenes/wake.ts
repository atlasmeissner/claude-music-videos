// wake — the tail after chorus 1: "Free fall, free fall", half-time. The daydream breaks (a flash) and it is night
// again: the person is still sitting on the edge, phone in hand. Nothing fell but time: tear-off calendar pages
// (DAY 10, DAY 11 …) drift down into the abyss in their place, and so do the sung words, slowly, past the person.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { mono, wordColor } from './_ff';
import { applyCam, breath, camKeys, daysAt, drawCounter, drawWorld, person, S, SP, toScreen, type Cam } from './_story';

export default class Wake extends Scene {
  L = new Layer2D();
  l!: Line;

  override init() { this.l = this.ctx.lyrics.lines[10]!; }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, s0 = this.ctx.start, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const cam: Cam = camKeys(t, [[s0, { x: 200, y: 120, z: 0.95 }], [end, { x: 240, y: 330, z: 0.8 }]]);
    c.save(); applyCam(c, cam);
    drawWorld(c, cam, { t, fear: 1, door: 0.2, glow: 1.1, stars: 1 });
    const head = person(c, -150, 0, S, breath(SP.write, t, 0.5), { sitting: true });
    c.fillStyle = rgba('ember', 0.9); c.fillRect(head.x + 0.2 * S, head.y + 0.3 * S, 0.07 * S, 0.11 * S);
    c.fillStyle = rgba('signal', 0.18); c.beginPath(); c.arc(head.x + 0.23 * S, head.y + 0.35 * S, 0.12 * S, 0, TAU); c.fill();
    // calendar pages: one torn off per beat, fluttering down into the dark
    const b0 = this.ctx.audio.beatAt(s0);
    const nb = Math.floor(this.ctx.audio.beatAt(t) - b0);
    for (let i = 0; i <= nb; i++) {
      const tb = this.ctx.audio.timeOfBeat(Math.ceil(b0) + i);
      const u = t - tb;
      if (u < 0 || u > 6) continue;
      const x = 60 + 30 * Math.sin(u * 2 + i) + u * 40 + hash(i, 1) * 120;
      const y = -60 + u * u * 40 + u * 120;
      c.save();
      c.translate(x, y); c.rotate(Math.sin(u * 3 + i) * 0.8);
      c.scale(1, Math.cos(u * 2.4 + i) * 0.5 + 0.6);
      c.fillStyle = rgba('bone', 0.92); c.fillRect(-34, -40, 68, 80);
      c.fillStyle = rgba('signal', 0.95); c.fillRect(-34, -40, 68, 16);
      c.font = font(F.archivo(100, 900), 30); c.fillStyle = rgba('ink', 1); c.textAlign = 'center';
      c.fillText(String(daysAt(tb)), 0, 26);
      c.restore();
    }
    c.restore();
    // the sung words drift down past the person, slowly turning
    const w = this.l.words;
    const fam = F.archivo(125, 900), size = 150;
    w.forEach((wd, i) => {
      if (t < wd.start - 0.05) return;
      const u = t - wd.start;
      const anchor = toScreen(cam, i % 2 ? 420 : 260, -220);
      const x = anchor.x + (i < 2 ? -300 : 120) + 40 * Math.sin(u * 1.3 + i);
      const y = anchor.y + 30 * u * u + 40 * u;
      c.save();
      c.translate(x, y); c.rotate(Math.sin(u * 0.9 + i) * 0.25 * clamp(u));
      c.font = font(fam, size); c.letterSpacing = '-4px'; c.textAlign = 'center';
      c.fillStyle = wordColor(wd, t, rgba('bone', 1 - prog(u, 2.2, 3.4)));
      c.globalAlpha = prog(u, 0, 0.12);
      c.fillText(wd.w.toUpperCase(), 0, 0);
      c.restore();
    });
    mono(c, 'AWAKE · STILL ON THE LEDGE', W - 104, 96, { size: 13, color: rgba('ash', 0.8), track: 5, align: 'right' });
    drawCounter(c, t);
    comp.draw(renderer, L.upload(), out);
    // the daydream breaking: a flash at the cut
    return { bloom: 0.6, vignette: 0.5, flash: pulse(t, s0, 0.1) * 0.6, zoom: 1 + 0.03 * (1 - prog(t, s0, s0 + 0.6, ease.outCubic)) };
    void lerp;
  }
}
