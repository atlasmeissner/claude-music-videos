// chorus — "These are maps and this is territory / Nothing looks the way it did before" (and, later, "…the way I
// thought it would"). One module, four entries (params.n), escalating from the map toward the territory:
//  1  split screen: the same country as MAP (left, paper) and TERRITORY (right, night); the divider moves on the
//     downbeats; on "Nothing looks…" the map slides and warps off the land it describes.
//  2  the territory with a map lens: a round window onto the paper, wandering, and disagreeing more and more.
//  3  gold light: the territory full screen; the map is a small inset in the corner, shrinking.
//  4  full gold light; only ghost contour lines of the map remain, and they fade out word by word.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F, font, measure } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { Lyrics } from '../engine/lyrics';
import { clamp, ease, lerp, prog, TAU } from '../engine/util';
import { PLAN, track } from './_world';
import { drawKaraoke, drawTrack, lerpView, mono, placeMark, Terrain, w2s, type View } from './_mt';

const LINES: Record<number, [number, number]> = { 1: [6, 7], 2: [16, 17], 3: [23, 24], 4: [27, 28] };

export default class Chorus extends Scene {
  terrain = new Terrain();
  lb = new LineBatch(4000);
  ink = new LineBatch(2000, { blend: 'normal' });
  text = new Layer2D();
  n = 1;
  la!: Line; lb2!: Line;
  bars: number[] = [];

  override init() {
    this.n = this.ctx.params.n ?? 1;
    const [a, b] = LINES[this.n]!;
    this.la = this.ctx.lyrics.lines[a]!; this.lb2 = this.ctx.lyrics.lines[b]!;
    this.bars = this.ctx.audio.downbeats.filter((d) => d >= this.ctx.start - 0.01 && d < this.ctx.end);
  }

  /** Index of the current bar and the eased progress into it (for moves that land on downbeats). */
  barStep(t: number, lead = 0.35) {
    let i = 0;
    for (let k = 0; k < this.bars.length; k++) if (t >= this.bars[k]! - lead) i = k;
    const m = prog(t, this.bars[i]! - lead, this.bars[i]! + 0.25, ease.inOutCubic);
    return { i, m };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const n = this.n;
    if (n === 1) return this.split(f, out);
    if (n === 2) return this.lens(f, out);
    return this.gold(f, out);
  }

  // ---------------------------------------------------------------- 1: split screen
  split(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const la = this.la, lz = this.lb2;
    const v = lerpView({ cx: 40, cy: 44, s: 24, rot: 0 }, { cx: 43, cy: 42, s: 30, rot: 0.05 }, prog(t, t0, t1, ease.inOutSine));
    // divider: steps between positions on the downbeats
    const POS = [960, 1010, 900, 1060, 940, 980, 880, 1000, 960];
    const { i, m } = this.barStep(t);
    const dx = lerp(POS[Math.max(0, i - 1) % POS.length]!, POS[i % POS.length]!, i === 0 ? 1 : m);
    const open = prog(t, t0, t0 + 0.5, ease.outCubic);
    const divX = lerp(1920, dx, open);
    // "Nothing looks the way it did before": the map slips off the land
    const slip = prog(t, lz.start - 0.2, lz.end, ease.inOutSine);
    const misreg: [number, number, number] = [slip * 2.4, -slip * 1.3, slip * 1.8];
    this.terrain.draw(renderer, out, { view: v, split: [-1, 0, -divX, 1.2], misreg, terrInk: 0.6, relief: 3.4, t, contour: 0.05, sun: [-0.6, -0.5, 0.55] });
    const T = this.text, c = T.ctx; T.clear();
    // the planned road, on the map side only (it slips with the map)
    const vm: View = { ...v, cx: v.cx + misreg[0], cy: v.cy + misreg[1] };
    c.save(); c.beginPath(); c.rect(0, 0, divX, 1080); c.clip();
    c.strokeStyle = rgba('ink', 0.85); c.lineWidth = 2.2;
    c.beginPath();
    PLAN.forEach((p, j) => { const q = w2s(vm, p.x, p.y); if (j) c.lineTo(q.x, q.y); else c.moveTo(q.x, q.y); });
    c.stroke();
    PLAN.forEach((p) => { const q = w2s(vm, p.x, p.y); placeMark(c, q.x, q.y, 8, rgba('ink', 0.9)); mono(c, p.name, q.x + 14, q.y - 10, { size: 12, color: rgba('ink', 0.85), track: 3, weight: 600 }); });
    c.restore();
    // the divider
    c.fillStyle = rgba('bone', 0.9);
    c.fillRect(divX - 1, 0, 2, 1080);
    mono(c, 'MAP', divX - 30, 70, { size: 13, color: rgba('ink', 0.85), track: 6, align: 'right', weight: 600 });
    mono(c, 'TERRITORY', divX + 30, 70, { size: 13, color: rgba('bone', 0.85), track: 6, weight: 600 });
    // line A: "These are maps" on the map side (ink), "and this is territory" on the territory side (bone)
    const fam = F.archivo(112.5, 900);
    const size = Math.min(112, 112 * (divX - 170) / measure('These are maps', fam, 112, -3));
    const wA = la.words;
    const k3 = 3; // "These are maps" | "and this is territory"
    const drawWords = (ws: typeof wA, x: number, y: number, col: string, colU: string, colA: string, align: 'left' | 'right') => {
      const txt = ws.map((w) => w.w).join(' ');
      const total = measure(txt, fam, size, -3);
      let xx = align === 'right' ? x - total : x;
      c.font = font(fam, size); c.letterSpacing = '-3px'; c.textBaseline = 'alphabetic';
      for (const w of ws) {
        const wd = measure(w.w, fam, size, -3);
        const p = Lyrics.wordProgress(w, t);
        const vis = t > la.start - 0.5;
        if (vis) { c.fillStyle = colU; c.fillText(w.w, xx, y); }
        if (p > 0) {
          c.save(); c.beginPath(); c.rect(xx - 6, y - size, (wd + 12) * Math.min(1, p * 1.15), size * 1.4); c.clip();
          c.fillStyle = t < w.end + 0.25 ? colA : col; c.fillText(w.w, xx, y); c.restore();
        }
        xx += wd + measure(' ', fam, size, -3);
      }
    };
    c.save(); c.beginPath(); c.rect(0, 0, divX, 1080); c.clip();
    drawWords(wA.slice(0, k3), divX - 70, 460, rgba('ink', 1), rgba('ink', 0.12), rgba('blood', 1), 'right');
    c.restore();
    c.save(); c.beginPath(); c.rect(divX, 0, 1920 - divX, 1080); c.clip();
    drawWords(wA.slice(k3, 6), divX + 70, 460, rgba('bone', 1), rgba('bone', 0.16), rgba('signal', 1), 'left');
    drawWords(wA.slice(6), divX + 70, 580, rgba('bone', 1), rgba('bone', 0.16), rgba('signal', 1), 'left');
    c.restore();
    // line B across both halves, each half in its own colours
    const st = { family: F.archivo(100, 700), size: 66, tracking: -1, lead: 0.6, align: 'center' as const };
    c.save(); c.beginPath(); c.rect(0, 0, divX, 1080); c.clip();
    drawKaraoke(c, lz, 960, 860, t, { ...st, sung: rgba('ink', 1), unsung: rgba('ink', 0.14), active: rgba('blood', 1) });
    c.restore();
    c.save(); c.beginPath(); c.rect(divX, 0, 1920 - divX, 1080); c.clip();
    drawKaraoke(c, lz, 960, 860, t, { ...st, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1) });
    c.restore();
    if (slip > 0.05) {
      c.save(); c.globalAlpha = clamp(slip * 3); c.beginPath(); c.rect(0, 0, divX, 1080); c.clip();
      mono(c, `MISREGISTRATION ${Math.hypot(misreg[0], misreg[1]).toFixed(2)} KM`, 120, 1000, { size: 12, color: rgba('blood', 1), track: 3, weight: 600 });
      c.restore();
    }
    comp.draw(renderer, T.upload(), out);
    return { bloom: 0.35, vignette: 0.3, ca: 0.4, halation: 0.1 };
  }

  // ---------------------------------------------------------------- 2: the map lens
  lens(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const la = this.la, lz = this.lb2;
    const v = lerpView({ cx: 50, cy: 62, s: 22, rot: -0.08 }, { cx: 55, cy: 58, s: 27, rot: 0.02 }, prog(t, t0, t1, ease.inOutSine));
    const { i, m } = this.barStep(t);
    const STOPS: [number, number][] = [[1240, 380], [1320, 430], [1180, 350], [1380, 400], [1260, 440], [1200, 370], [1340, 360], [1280, 420], [1240, 390]];
    const a = STOPS[Math.max(0, i - 1) % STOPS.length]!, b = STOPS[i % STOPS.length]!;
    const lx = lerp(a[0], b[0], i === 0 ? 1 : m), ly = lerp(a[1], b[1], i === 0 ? 1 : m);
    const R = 300 * prog(t, t0, t0 + 0.7, ease.outBack);
    const slip = prog(t, lz.start - 0.2, lz.end, ease.inOutSine);
    const misreg: [number, number, number] = [0.6 + slip * 3.0, slip * 1.8, 0.6 + slip * 2.2];
    this.terrain.draw(renderer, out, { view: v, mapMix: 0, lens: [lx, ly, R, 1], misreg, terrInk: 0.6, relief: 3.4, t, contour: 0.04, sun: [-0.4, -0.7, 0.55] });
    // the walked track so far (to A FEAST), gold, under the text
    const lb = this.lb; lb.clear();
    const T = track();
    drawTrack(lb, v, T.len[T.wayAt[5]!]!, t, { width: 2.2 });
    lb.render(renderer, out);
    const L = this.text, c = L.ctx; L.clear();
    c.strokeStyle = rgba('ink', 0.9); c.lineWidth = 2;
    c.beginPath(); c.arc(lx, ly, R, 0, TAU); c.stroke();
    c.strokeStyle = rgba('bone', 0.5); c.lineWidth = 1;
    c.beginPath(); c.arc(lx, ly, R + 10, 0, TAU); c.stroke();
    mono(c, 'THE MAP', lx, ly + R + 40, { size: 12, color: rgba('bone', 0.75), track: 5, align: 'center' });
    if (slip > 0.05) mono(c, `OFF BY ${Math.hypot(misreg[0], misreg[1]).toFixed(1)} KM`, lx, ly + R + 62, { size: 12, color: rgba('signal', clamp(slip * 3)), track: 3, align: 'center', weight: 600 });
    const stA = { family: F.archivo(112.5, 900), size: 86, tracking: -2.5, sung: rgba('bone', 1), unsung: rgba('bone', 0.15), active: rgba('signal', 1), lead: 0.5 };
    drawKaraoke(c, la, 120, 860, t, stA);
    drawKaraoke(c, lz, 120, 950, t, { ...stA, family: F.archivo(100, 700), size: 62, tracking: -1, lead: 0.9 });
    comp.draw(renderer, L.upload(), out);
    return { bloom: 0.5, vignette: 0.4, ca: 0.5, halation: 0.2 };
  }

  // ---------------------------------------------------------------- 3 & 4: gold light
  gold(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, t0 = this.ctx.start, t1 = this.ctx.end;
    const la = this.la, lz = this.lb2, n = this.n;
    const v = n === 3
      ? lerpView({ cx: 30, cy: 40, s: 16, rot: 0.1 }, { cx: 36, cy: 44, s: 21, rot: 0.0 }, prog(t, t0, t1, ease.inOutSine))
      : lerpView({ cx: 46, cy: 58, s: 13, rot: -0.05 }, { cx: 50, cy: 56, s: 17, rot: 0.04 }, prog(t, t0, t1, ease.inOutSine));
    const warm = n === 3 ? prog(t, t0, t0 + 2.5, ease.inOutSine) : 1;
    // 4: ghost contours, fading out word by word through the first line
    const words = la.words;
    let ghost = 0;
    if (n === 4) {
      let sung = 0;
      for (const w of words) sung += Lyrics.wordProgress(w, t);
      ghost = 1 - sung / words.length;
    }
    this.terrain.draw(renderer, out, { view: v, mapMix: 0, warmth: warm, ghost, terrInk: 0.5, relief: 3.2, t, contour: 0.05, sun: [-0.75, -0.35, 0.42] });
    const lb = this.lb; lb.clear();
    drawTrack(lb, v, track().total, t, { width: 2.4, head: 1 });
    lb.render(renderer, out);
    const L = this.text, c = L.ctx; L.clear();
    if (n === 3) {
      // the map as an inset (top right), shrinking: paper, coast, the plan
      const k = prog(t, t0 + 0.5, t1, ease.inOutSine);
      const iw = lerp(520, 300, k), ih = iw * 0.62, ix = 1800 - iw, iy = 110;
      c.fillStyle = rgba('bone', 0.96); c.fillRect(ix, iy, iw, ih);
      c.strokeStyle = rgba('ink', 0.9); c.lineWidth = 1.2; c.strokeRect(ix + 5, iy + 5, iw - 10, ih - 10);
      // a schematic of the plan inside it
      const vi: View = { cx: 40, cy: 38, s: iw / 80, rot: 0 };
      const map = (x: number, y: number) => { const p = w2s(vi, x, y); return { x: ix + iw / 2 + (p.x - 960), y: iy + ih / 2 + (p.y - 540) }; };
      c.strokeStyle = rgba('ink', 0.85); c.lineWidth = 1.4;
      c.beginPath();
      [[9, 62], [20, 54], [34, 47], [47, 37], [56, 30], [64, 22], [69, 11]].forEach(([x, y], j) => { const p = map(x!, y!); if (j) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); });
      c.stroke();
      mono(c, 'THE MAP', ix + 14, iy + ih + 22, { size: 11, color: rgba('bone', 0.8), track: 4 });
      mono(c, `${Math.round(lerp(18, 6, k))}% OF THE FRAME`, ix + iw - 10, iy + ih + 22, { size: 11, color: rgba('signal', 0.95), track: 2, align: 'right' });
    }
    const stA = { family: F.archivo(112.5, 900), size: n === 4 ? 84 : 104, tracking: -3, sung: rgba('bone', 1), unsung: rgba('bone', 0.15), active: rgba('ember', 1), lead: 0.5 };
    if (n === 4) {
      drawKaraoke(c, la, 960, 520, t, { ...stA, align: 'center' });
      drawKaraoke(c, lz, 960, 640, t, { ...stA, family: F.archivo(100, 700), size: 72, tracking: -1, lead: 0.9, align: 'center' });
      if (ghost > 0.02) mono(c, `MAP REMAINING ${(ghost * 100).toFixed(0)}%`, 960, 720, { size: 12, color: rgba('bone', 0.7), track: 4, align: 'center' });
    } else {
      drawKaraoke(c, la, 120, 860, t, { ...stA, size: 86, tracking: -2.5 });
      drawKaraoke(c, lz, 120, 950, t, { ...stA, family: F.archivo(100, 700), size: 62, tracking: -1, lead: 0.9 });
    }
    comp.draw(renderer, L.upload(), out);
    return { bloom: 0.6, vignette: 0.35, ca: 0.4, halation: 0.3 };
  }
}
