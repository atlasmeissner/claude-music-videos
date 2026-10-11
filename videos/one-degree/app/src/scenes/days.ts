// days — "One day looks like all the rest" / "Nothing worth remembering yet".
// Bone paper: a year as a ruled grid of identical day cells, crossed off faster and faster; every cross the
// same. On "yet" the first cell after the year is filled orange: the first thing worth remembering.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, prog, pulse } from '../engine/util';
import { drawKaraoke, jit, mono } from './_od';

const COLS = 53, ROWS = 7, CELL = 26, GAP = 6;
const GX = (W - COLS * (CELL + GAP) + GAP) / 2, GY = 610;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export default class Days extends Scene {
  ink = new LineBatch(8000, { blend: 'normal' });
  hot = new LineBatch(200);
  text = new Layer2D();
  l2!: Line; l3!: Line;
  tYet = 0;

  override init() {
    const ly = this.ctx.lyrics;
    this.l2 = ly.lines[2]!; this.l3 = ly.lines[3]!;
    this.tYet = this.l3.words[this.l3.words.length - 1]!.start;
  }

  /** Days crossed off by t: one per beat at first, then accelerating to the whole year by "yet". */
  crossed(t: number) {
    const t0 = this.ctx.start + 0.15;
    if (t < t0) return 0;
    const u = clamp((t - t0) / (this.tYet - 0.05 - t0));
    const beats = (t - t0) * (this.ctx.audio.bpm / 60);
    return Math.min(364, Math.floor(Math.max(beats, 364 * Math.pow(u, 3.2))));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.bone);
    const lb = this.ink; lb.clear();
    const hb = this.hot; hb.clear();
    const inkc = LIN.ink;
    const rule = prog(t, this.ctx.start, this.ctx.start + 0.6, ease.outCubic);
    const n = this.crossed(t);
    const cellXY = (i: number) => ({ x: GX + Math.floor(i / ROWS) * (CELL + GAP), y: GY + (i % ROWS) * (CELL + GAP) });
    for (let i = 0; i < COLS * ROWS; i++) {
      const { x, y } = cellXY(i);
      const k = clamp(rule * 1.6 - (i / (COLS * ROWS)) * 0.6);
      if (k <= 0) continue;
      const w = CELL * k;
      lb.seg2(x, y, x + w, y, 1, inkc, 0.55); lb.seg2(x, y + CELL, x + w, y + CELL, 1, inkc, 0.55);
      lb.seg2(x, y, x, y + CELL * k, 1, inkc, 0.55); lb.seg2(x + CELL, y, x + CELL, y + CELL * k, 1, inkc, 0.55);
      if (i < n) {
        // the same cross every day (a hand, so a hair of jitter — and nothing else)
        const a = 5, j = jit(i, 3, 0.8);
        lb.seg2(x + a, y + a + j, x + CELL - a, y + CELL - a, 1.6, inkc, 0.85);
        lb.seg2(x + CELL - a, y + a, x + a + j, y + CELL - a, 1.6, inkc, 0.85);
      }
    }
    // today: a small orange frame riding ahead of the crosses
    if (n < 364 && t > this.ctx.start + 0.2) {
      const { x, y } = cellXY(n);
      const o = 3;
      hb.seg2(x - o, y - o, x + CELL + o, y - o, 2, LIN.signal); hb.seg2(x - o, y + CELL + o, x + CELL + o, y + CELL + o, 2, LIN.signal);
      hb.seg2(x - o, y - o, x - o, y + CELL + o, 2, LIN.signal); hb.seg2(x + CELL + o, y - o, x + CELL + o, y + CELL + o, 2, LIN.signal);
    }
    // "yet": the first day after the year, filled
    const yk = prog(t, this.tYet, this.tYet + 0.25, ease.outCubic);
    if (yk > 0) {
      const { x, y } = cellXY(364);
      const s = CELL * (0.4 + 0.6 * yk);
      for (let r = 0; r < s; r += 1.5) lb.seg2(x + (CELL - s) / 2, y + (CELL - s) / 2 + r, x + (CELL + s) / 2, y + (CELL - s) / 2 + r, 1.6, LIN.signal, 1);
      const p = pulse(t, this.tYet, 0.4);
      hb.seg2(x + CELL / 2, y + CELL / 2, x + CELL / 2 + 0.01, y + CELL / 2, 40 * p + 20, [LIN.signal[0] * 0.6, LIN.signal[1] * 0.6, LIN.signal[2] * 0.6], 0.5 * p);
    }
    lb.render(renderer, out);
    hb.render(renderer, out);

    // ----- type
    const L = this.text, c = L.ctx; L.clear();
    const st = { family: F.archivo(100, 700), size: 96, tracking: -1.5, sung: rgba('ink', 1), unsung: rgba('ink', 0.13), active: rgba('signal', 1), lead: 0.5 } as const;
    drawKaraoke(c, this.l2, GX - 4, 300, t, st);
    drawKaraoke(c, this.l3, GX - 4, 420, t, { ...st, lead: 0.9 });
    // month and weekday labels
    c.save();
    c.globalAlpha = rule;
    for (let m = 0; m < 12; m++) mono(c, MONTHS[m]!, GX + Math.floor((m * 30.4) / 7) * (CELL + GAP), GY - 14, { size: 12, color: rgba('ink', 0.6), track: 2 });
    const wd = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    for (let r = 0; r < 7; r++) mono(c, wd[r]!, GX - 22, GY + r * (CELL + GAP) + 18, { size: 11, color: rgba('ink', 0.45), track: 0, align: 'right' });
    c.restore();
    // ledger
    const notable = t >= this.tYet ? 1 : 0;
    mono(c, `DAYS ${String(n).padStart(3, '0')} / 365`, GX, GY + ROWS * (CELL + GAP) + 44, { size: 14, color: rgba('ink', 0.75), track: 3, weight: 500 });
    mono(c, `WORTH REMEMBERING  ${notable}`, GX + 330, GY + ROWS * (CELL + GAP) + 44, { size: 14, color: notable ? rgba('signal', 1) : rgba('ink', 0.75), track: 3, weight: 500 });
    if (yk > 0) {
      const { x, y } = cellXY(364);
      c.save(); c.globalAlpha = yk;
      c.strokeStyle = rgba('signal', 1); c.lineWidth = 1;
      c.beginPath(); c.moveTo(x + CELL / 2, y + CELL + 6); c.lineTo(x + CELL / 2, y + CELL + 60); c.lineTo(x - 30, y + CELL + 60); c.stroke();
      c.font = font(F.serif(400, true), 30); c.fillStyle = rgba('signal', 1); c.textAlign = 'right';
      c.fillText('day one', x - 40, y + CELL + 70);
      c.restore();
    }
    comp.draw(renderer, L.upload(), out);
    return { bloom: 0.25, vignette: 0.18, ca: 0.4, halation: 0, rollBg: LIN.bone };
  }
}
