// pages — "One page doesn't write the book" / "One glance isn't worth a second look".
// A: a book's fore-edge seen side-on, growing one page per eighth note (PAGES 1 → …): one page changes nothing.
// B: a stopwatch. The glance moves the hand 0.2 s; on "second" it sweeps exactly one turn: 1.000 s.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog, TAU } from '../engine/util';
import { drawCompound, drawKaraoke, heading, jit, mono, needle, pivot, rad, rollPost } from './_od';

export default class Pages extends Scene {
  lb = new LineBatch(6000);
  text = new Layer2D();
  l10!: Line; l11!: Line;
  tB = 0;

  override init() {
    const { lyrics, audio } = this.ctx;
    this.l10 = lyrics.lines[10]!; this.l11 = lyrics.lines[11]!;
    this.tB = audio.timeOfBeat(Math.floor(audio.beatAt(this.l11.words[0]!.start + 0.02)));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const L = this.text, c = L.ctx; L.clear();
    const st = { family: F.archivo(100, 700), size: 92, tracking: -1.5, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.5 } as const;
    const k = prog(t, this.tB - 0.05, this.tB + 0.45, ease.inOutCubic);

    // ---- A: the fore-edge
    if (k < 1) {
      const eighth = 30 / audio.bpm;
      const n = Math.max(1, Math.floor((t - this.ctx.start) / eighth) + 1);
      const x0 = 760, x1 = 1640, yb = 880, gap = 7;
      const off = -k * 900;
      // covers
      lb.seg2(x0 + off, yb + 6, x1 + off, yb + 6, 3, LIN.bone, 0.9);
      for (let i = 0; i < n; i++) {
        const y = yb - i * gap;
        const curl = Math.sin((i / 40) * 3) * 6;
        const hot = i === n - 1 ? 1 : 0;
        const a = hot ? 1 : 0.55;
        lb.seg2(x0 + off + jit(i, 2, 3), y, x1 + off + curl + jit(i, 5, 3), y, hot ? 1.6 : 1, hot ? LIN.signal : LIN.bone, a);
      }
      // the spine
      lb.seg2(x0 + off - 6, yb + 6, x0 + off - 6, yb - n * gap, 2, LIN.bone, 0.7);
      c.save(); c.globalAlpha = 1 - k;
      drawKaraoke(c, this.l10, 120, 300, t, st);
      mono(c, `PAGES  ${String(n).padStart(3, '0')}`, x0 + off, yb + 50, { size: 14, color: rgba('bone', 0.85), track: 3, weight: 500 });
      mono(c, 'THE BOOK  NOT YET WRITTEN', x0 + off, yb + 74, { size: 12, color: rgba('ash', 0.7), track: 3 });
      c.restore();
    }
    // ---- B: the stopwatch
    if (k > 0) {
      const cx = lerp(W + 400, 1440, k), cy = 660, R = 250;
      const words = this.l11.words;
      const glance = words[1]!, second = words[5]!;
      // the hand's time: 0.2 s on the glance, then exactly one second over "second"
      let secs = 0.2 * prog(t, glance.start, glance.start + 0.2, ease.outCubic);
      secs += clamp((t - second.start) / 1.0);
      const a = rad(-90 + secs * 360);
      for (let i = 0; i < 100; i++) {
        const aa = rad(-90 + i * 3.6);
        const l = i % 10 === 0 ? 26 : i % 5 === 0 ? 16 : 8;
        lb.seg2(cx + Math.cos(aa) * R, cy + Math.sin(aa) * R, cx + Math.cos(aa) * (R - l), cy + Math.sin(aa) * (R - l), i % 10 === 0 ? 1.5 : 1, LIN.bone, 0.75);
      }
      for (let i = 0; i < 160; i++) {
        const a0 = (i / 160) * TAU, a1 = ((i + 1) / 160) * TAU;
        lb.seg2(cx + Math.cos(a0) * (R + 14), cy + Math.sin(a0) * (R + 14), cx + Math.cos(a1) * (R + 14), cy + Math.sin(a1) * (R + 14), 1.4, LIN.bone, 0.85);
      }
      // the swept second, as an orange arc inside
      if (secs > 0) {
        const n = Math.ceil(secs * 120);
        for (let i = 0; i < n; i++) {
          const a0 = rad(-90 + (i / n) * secs * 360), a1 = rad(-90 + ((i + 1) / n) * secs * 360);
          lb.seg2(cx + Math.cos(a0) * (R - 40), cy + Math.sin(a0) * (R - 40), cx + Math.cos(a1) * (R - 40), cy + Math.sin(a1) * (R - 40), 3, LIN.signal, 0.9);
        }
      }
      // crown
      lb.seg2(cx - 18, cy - R - 30, cx + 18, cy - R - 30, 6, LIN.bone, 0.8);
      lb.seg2(cx, cy - R - 14, cx, cy - R - 30, 4, LIN.bone, 0.8);
      pivot(lb, cx, cy, 9);
      needle(lb, cx, cy, a, R - 20, t, { width: 1.8, tail: 50 });
      c.save(); c.globalAlpha = k;
      drawKaraoke(c, this.l11, 120, 300, t, { ...st, size: 84 });
      // labels
      c.font = font(F.mono(400), 15); c.fillStyle = rgba('ash', 0.9); c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let i = 0; i < 10; i++) {
        const aa = rad(-90 + i * 36);
        c.fillText((i / 10).toFixed(1), cx + Math.cos(aa) * (R - 56), cy + Math.sin(aa) * (R - 56));
      }
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      mono(c, `${secs.toFixed(3)} s`, cx - 60, cy + 100, { size: 30, color: rgba('signal', 1), track: 2, weight: 500 });
      if (t > glance.start) mono(c, 'A GLANCE  0.200 s', 120, 420, { size: 13, color: rgba('ash', 0.85), track: 3 });
      if (t > second.start) mono(c, 'A SECOND  1.000 s', 120, 446, { size: 13, color: rgba('signal', 1), track: 3 });
      c.restore();
    }
    drawCompound(c, 120, 990, t, { ly: lyrics });
    lb.render(renderer, out);
    comp.draw(renderer, L.upload(), out);
    return { ...rollPost(lyrics, t), bloom: 0.55, ca: 0.5, vignette: 0.42 };
  }
}
