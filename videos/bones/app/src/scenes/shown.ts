// shown — chorus 1, "I don't need what I was shown" / "Build it up from the bones".
// A: a specimen plate of the gold that fell: each ornament drawn large in its cell with a figure caption
//    (FIG. 1 CAPITAL, CORINTHIAN …). One is struck out per word: NOT NEEDED.
// B: hard cut. Black, the point. "Build": one post rises from the point; "up" it tops out; "from the" a second
//    post; "bones": the lintel drops onto both. Post and lintel: the first principle of building. PROVEN 1.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog, pulse } from '../engine/util';
import { drawFlow, drawLedger, mono, point, ring, scaleRGB, slamRows, titleBlock } from './_bones';
import { FACADE, type Member } from './_facade';

interface Spec { name: string; ms: Member[]; cx: number; cy: number; w: number; h: number }
const PICK: [string, (m: Member) => boolean][] = [
  ['CAPITAL, CORINTHIAN', (m) => m.cy < -420 && m.cy > -480 && m.cx > -400 && m.cx < -350],
  ['ACROTERION', (m) => m.cy < -760 && Math.abs(m.cx) < 30],
  ['WINDOW SURROUND', (m) => m.cx < -600 && m.cx > -720 && m.cy < -300 && m.cy > -470],
  ['WREATH & SUNBURST', (m) => Math.abs(m.cx) < 10 && m.cy < -640 && m.cy > -700],
  ['DOME RIBS, GILDED', (m) => Math.abs(m.cx) < 80 && m.cy < -850 && m.cy > -940],
  ['MEDALLION', (m) => m.cx > 560 && m.cx < 660 && m.cy < -250 && m.cy > -280],
];

export default class Shown extends Scene {
  lb = new LineBatch(20000);
  text = new Layer2D();
  l8!: Line; l9!: Line;
  tB = 0;
  specs: Spec[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    this.l8 = lyrics.lines[8]!; this.l9 = lyrics.lines[9]!;
    this.tB = audio.timeOfBeat(Math.floor(audio.beatAt(this.l9.words[0]!.start + 0.02)) - 1);
    const gold = FACADE.filter((m) => m.layer === 'gold');
    for (const [name, fn] of PICK) {
      const g0 = gold.find(fn);
      if (!g0) continue;
      const ms = gold.filter((m) => m.g === g0.g);
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const m of ms) for (const [x, y] of m.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      this.specs.push({ name, ms, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 });
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics, audio } = this.ctx;
    const t = f.t, s0 = this.ctx.start, end = this.ctx.end;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const T = this.text, c = T.ctx; T.clear();
    if (t < this.tB) {
      // ---- A: the specimen plate
      const words = this.l8.words;
      const cw = 350, ch = 290, gx = 760, gy = 130;
      this.specs.forEach((sp, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = gx + col * cw, y = gy + row * (ch + 40);
        const k = prog(t, s0 + i * 0.05, s0 + 0.4 + i * 0.05, ease.outCubic);
        // cell frame
        const fr = (x0: number, y0: number, x1: number, y1: number) => lb.seg2(x0, y0, x1, y1, 1, LIN.graphite, 0.9 * k);
        fr(x, y, x + cw - 16, y); fr(x, y + ch, x + cw - 16, y + ch); fr(x, y, x, y + ch); fr(x + cw - 16, y, x + cw - 16, y + ch);
        // the specimen, scaled into the cell
        const sc = Math.min((cw - 70) / Math.max(sp.w, 1), (ch - 90) / Math.max(sp.h, 1), 4.2);
        const ox = x + (cw - 16) / 2, oy = y + ch / 2 - 14;
        // struck by word i (7 words; the 8th falls on "shown"'s tail)
        const ws = words[Math.min(i, words.length - 1)]!;
        const tStrike = i < words.length ? ws.start : words[words.length - 1]!.end + 0.1;
        const st = prog(t, tStrike, tStrike + 0.18, ease.outCubic);
        const dim = 1 - st * 0.6;
        for (const m of sp.ms) {
          for (let j = 1; j < m.pts.length; j++) {
            const [ax, ay] = m.pts[j - 1]!, [bx, by] = m.pts[j]!;
            lb.seg2(ox + (ax - sp.cx) * sc, oy + (ay - sp.cy) * sc, ox + (bx - sp.cx) * sc, oy + (by - sp.cy) * sc, Math.min(2, m.w * sc * 0.55), LIN.gold, k * dim);
          }
        }
        if (st > 0) {
          lb.seg2(x + 10, y + ch - 10, lerp(x + 10, x + cw - 26, st), lerp(y + ch - 10, y + 10, st), 2.2, scaleRGB(LIN.signal, 1.5), 1);
        }
        mono(c, `FIG. ${i + 1}`, x + 12, y + ch - 40, { size: 11, color: rgba('ash', 0.9 * k), track: 3 });
        mono(c, sp.name, x + 12, y + ch - 20, { size: 11, color: rgba('gold', 0.95 * k * dim), track: 2 });
        if (st > 0) mono(c, 'NOT NEEDED', x + cw - 26, y + 26, { size: 12, color: rgba('signal', st), track: 3, align: 'right', weight: 600 });
      });
      lb.render(renderer, out);
      const st = { family: F.archivo(100, 800), size: 92, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.14), active: rgba('signal', 1), lead: 0.5 };
      const row = (a: number, b: number, y: number) => drawFlow(c, { ...this.l8, words: words.slice(a, b), start: words[a]!.start } as Line, 110, y, t, st);
      row(0, 3, 300); row(3, 5, 410); row(5, 7, 520);
      mono(c, 'PLATE XII · ORNAMENT RECOVERED FROM THE STRIP-OUT', 112, 580, { size: 12, color: rgba('ash', 0.85), track: 3 });
      titleBlock(c, 'D-302', 'SPECIMENS', [['SCALE', 'ENLARGED'], ['DISPOSITION', 'NOT NEEDED']]);
    } else {
      // ---- B: post and lintel
      const w = this.l9.words; // Build it up from the bones
      const X0 = 700, X1 = 1100, Y = 900, HT = 380;
      const p1 = prog(t, w[0]!.start - 0.05, w[2]!.end, ease.outCubic);
      const p2 = prog(t, w[3]!.start - 0.05, w[4]!.end + 0.1, ease.outCubic);
      const lt = w[5]!.start;
      const ld = prog(t, lt - 0.18, lt, ease.inQuad);
      const thud = pulse(t, lt, 0.25);
      const gl = scaleRGB(LIN.bone, 1.0 + thud * 0.6);
      // ground
      lb.seg2(200, Y, 1720, Y, 1, LIN.graphite, prog(t, this.tB, this.tB + 0.5));
      // posts
      if (p1 > 0) lb.seg2(X0, Y, X0, Y - HT * p1, 6, gl, 1);
      if (p2 > 0) lb.seg2(X1, Y, X1, Y - HT * p2, 6, gl, 1);
      // lintel
      if (ld > 0) { const yy = lerp(Y - HT - 380, Y - HT - 3, ld); lb.seg2(X0 - 70, yy, X1 + 70, yy, 7, gl, 1); }
      // the points at the feet
      point(lb, X0, Y, t, 1);
      if (p2 > 0) point(lb, X1, Y, t, 1, clamp(p2 * 4));
      ring(lb, X0, Y, t, w[0]!.start, { rgb: LIN.signal, speed: 180, life: 1.2, alpha: 0.6 });
      if (thud > 0.01) ring(lb, (X0 + X1) / 2, Y - HT, t, lt, { rgb: LIN.bone, speed: 400, life: 0.9, alpha: 0.5 });
      lb.render(renderer, out);
      slamRows(c, [{ words: w.slice(0, 3), x: 1820, y: 230, align: 'right' }, { words: w.slice(3), x: 1820, y: 400, align: 'right' }], t,
        { family: F.archivo(62, 900), size: 168, tracking: -2, upper: true });
      // dimension and notes
      if (ld >= 1) {
        mono(c, 'POST', X0 - 22, Y - HT / 2, { size: 12, color: rgba('ash', 0.9), track: 3, align: 'right' });
        mono(c, 'POST', X1 + 22, Y - HT / 2, { size: 12, color: rgba('ash', 0.9), track: 3 });
        mono(c, 'LINTEL', (X0 + X1) / 2, Y - HT - 24, { size: 12, color: rgba('ash', 0.9), track: 3, align: 'center' });
      }
      mono(c, 'TWO THINGS STANDING, ONE THING ACROSS THEM.', 200, Y + 60, { size: 13, color: rgba('bone', 0.85 * prog(t, lt + 0.3, lt + 0.8)), track: 3 });
      mono(c, 'NOTHING ELSE IS REQUIRED.', 200, Y + 84, { size: 13, color: rgba('signal', prog(t, lt + 0.9, lt + 1.4)), track: 3 });
      titleBlock(c, 'S-001', 'POST AND LINTEL', [['SCALE', '1:1'], ['MEMBERS', String((p1 > 0 ? 1 : 0) + (p2 > 0 ? 1 : 0) + (ld > 0 ? 1 : 0))]]);
    }
    drawLedger(c, lyrics, audio, 120, 1012, t);
    comp.draw(renderer, T.upload(), out);
    void end;
    return { bloom: 0.7, ca: 0.5 + f.a.kick * 0.6, vignette: 0.45, shake: [f.a.kick * 4, f.a.kick * 2] as [number, number] };
  }
}
