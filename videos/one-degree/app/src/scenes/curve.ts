// curve — "But the whole world's bending" / "one degree, one degree, one degree" / instrumental. (Revision 2,
// replaces the globe.) The 1% rule as a plot: a year of days along x, ×1.01^day up y on a true linear scale. The pen
// draws the curve flat along the floor (the quiet days: ×1.00 → ×4) and on "bending" it bends upward into the
// steep part and lands on ×37.8. Each "degree" adds one annotation: the year's gain; the flat 1.00 line and the
// falling 0.99 curve; the gap between them. The break marks the stretch where people stop.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, lerp, prog, pulse } from '../engine/util';
import { degreeTimes, drawKaraoke, fmtGain, mono, needleTip, rollPost, YEAR_GAIN } from './_od';

const X0 = 230, X1 = 1690, Y0 = 900, Y1 = 250; // plot box (y up = smaller)
const GMAX = 40;
const px = (d: number) => X0 + (d / 365) * (X1 - X0);
const py = (g: number) => Y0 - (g / GMAX) * (Y0 - Y1);

export default class Curve extends Scene {
  lb = new LineBatch(8000);
  text = new Layer2D();
  l8!: Line; l9!: Line;
  degs: number[] = [];
  tBend = 0;

  override init() {
    const ly = this.ctx.lyrics;
    this.l8 = ly.lines[8]!; this.l9 = ly.lines[9]!;
    this.tBend = this.l8.words[this.l8.words.length - 1]!.start;
    this.degs = degreeTimes(ly).filter((d) => d >= this.ctx.start && d < this.ctx.end);
  }

  /** The pen's day: crawls along the flat part, then rides up the bend on "bending". */
  penDay(t: number) {
    const a = prog(t, this.ctx.start + 0.1, this.tBend, ease.linear) * 150;
    const b = prog(t, this.tBend, this.tBend + 1.1, ease.inOutCubic) * 215;
    return a + b;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const intro = prog(t, this.ctx.start, this.ctx.start + 0.5, ease.outCubic);
    const [d1, d2, d3] = this.degs as [number, number, number];
    const fadeOut = 1 - prog(t, this.ctx.end - 0.9, this.ctx.end - 0.1);
    // axes and grid
    lb.seg2(X0, Y0, X0 + (X1 - X0 + 40) * intro, Y0, 1.3, LIN.bone, 0.8 * fadeOut);
    lb.seg2(X0, Y0, X0, Y0 - (Y0 - Y1 + 30) * intro, 1.3, LIN.bone, 0.8 * fadeOut);
    for (let d = 50; d <= 350; d += 50) lb.seg2(px(d), Y0, px(d), Y0 + 10, 1, LIN.bone, 0.6 * intro * fadeOut);
    for (const g of [10, 20, 30, 40]) lb.seg2(X0, py(g), X1, py(g), 1, LIN.graphite, 0.35 * intro * fadeOut);
    // reference curves (degree 2): the flat 1.00 and the falling 0.99
    const r2 = prog(t, d2 - 0.05, d2 + 1.0, ease.outCubic);
    if (r2 > 0) {
      for (let d = 0; d < 365 * r2; d += 6) lb.seg2(px(d), py(1), px(Math.min(365 * r2, d + 3)), py(1), 1.2, LIN.bone, 0.55 * fadeOut);
      let p = { x: px(0), y: py(1) };
      for (let d = 2; d <= 365 * r2; d += 2) { const q = { x: px(d), y: py(Math.pow(0.99, d)) }; lb.seg2(p.x, p.y, q.x, q.y, 1.4, LIN.graphite, 0.95 * fadeOut); p = q; }
    }
    // the curve, drawn by the pen
    const pd = this.penDay(t);
    let p = { x: px(0), y: py(1) };
    for (let d = 1; d <= pd; d += 1) {
      const q = { x: px(d), y: py(Math.pow(1.01, d)) };
      const hot = clamp((d - pd + 40) / 40);
      lb.seg2(p.x, p.y, q.x, q.y, 2.4 + hot * 0.8, hot > 0 ? [lerp(LIN.bone[0], LIN.signal[0] * 1.6, hot), lerp(LIN.bone[1], LIN.signal[1] * 1.6, hot), lerp(LIN.bone[2], LIN.signal[2] * 1.6, hot)] : LIN.bone, 0.95 * fadeOut);
      p = q;
    }
    const tip = { x: px(pd), y: py(Math.pow(1.01, pd)) };
    needleTip(lb, tip.x, tip.y, t, 0.9 + 0.6 * pulse(t, d1 ?? 1e9, 0.4), fadeOut);
    // the gap (degree 3): a bracket at day 365 from ×0.03 to ×37.8
    const r3 = prog(t, d3 - 0.05, d3 + 0.7, ease.outCubic);
    if (r3 > 0) {
      const bx = X1 + 34, ya = py(YEAR_GAIN), yb = py(Math.pow(0.99, 365));
      lb.seg2(bx, yb, bx, lerp(yb, ya, r3), 2, LIN.signal, fadeOut);
      lb.seg2(bx - 8, ya, bx, ya, 2, LIN.signal, r3 * fadeOut); lb.seg2(bx - 8, yb, bx, yb, 2, LIN.signal, fadeOut);
    }
    // the quiet stretch, marked in the break
    const rq = prog(t, this.l9.end + 0.6, this.l9.end + 1.6, ease.outCubic);
    if (rq > 0) {
      lb.seg2(px(0), Y0 + 52, px(100) * rq + px(0) * (1 - rq), Y0 + 52, 1.4, LIN.signal, 0.9 * fadeOut);
      lb.seg2(px(0), Y0 + 44, px(0), Y0 + 60, 1.4, LIN.signal, rq * fadeOut);
      lb.seg2(px(100), Y0 + 44, px(100), Y0 + 60, 1.4, LIN.signal, rq * fadeOut);
    }
    lb.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    c.save(); c.globalAlpha = fadeOut;
    // lyric: line 8 then line 9 in its place, top left (the curve is still on the floor there)
    const st = { family: F.archivo(100, 700), size: 84, tracking: -1.5, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.5 } as const;
    const sw = prog(t, this.l9.start - 0.35, this.l9.start - 0.05, ease.inOutCubic);
    if (sw < 1) { c.save(); c.globalAlpha *= 1 - sw; drawKaraoke(c, this.l8, 120, 200, t, st); c.restore(); }
    if (sw > 0) { c.save(); c.globalAlpha *= sw; drawKaraoke(c, this.l9, 120, 200, t, st); c.restore(); }
    // axis labels
    c.save(); c.globalAlpha *= intro;
    for (let d = 50; d <= 350; d += 50) mono(c, String(d), px(d), Y0 + 30, { size: 12, color: rgba('ash', 0.85), track: 1, align: 'center' });
    mono(c, 'DAYS', X1 + 20, Y0 + 30, { size: 12, color: rgba('ash', 0.85), track: 3 });
    for (const g of [10, 20, 30, 40]) mono(c, `×${g}`, X0 - 14, py(g) + 4, { size: 12, color: rgba('ash', 0.85), track: 1, align: 'right' });
    mono(c, '×1.01 A DAY', X0 + 12, Y1 - 8, { size: 12, color: rgba('bone', 0.8), track: 3 });
    c.restore();
    // the pen's reading
    const g = Math.pow(1.01, pd);
    mono(c, `DAY ${Math.floor(pd)}  ${fmtGain(g)}`, tip.x + 18, tip.y - 14, { size: 14, color: rgba('signal', 1), track: 2, weight: 500 });
    // degree 1: the year's gain
    const r1 = prog(t, d1 - 0.05, d1 + 0.5, ease.outCubic);
    if (r1 > 0) {
      c.save(); c.globalAlpha *= r1;
      c.font = font(F.serif(600, true), 64); c.fillStyle = rgba('signal', 1); c.textAlign = 'right';
      c.fillText('1.01³⁶⁵ = 37.8', px(300), py(30));
      c.restore();
    }
    if (r2 > 0) {
      c.save(); c.globalAlpha *= r2;
      mono(c, '1.00³⁶⁵ = ×1', px(300), py(1) - 12, { size: 12, color: rgba('bone', 0.8), track: 2 });
      mono(c, '0.99³⁶⁵ = ×0.03', px(300), py(0) + 22 - 4, { size: 12, color: rgba('ash', 0.95), track: 2 });
      c.restore();
    }
    if (r3 > 0) {
      c.save(); c.globalAlpha *= r3;
      mono(c, 'THE GAP', X1 + 50, py(20) - 8, { size: 12, color: rgba('ash', 0.9), track: 3 });
      mono(c, `×${Math.round(YEAR_GAIN / Math.pow(0.99, 365)).toLocaleString('en-US')}`, X1 + 50, py(20) + 18, { size: 20, color: rgba('signal', 1), track: 2, weight: 500 });
      c.restore();
    }
    if (rq > 0) {
      c.save(); c.globalAlpha *= rq;
      mono(c, 'THE QUIET DAYS  ×1.00 → ×2.70  — WHERE MOST PEOPLE STOP', px(0), Y0 + 84, { size: 12, color: rgba('signal', 1), track: 3 });
      c.restore();
    }
    c.restore();
    comp.draw(renderer, T.upload(), out);
    void W; void lyrics;
    return { ...rollPost(lyrics, t), bloom: 0.6, ca: 0.5, vignette: 0.42 };
  }
}
