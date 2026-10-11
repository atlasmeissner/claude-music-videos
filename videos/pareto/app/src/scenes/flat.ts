// PLATE II `flat` — "The flat, surveyed".
//   A. "Woke up in a flat that's eighty percent mess": an architect's floor plan in ink on bone, overlaid
//      with the 10×10 survey grid handed over by the title page. Walls rule in on the first beats, the
//      furniture pops in, then mess (socks, mugs, books, a pizza box…) stamps into the grid word by word
//      until 80 of 100 cells are hatched; on "mess" the tally slams 80.0% and the 20 clean cells turn red.
//   B. "Spent four-fifths of the morning just trying to dress": the plan slides off; a five-hour dial
//      (07:00 → noon, one hour per fifth) ticks on every beat while a geometric figure tries outfits on and
//      off; the hand reaches 4/5 on "dress" and the last fifth of the morning fills red.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { F, font, layout } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { clamp, ease, lerp, prog, hash, TAU } from '../engine/util';
import { Ground, PAPER_POST, VITAL20, drawKaraokeWords, drawPlateHead, footnote, fg, RED, wordIn, type C2D } from './_kit';

// ---------------------------------------------------------------- layout
const CELL = 64;
const PX = 168, PY = 236; // plan top-left (10×10 cells of 64 px → 640 px square)
const TX = 948, TW = 860; // lyric column
const ROWS_Y = [432, 534, 636];
const LYR_FAMILY = F.archivo(87.5, 800);
const CLK = { x: 440, y: 590, r: 248 };
const FIG = { x: 806, foot: 842 };

const u = (v: number) => PX + v * CELL;
const v = (w: number) => PY + w * CELL;

/** Walls in cell units [x1,y1,x2,y2] (gaps are doors and windows). */
const OUTER: number[][] = [
  [0, 0, 1.5, 0], [3.5, 0, 8, 0], [9, 0, 10, 0], [10, 0, 10, 10],
  [0, 10, 1.5, 10], [3.5, 10, 6.2, 10], [7.2, 10, 10, 10],
  [0, 0, 0, 6.5], [0, 8.5, 0, 10],
];
const INNER: number[][] = [
  [5, 0, 5, 5], [0, 5, 3.4, 5], [4.4, 5, 5, 5],
  [7, 0, 7, 3.5], [7, 3.5, 7.3, 3.5], [8.3, 3.5, 10, 3.5],
];
const WINDOWS: number[][] = [[1.5, 0, 3.5, 0], [8, 0, 9, 0], [1.5, 10, 3.5, 10], [0, 6.5, 0, 8.5]];
/** Doors: hinge x,y and the closed leaf's angle; each swings a quarter turn clockwise to open. */
const DOORS: number[][] = [[4.4, 5, Math.PI], [8.3, 3.5, Math.PI], [7.2, 10, Math.PI]];

type Stamp = { cell: number; t: number; icon: number; rot: number; s: number; dx: number; dy: number };

export default class Flat extends Scene {
  g = new Ground();
  L = new Layer2D();
  L1!: Line; L2!: Line;
  B: number[] = [];
  stamps: Stamp[] = [];
  rows1: Word[][] = []; rows2: Word[][] = [];
  size1 = 92; size2 = 92;
  tMess = 0; tFour = 0; tDress = 0;

  override init() {
    const { lyrics, audio, start } = this.ctx;
    this.L1 = lyrics.get('Woke up in a flat');
    this.L2 = lyrics.get('four-fifths of the morning');
    const b0 = Math.round(audio.beatAt(start));
    for (let k = 0; k <= 18; k++) this.B.push(audio.timeOfBeat(b0 + k));
    this.tMess = wordIn(this.L1, 'mess').start;
    this.tFour = wordIn(this.L2, 'four-fifths').start;
    this.tDress = wordIn(this.L2, 'dress').start;

    // mess census: 80 cells (everything but the vital 20), stamped in batches on the sung words
    const cells = Array.from({ length: 100 }, (_, i) => i).filter((i) => !VITAL20.includes(i));
    cells.sort((a, b) => hash(a, 31) - hash(b, 31));
    const batches: [string, number][] = [['flat', 12], ["that's", 12], ['eighty', 22], ['percent', 34]];
    let k = 0;
    for (const [q, n] of batches) {
      const w = wordIn(this.L1, q);
      const end = q === 'percent' ? this.tMess - 0.02 : w.end;
      for (let j = 0; j < n; j++) {
        const cell = cells[k]!;
        this.stamps.push({
          cell, t: lerp(w.start, end, j / n), icon: Math.floor(hash(cell, 5) * 8), rot: (hash(cell, 6) - 0.5) * 1.2,
          s: 0.8 + 0.25 * hash(cell, 7), dx: (hash(cell, 8) - 0.5) * 10, dy: (hash(cell, 9) - 0.5) * 10,
        });
        k++;
      }
    }

    // lyric rows (hand-set rag) and a size that fits the column
    const pick = (l: Line, cuts: number[]) => {
      const rows: Word[][] = []; let a = 0;
      for (const c of [...cuts, l.words.length]) { rows.push(l.words.slice(a, c)); a = c; }
      return rows;
    };
    this.rows1 = pick(this.L1, [5, 8]); // Woke up in a flat / that's eighty percent / mess
    this.rows2 = pick(this.L2, [2, 5]); // Spent four-fifths / of the morning / just trying to dress
    const fit = (rows: Word[][]) => {
      let s = 100;
      for (const r of rows) {
        const wd = layout(r.map((w) => w.w).join(' '), LYR_FAMILY, 100).width;
        s = Math.min(s, (100 * TW) / wd);
      }
      return Math.floor(Math.min(s, 104));
    };
    this.size1 = fit(this.rows1);
    this.size2 = fit(this.rows2);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, B = this.B;
    this.g.render(renderer, out, { paper: 1, grid: 16, gridA: 0.07, vig: 0.22 });
    const c = this.L.ctx; this.L.clear();

    const tB = B[8]!; // the reframe into part B (beat before "Spent")
    const out1 = prog(t, tB, tB + 0.42, ease.outExpo);

    drawPlateHead(c, 2, 'The flat, surveyed', (t - this.ctx.start) / 0.6, { right: 'SHEET 1 OF 1 · SCALE 1:50 · AS FOUND 07:42' });

    // ---------------- A: the plan (slides off left in B)
    if (out1 < 1) {
      c.save();
      // camera: settles out of the title page's zoom, then nudges in on each downbeat
      const settle = prog(t, B[0]!, B[1]!, ease.outExpo);
      const bars = this.stepCount(t, [B[1]!, B[5]!]) * 0.012;
      const sc = lerp(1.22, 1, settle) + bars;
      const cx = PX + 5 * CELL, cy = PY + 5 * CELL;
      c.translate(cx - out1 * 1150, cy); c.scale(sc, sc); c.translate(-cx, -cy);
      c.globalAlpha = 1 - out1 * 0.6;
      this.drawPlan(c, t);
      c.restore();
    }

    // ---------------- B: the dial and the dressing
    if (t >= tB) {
      this.drawClock(c, t);
      this.drawFigure(c, t);
    }

    // ---------------- lyric column
    this.drawTitleBlock(c, t, out1);
    this.drawLyrics(c, t, out1);
    this.drawLedger(c, t, out1);

    // footnotes
    footnote(c, '¹ n = 1 flat. Survey by eye; socks counted twice.', 96, 1004, { a: 1 - out1 });
    if (t >= tB) footnote(c, '² n = 1 morning. One hour per fifth; the second sock was not located.', 96, 1004, { a: out1 });

    comp.draw(renderer, this.L.upload(), out);

    // punch-ins on the two payoffs
    const slam = Math.exp(-Math.max(0, t - this.tMess) * 7) * (t >= this.tMess ? 1 : 0);
    const slam2 = Math.exp(-Math.max(0, t - B[15]!) * 7) * (t >= B[15]! ? 1 : 0);
    return { ...PAPER_POST, zoom: 1 + 0.018 * slam + 0.014 * slam2 };
  }

  /** Number of keys passed, with an outExpo ease into each one (a stepped counter). */
  stepCount(t: number, ks: number[], dur = 0.35) {
    let n = 0;
    for (const k of ks) n += prog(t, k, k + dur, ease.outExpo);
    return n;
  }

  // ------------------------------------------------------------ the plan
  drawPlan(c: C2D, t: number) {
    const B = this.B;
    c.lineCap = 'butt'; c.lineJoin = 'miter';
    // survey grid (from the title page) with census coordinates
    const gk = prog(t, B[0]! - 0.2, B[0]! + 0.3);
    c.strokeStyle = fg(true, 0.28 * gk); c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i <= 10; i++) { c.moveTo(u(i), v(0)); c.lineTo(u(i), v(10)); c.moveTo(u(0), v(i)); c.lineTo(u(10), v(i)); }
    c.stroke();
    c.font = font(F.mono(500), 11); c.fillStyle = fg(true, 0.5 * gk); c.textAlign = 'center';
    for (let i = 0; i < 10; i++) {
      c.fillText('ABCDEFGHIJ'[i]!, u(i + 0.5), v(0) - 30);
      c.fillText(String(i + 1), u(0) - 30, v(i + 0.5) + 4);
    }
    c.textAlign = 'left';

    // the 20 clean cells turn red on "mess"
    if (t >= this.tMess) {
      VITAL20.forEach((cell, j) => {
        const k = prog(t, this.tMess + j * 0.012, this.tMess + j * 0.012 + 0.25, ease.outBack);
        if (k <= 0) return;
        const x = u(cell % 10), y = v(Math.floor(cell / 10));
        const d = (CELL * (1 - k)) / 2;
        c.fillStyle = RED(0.88);
        c.fillRect(x + d + 3, y + d + 3, (CELL - 6) * k, (CELL - 6) * k);
      });
    }

    // hatch of the mess cells
    c.save();
    c.strokeStyle = fg(true, 0.2); c.lineWidth = 1;
    c.beginPath();
    for (const s of this.stamps) {
      if (t < s.t) continue;
      const x = u(s.cell % 10), y = v(Math.floor(s.cell / 10));
      for (let i = 1; i < 8; i++) {
        const o = (i / 8) * CELL * 2;
        const x0 = x + Math.max(0, o - CELL), y0 = y + Math.min(o, CELL);
        const x1 = x + Math.min(o, CELL), y1 = y + Math.max(0, o - CELL);
        c.moveTo(x0, y0); c.lineTo(x1, y1);
      }
    }
    c.stroke();
    c.restore();

    // furniture (pops in on beats 2–3)
    const fk1 = prog(t, B[2]!, B[2]! + 0.3, ease.outBack), fk2 = prog(t, B[3]!, B[3]! + 0.3, ease.outBack);
    c.strokeStyle = fg(true, 0.85); c.lineWidth = 1.4;
    this.pop(c, fk1, 1.6, 2.0, () => { // bed + bedside
      this.rr(c, 0.3, 0.4, 2.9, 3.6, 6); this.rr(c, 0.5, 0.62, 1.5, 1.2, 5); this.rr(c, 1.7, 0.62, 2.7, 1.2, 5);
      this.ln(c, 0.3, 1.6, 2.9, 1.6); this.ln(c, 2.2, 1.6, 2.9, 2.3);
      this.rr(c, 3.1, 0.4, 3.7, 1.0, 2);
    });
    this.pop(c, fk2, 4.4, 1.3, () => { // wardrobe with rail and hangers
      this.rr(c, 3.9, 0.15, 4.85, 2.4, 1);
      c.setLineDash([3, 3]); this.ln(c, 4.37, 0.3, 4.37, 2.25); c.setLineDash([]);
      for (let i = 0; i < 6; i++) this.ln(c, 4.17, 0.45 + i * 0.32, 4.57, 0.45 + i * 0.32);
    });
    this.pop(c, fk2, 8.6, 1.5, () => { // bath, toilet, basin
      this.rr(c, 8.0, 0.2, 9.8, 1.3, 3); this.rr(c, 8.15, 0.35, 9.65, 1.15, 14);
      this.rr(c, 7.12, 1.5, 7.42, 2.3, 2); this.el(c, 7.8, 1.9, 0.36, 0.28);
      this.rr(c, 9.3, 2.2, 9.9, 3.1, 2); this.el(c, 9.6, 2.65, 0.2, 0.28);
    });
    this.pop(c, fk1, 1.8, 7.7, () => { // sofa, rug, coffee table
      this.rr(c, 0.25, 6.2, 1.25, 9.2, 4); this.ln(c, 0.55, 6.5, 0.55, 8.9); this.ln(c, 0.25, 6.5, 1.25, 6.5); this.ln(c, 0.25, 8.9, 1.25, 8.9);
      c.setLineDash([2, 4]); this.rr(c, 1.6, 6.4, 3.8, 9.0, 10); c.setLineDash([]);
      this.rr(c, 2.1, 7.0, 3.2, 8.4, 2);
    });
    this.pop(c, fk2, 6.0, 6.8, () => { // table + chairs
      c.beginPath(); c.arc(u(6.0), v(6.7), 0.7 * CELL, 0, TAU); c.stroke();
      this.rr(c, 4.85, 6.45, 5.25, 6.95, 2); this.rr(c, 6.75, 6.45, 7.15, 6.95, 2); this.rr(c, 5.75, 7.45, 6.25, 7.85, 2);
    });
    this.pop(c, fk1, 9.5, 7.0, () => { // kitchen run: counter, sink, hob, fridge
      this.ln(c, 9.1, 4.6, 9.1, 9.4); this.ln(c, 9.1, 4.6, 10, 4.6); this.ln(c, 9.1, 9.4, 10, 9.4);
      this.rr(c, 9.25, 5.2, 9.85, 6.2, 4); c.beginPath(); c.arc(u(9.55), v(5.7), 3, 0, TAU); c.stroke();
      for (const [a, b] of [[9.35, 7.5], [9.75, 7.5], [9.35, 8.1], [9.75, 8.1]]) { c.beginPath(); c.arc(u(a!), v(b!), 0.16 * CELL, 0, TAU); c.stroke(); }
      this.rr(c, 7.9, 9.2, 8.85, 9.92, 1); this.ln(c, 7.9, 9.4, 8.85, 9.4);
    });

    // walls: outer rule in on the first beat, partitions on the downbeat
    const wk1 = prog(t, B[0]!, B[1]!, ease.outExpo), wk2 = prog(t, B[1]!, B[1]! + 0.45, ease.outExpo);
    c.strokeStyle = fg(true, 0.95); c.lineCap = 'square';
    c.lineWidth = 7; this.walls(c, OUTER, wk1);
    c.lineWidth = 4.5; this.walls(c, INNER, wk2);
    c.lineCap = 'butt';
    // windows (two hairlines across the gap) and doors (leaf + dashed swing)
    c.lineWidth = 1.2; c.strokeStyle = fg(true, 0.85 * wk1);
    for (const [x1, y1, x2, y2] of WINDOWS) {
      const hz = y1 === y2, o = 3.5;
      c.beginPath();
      if (hz) { c.moveTo(u(x1!), v(y1!) - o); c.lineTo(u(x2!), v(y2!) - o); c.moveTo(u(x1!), v(y1!) + o); c.lineTo(u(x2!), v(y2!) + o); }
      else { c.moveTo(u(x1!) - o, v(y1!)); c.lineTo(u(x2!) - o, v(y2!)); c.moveTo(u(x1!) + o, v(y1!)); c.lineTo(u(x2!) + o, v(y2!)); }
      c.stroke();
    }
    const dk = prog(t, B[1]! + 0.15, B[2]!, ease.outCubic);
    if (dk > 0) {
      for (const [hx, hy, a0] of DOORS) {
        const x = u(hx!), y = v(hy!), r = CELL;
        const aa = a0! + (Math.PI / 2) * dk;
        c.strokeStyle = fg(true, 0.9); c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(aa) * r, y + Math.sin(aa) * r); c.stroke();
        c.lineWidth = 1; c.setLineDash([3, 4]); c.strokeStyle = fg(true, 0.55);
        c.beginPath(); c.arc(x, y, r, a0!, aa); c.stroke(); c.setLineDash([]);
      }
    }

    // room labels and dimensions
    const lk = prog(t, B[3]!, B[3]! + 0.5);
    if (lk > 0) {
      c.font = font(F.mono(500), 12); c.fillStyle = fg(true, 0.6 * lk); c.textAlign = 'center';
      const lab = (s: string, x: number, y: number) => c.fillText(s.slice(0, Math.ceil(s.length * clamp(lk * 1.5))), u(x), v(y));
      lab('BED', 2.0, 4.55); lab('BATH', 8.65, 2.55); lab('LIVING', 2.6, 5.75); lab('HALL', 6.0, 4.4); lab('KITCHEN', 8.1, 5.0);
      c.textAlign = 'left';
      // dimension lines
      c.strokeStyle = fg(true, 0.45 * lk); c.lineWidth = 1;
      const dy = v(10) + 34;
      c.beginPath(); c.moveTo(u(0), dy); c.lineTo(u(10), dy);
      c.moveTo(u(0), dy - 6); c.lineTo(u(0), dy + 6); c.moveTo(u(10), dy - 6); c.lineTo(u(10), dy + 6); c.stroke();
      c.fillStyle = bone(); c.fillRect(u(5) - 34, dy - 8, 68, 16);
      c.fillStyle = fg(true, 0.6 * lk); c.textAlign = 'center'; c.fillText('6 400', u(5), dy + 4); c.textAlign = 'left';
      // north arrow
      const nx = u(10) + 46, ny = v(0) + 30;
      c.strokeStyle = fg(true, 0.6 * lk); c.beginPath(); c.arc(nx, ny, 14, 0, TAU); c.stroke();
      c.fillStyle = fg(true, 0.7 * lk); c.beginPath(); c.moveTo(nx, ny - 13); c.lineTo(nx + 5, ny + 4); c.lineTo(nx, ny + 1); c.lineTo(nx - 5, ny + 4); c.closePath(); c.fill();
      c.font = font(F.mono(600), 11); c.textAlign = 'center'; c.fillText('N', nx, ny - 20); c.textAlign = 'left';
    }

    // mess icons stamp in
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of this.stamps) {
      if (t < s.t) continue;
      const age = t - s.t;
      const k = clamp(age / 0.14);
      const sc = lerp(1.7, 1, ease.outCubic(k)) * s.s;
      const x = u(s.cell % 10) + CELL / 2 + s.dx, y = v(Math.floor(s.cell / 10)) + CELL / 2 + s.dy;
      c.save();
      c.translate(x, y); c.rotate(s.rot); c.scale(sc, sc);
      c.globalAlpha *= lerp(0.2, 1, k);
      c.strokeStyle = fg(true, 0.82); c.lineWidth = 1.6 / sc;
      drawMessIcon(c, s.icon);
      c.restore();
    }
  }

  walls(c: C2D, ws: number[][], k: number) {
    if (k <= 0) return;
    c.beginPath();
    for (const [x1, y1, x2, y2] of ws) {
      c.moveTo(u(x1!), v(y1!)); c.lineTo(u(lerp(x1!, x2!, k)), v(lerp(y1!, y2!, k)));
    }
    c.stroke();
  }
  pop(c: C2D, k: number, cx: number, cy: number, fn: () => void) {
    if (k <= 0) return;
    c.save();
    const x = u(cx), y = v(cy);
    c.translate(x, y); c.scale(k, k); c.translate(-x, -y);
    c.lineWidth = 1.4 / Math.max(0.3, k);
    fn();
    c.restore();
  }
  rr(c: C2D, x1: number, y1: number, x2: number, y2: number, r: number) {
    c.beginPath(); c.roundRect(u(x1), v(y1), (x2 - x1) * CELL, (y2 - y1) * CELL, r); c.stroke();
  }
  ln(c: C2D, x1: number, y1: number, x2: number, y2: number) {
    c.beginPath(); c.moveTo(u(x1), v(y1)); c.lineTo(u(x2), v(y2)); c.stroke();
  }
  el(c: C2D, x: number, y: number, rx: number, ry: number) {
    c.beginPath(); c.ellipse(u(x), v(y), rx * CELL, ry * CELL, 0, 0, TAU); c.stroke();
  }

  // ------------------------------------------------------------ the five-hour dial
  /** Hand angle (0..1 of the dial) — ticks on every beat from "four-fifths" to "dress". */
  handAt(t: number) {
    const B = this.B;
    const steps = [9, 10, 11, 12, 13, 14, 15].map((i) => B[i]!);
    let a = 0;
    for (const s of steps) a += prog(t, s, s + 0.2, (x) => ease.outBack(x, 2.2)) * (0.8 / steps.length);
    return a;
  }

  drawClock(c: C2D, t: number) {
    const B = this.B, { x, y, r } = CLK;
    const tB = B[8]!;
    const k = prog(t, tB, tB + 0.5, ease.outExpo);
    const slide = (1 - k) * 260;
    c.save();
    c.translate(slide, 0);
    const A = (p: number) => -Math.PI / 2 + p * TAU;
    // sweep: hatched graphite wedge (the morning spent dressing)
    const h = this.handAt(t);
    if (h > 0.001) {
      c.save();
      c.beginPath(); c.moveTo(x, y); c.arc(x, y, r * 0.92, A(0), A(h)); c.closePath(); c.clip();
      c.fillStyle = fg(true, 0.06); c.fillRect(x - r, y - r, 2 * r, 2 * r);
      c.strokeStyle = fg(true, 0.32); c.lineWidth = 1;
      c.beginPath();
      for (let i = -r * 2; i < r * 2; i += 9) { c.moveTo(x + i, y - r); c.lineTo(x + i + 2 * r, y + r); }
      c.stroke();
      c.restore();
    }
    // the last fifth fills red on "dress"
    const rk = prog(t, B[15]!, B[15]! + 0.4, ease.outExpo);
    if (rk > 0) {
      c.fillStyle = RED();
      c.beginPath(); c.moveTo(x, y); c.arc(x, y, r * 0.92, A(0.8), A(0.8 + 0.2 * rk)); c.closePath(); c.fill();
    }
    // dial: rim draws round, then ticks
    c.strokeStyle = fg(true, 0.9); c.lineWidth = 3;
    c.beginPath(); c.arc(x, y, r, A(0), A(k)); c.stroke();
    c.lineWidth = 1; c.strokeStyle = fg(true, 0.5);
    c.beginPath(); c.arc(x, y, r * 0.92, A(0), A(k)); c.stroke();
    for (let i = 0; i < 60; i++) {
      const p = i / 60;
      if (p > k) break;
      const major = i % 12 === 0, half = i % 6 === 0;
      const r0 = r * (major ? 0.8 : half ? 0.85 : 0.88);
      c.lineWidth = major ? 3 : 1.2; c.strokeStyle = fg(true, major ? 0.9 : 0.6);
      c.beginPath(); c.moveTo(x + Math.cos(A(p)) * r0, y + Math.sin(A(p)) * r0); c.lineTo(x + Math.cos(A(p)) * r * 0.92, y + Math.sin(A(p)) * r * 0.92); c.stroke();
    }
    // hour numerals: one hour per fifth of the morning
    c.font = font(F.mono(500), 22); c.textAlign = 'center'; c.fillStyle = fg(true, 0.85 * k);
    const hrs = ['07:00', '08:00', '09:00', '10:00', '11:00'];
    hrs.forEach((s, i) => {
      const p = i / 5, rr = r * 0.66;
      c.fillText(s, x + Math.cos(A(p)) * rr, y + Math.sin(A(p)) * rr + 8);
    });
    c.font = font(F.mono(400), 12); c.fillStyle = fg(true, 0.5 * k);
    c.fillText('(also noon)', x, y - r * 0.66 + 26);
    if (rk > 0) {
      c.save();
      c.beginPath(); c.moveTo(x, y); c.arc(x, y, r * 0.92, A(0.8), A(0.8 + 0.2 * rk)); c.closePath(); c.clip();
      c.font = font(F.mono(500), 22); c.fillStyle = bone();
      hrs.forEach((s2, i) => { const p = i / 5, rr = r * 0.66; c.fillText(s2, x + Math.cos(A(p)) * rr, y + Math.sin(A(p)) * rr + 8); });
      c.font = font(F.mono(400), 12); c.fillText('(also noon)', x, y - r * 0.66 + 26);
      c.restore();
    }
    // 4/5 dimension arc outside the rim, drawn on "four-fifths"
    const dk = prog(t, this.tFour, this.tFour + 0.45, ease.outExpo);
    if (dk > 0) {
      const R = r + 30;
      c.strokeStyle = fg(true, 0.75); c.lineWidth = 1.2;
      c.beginPath(); c.arc(x, y, R, A(0), A(0.8 * dk)); c.stroke();
      for (const p of [0, 0.8 * dk]) {
        c.beginPath(); c.moveTo(x + Math.cos(A(p)) * (R - 8), y + Math.sin(A(p)) * (R - 8)); c.lineTo(x + Math.cos(A(p)) * (R + 8), y + Math.sin(A(p)) * (R + 8)); c.stroke();
      }
      // the label breaks the dimension line at the bottom, like an architect's dimension
      if (0.8 * dk > 0.5) {
        c.font = font(F.mono(600), 15); c.textAlign = 'center';
        const lab = '4/5 — GETTING DRESSED', lw = c.measureText(lab).width + 18;
        c.fillStyle = bone(); c.fillRect(x - lw / 2, y + R - 10, lw, 20);
        c.fillStyle = fg(true, 0.85 * clamp((0.8 * dk - 0.5) * 6)); c.fillText(lab, x, y + R + 5);
      }
    }
    if (rk > 0) {
      const pa = A(0.9), R = r + 14;
      c.font = font(F.mono(600), 15); c.fillStyle = RED(rk); c.textAlign = 'right';
      c.fillText('1/5 — EVERYTHING ELSE', x + Math.cos(pa) * R, y + Math.sin(pa) * R - 6);
    }
    // hand
    const ha = A(h);
    c.strokeStyle = fg(true, 0.95); c.lineCap = 'round';
    c.lineWidth = 5; c.beginPath(); c.moveTo(x - Math.cos(ha) * 34, y - Math.sin(ha) * 34); c.lineTo(x + Math.cos(ha) * r * 0.86, y + Math.sin(ha) * r * 0.86); c.stroke();
    c.fillStyle = fg(true, 1); c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill();
    c.fillStyle = bone(); c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
    // digital readout
    const mins = Math.round(h * 300);
    const hh = 7 + Math.floor(mins / 60), mm = mins % 60;
    c.font = font(F.mono(500), 18); c.fillStyle = fg(true, 0.75 * k); c.textAlign = 'center';
    c.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ·  ${(h * 100).toFixed(0).padStart(2, '0')}% OF THE MORNING`, x, y + r + 86);
    c.restore();
  }

  // ------------------------------------------------------------ outfits, tried on and off
  drawFigure(c: C2D, t: number) {
    const B = this.B, { x, foot } = FIG;
    const tB = B[8]!;
    const k = prog(t, tB + 0.1, tB + 0.5, ease.outExpo);
    if (k <= 0) return;
    c.save();
    c.translate(0, (1 - k) * 60); c.globalAlpha = k;
    const headY = foot - 380, shY = headY + 52, hipY = shY + 150;
    // body: circle head + capsules (outline on bone)
    c.lineWidth = 2; c.strokeStyle = fg(true, 0.9); c.fillStyle = bone();
    cap(c, x - 15, hipY - 6, x - 15, foot - 10, 13); cap(c, x + 15, hipY - 6, x + 15, foot - 10, 13);
    cap(c, x - 38, shY + 12, x - 50, shY + 128, 11); cap(c, x + 38, shY + 12, x + 50, shY + 128, 11);
    cap(c, x, shY + 20, x, hipY, 34);
    c.beginPath(); c.arc(x, headY, 27, 0, TAU); c.fill(); c.stroke();

    // garments: [slot, kind] per attempt, on beats 9..15
    const plan: [number, number][] = [[0, 0], [0, 1], [0, 0], [1, 2], [1, 3], [1, 2], [2, 4]];
    const at = plan.map((_, i) => B[9 + i]!);
    for (let i = 0; i < plan.length; i++) {
      const [slot, kind] = plan[i]!;
      const tin = at[i]!;
      if (t < tin) continue;
      // replaced by the next attempt in the same slot?
      let tout = Infinity;
      for (let j = i + 1; j < plan.length; j++) if (plan[j]![0] === slot) { tout = at[j]!; break; }
      const kin = prog(t, tin, tin + 0.22, ease.outBack);
      const ko = prog(t, tout, tout + 0.32, ease.inCubic);
      if (ko >= 1) continue;
      c.save();
      const dir = hash(i, 3) > 0.5 ? 1 : -1;
      c.translate(ko * dir * 60, -(1 - kin) * 70 - ko * 260);
      const cxr = x, cyr = slot === 0 ? shY + 70 : hipY + 60;
      c.translate(cxr, cyr); c.rotate(ko * dir * 0.9); c.translate(-cxr, -cyr);
      c.globalAlpha *= clamp(kin * 2) * (1 - ko);
      drawGarment(c, kind, x, shY, hipY, foot);
      c.restore();
    }
    // caption
    const n = plan.filter((_, i) => t >= at[i]!).length;
    c.font = font(F.mono(500), 13); c.textAlign = 'center'; c.fillStyle = fg(true, 0.7);
    c.fillText(`ATTEMPT ${String(Math.max(1, n)).padStart(2, '0')}`, x, foot + 40);
    c.restore();
  }

  // ------------------------------------------------------------ title block + lyrics
  drawTitleBlock(c: C2D, t: number, out1: number) {
    const k = prog(t, this.ctx.start + 0.1, this.ctx.start + 0.7, ease.outExpo);
    const y = 300;
    c.save();
    c.strokeStyle = fg(true, 0.5); c.lineWidth = 1;
    c.beginPath(); c.moveTo(TX, y); c.lineTo(TX + TW * k, y); c.stroke();
    c.font = font(F.mono(500), 13); c.fillStyle = fg(true, 0.7);
    const a = out1 < 0.5 ? 'FIG. 1 — FLOOR PLAN, AS FOUND' : 'FIG. 2 — THE MORNING, ITEMISED';
    const b = out1 < 0.5 ? 'CENSUS OF 100 CELLS' : 'ONE HOUR PER FIFTH';
    c.fillText(a.slice(0, Math.ceil(a.length * k)), TX, y - 12);
    c.textAlign = 'right'; c.fillStyle = fg(true, 0.5);
    c.fillText(b, TX + TW, y - 12);
    c.restore();

    // tally (part A only)
    if (out1 < 1) {
      const n = this.stamps.filter((s) => t >= s.t).length;
      const slamK = t >= this.tMess ? Math.exp(-(t - this.tMess) * 9) : 0;
      const ty = 790;
      c.save();
      c.globalAlpha = clamp(1 - out1 * 2.5);
      c.translate(-out1 * 80, 0);
      c.font = font(F.mono(500), 14); c.fillStyle = fg(true, 0.65);
      c.fillText('MESS', TX, ty - 52);
      c.save();
      c.translate(TX, ty); c.scale(1 + slamK * 0.18, 1 + slamK * 0.18);
      c.font = font(F.mono(600), 58); c.fillStyle = fg(true, 0.92);
      c.fillText(`${n.toFixed(1).padStart(4, '0')}%`, 0, 0);
      c.restore();
      // the 100-cell strip: graphite per stamped cell, the vital 20 red on "mess"
      const sx = TX + 250, sw = TW - 250, cw = sw / 100;
      for (let i = 0; i < 100; i++) {
        const xx = sx + i * cw;
        if (i < n) { c.fillStyle = fg(true, 0.62); c.fillRect(xx, ty - 40, cw - 1.5, 40); }
        else if (i >= 80 && t >= this.tMess) {
          const kk = prog(t, this.tMess + (i - 80) * 0.012, this.tMess + (i - 80) * 0.012 + 0.2, ease.outExpo);
          c.fillStyle = RED(); c.fillRect(xx, ty - 40 * kk, cw - 1.5, 40 * kk);
        } else { c.strokeStyle = fg(true, 0.25); c.lineWidth = 1; c.strokeRect(xx + 0.5, ty - 39.5, cw - 2.5, 39); }
      }
      c.font = font(F.mono(500), 12); c.fillStyle = fg(true, 0.55);
      c.fillText('0', sx, ty + 20); c.textAlign = 'right'; c.fillText('100', sx + sw, ty + 20);
      if (t >= this.tMess) {
        const kk = prog(t, this.tMess + 0.15, this.tMess + 0.5);
        c.fillStyle = RED(kk); c.textAlign = 'right';
        c.fillText('CLEAR FLOOR 20.0%', sx + sw, ty - 52);
      }
      c.restore();
    }
  }

  drawLyrics(c: C2D, t: number, out1: number) {
    // the two lines roll through a window under the title rule: line 1 up and out, line 2 up and in
    const ROLL = 400;
    c.save();
    c.beginPath(); c.rect(TX - 20, 306, TW + 120, 392); c.clip();
    if (out1 < 1) {
      c.save();
      c.translate(0, -out1 * ROLL);
      this.rows1.forEach((row, i) => drawKaraokeWords(c, row, t, TX, ROWS_Y[i]!, { family: LYR_FAMILY, size: this.size1, paper: true, pop: 0.03, lead: 0.4 }));
      c.restore();
    }
    if (out1 > 0) {
      c.save();
      c.translate(0, (1 - out1) * ROLL);
      const boxes = this.rows2.map((row, i) => drawKaraokeWords(c, row, t, TX, ROWS_Y[i]!, { family: LYR_FAMILY, size: this.size2, paper: true, pop: 0.03, lead: 0.4 }));
      // "four-fifths": a 4/5 red rule (and a grey fifth) under the word, drawn as it is sung
      const ff = boxes.flat().find((b) => b.w.w.toLowerCase().startsWith('four'));
      if (ff && ff.p > 0) {
        c.fillStyle = RED();
        c.fillRect(ff.x, ff.y + 16, ff.width * 0.8 * ease.outCubic(ff.p), 6);
        c.fillStyle = fg(true, 0.25);
        c.fillRect(ff.x + ff.width * 0.8 + 4, ff.y + 16, (ff.width * 0.2 - 4) * ease.outCubic(ff.p), 6);
      }
      c.restore();
    }
    c.restore();
  }

  /** Part B's ledger of attempts (where part A's tally was). */
  drawLedger(c: C2D, t: number, out1: number) {
    if (out1 <= 0) return;
    const B = this.B;
    const rows: [string, string, number][] = [
      ['SHIRT', 'REJECTED', 10], ['JUMPER', 'REJECTED', 11], ['SHIRT, AGAIN', 'KEPT', 15],
      ['TROUSERS', 'REJECTED', 13], ['SHORTS', 'REJECTED (MARCH)', 14], ['TROUSERS, AGAIN', 'KEPT', 15],
      ['SOCKS', 'FOUND: 1 OF 2', 15],
    ];
    const y0 = 734, lh = 25;
    c.save();
    c.globalAlpha = clamp((out1 - 0.5) * 2);
    c.font = font(F.mono(500), 14); c.fillStyle = fg(true, 0.65);
    c.fillText('WARDROBE TRIALS', TX, y0 - 30);
    c.textAlign = 'right'; c.fillStyle = fg(true, 0.45); c.fillText('VERDICT', TX + TW, y0 - 30); c.textAlign = 'left';
    c.strokeStyle = fg(true, 0.35); c.lineWidth = 1;
    c.beginPath(); c.moveTo(TX, y0 - 20); c.lineTo(TX + TW, y0 - 20); c.stroke();
    rows.forEach(([item, verdict, vb], i) => {
      const tin = B[9 + i]!;
      if (t < tin) return;
      const k = prog(t, tin, tin + 0.18, ease.outCubic);
      const y = y0 + i * lh;
      c.save();
      c.globalAlpha *= k; c.translate((1 - k) * 24, 0);
      c.font = font(F.mono(500), 16); c.fillStyle = fg(true, 0.85);
      c.fillText(`${String(i + 1).padStart(2, '0')}  ${item}`, TX, y);
      const tv = B[vb]!;
      const last = i === rows.length - 1;
      // dot leader
      c.fillStyle = fg(true, 0.3);
      const lx0 = TX + 300, lx1 = TX + TW - 230;
      for (let x = lx0; x < lx1; x += 10) c.fillRect(x, y - 4, 2, 2);
      if (t >= tv) {
        const kv = prog(t, tv, tv + 0.15);
        c.globalAlpha *= kv;
        c.textAlign = 'right'; c.fillStyle = last ? RED() : verdict === 'KEPT' ? fg(true, 0.9) : fg(true, 0.5);
        c.fillText(verdict, TX + TW, y);
        if (verdict.startsWith('REJECTED')) { c.fillStyle = fg(true, 0.5); c.fillRect(TX + 38, y - 6, c.measureText(item).width * kv, 1.5); }
        c.textAlign = 'left';
      }
      c.restore();
    });
    c.restore();
  }
}

// ---------------------------------------------------------------- drawing helpers
const bone = (a = 1) => `rgba(241,235,221,${a})`;

function cap(c: C2D, x1: number, y1: number, x2: number, y2: number, r: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  c.beginPath();
  c.arc(x1, y1, r, a + Math.PI / 2, a - Math.PI / 2);
  c.arc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2);
  c.closePath(); c.fill(); c.stroke();
}

/** Clothing outlines over the figure. kind: 0 shirt, 1 jumper, 2 trousers, 3 shorts, 4 one red sock. */
function drawGarment(c: C2D, kind: number, x: number, shY: number, hipY: number, foot: number) {
  c.lineWidth = 2; c.lineJoin = 'round';
  c.strokeStyle = fg(true, 0.95);
  if (kind === 0 || kind === 1) {
    const sl = kind === 0 ? 50 : 118; // sleeve length
    c.fillStyle = kind === 0 ? bone() : 'rgba(156,151,143,1)';
    c.beginPath();
    c.moveTo(x - 20, shY + 2); c.lineTo(x - 46, shY + 8);
    c.lineTo(x - 66, shY + 8 + sl); c.lineTo(x - 42, shY + 14 + sl);
    c.lineTo(x - 36, shY + 60); c.lineTo(x - 38, hipY + 10); c.lineTo(x + 38, hipY + 10); c.lineTo(x + 36, shY + 60);
    c.lineTo(x + 42, shY + 14 + sl); c.lineTo(x + 66, shY + 8 + sl);
    c.lineTo(x + 46, shY + 8); c.lineTo(x + 20, shY + 2);
    c.quadraticCurveTo(x, shY + 22, x - 20, shY + 2);
    c.closePath(); c.fill(); c.stroke();
    if (kind === 0) { // placket + buttons
      c.beginPath(); c.moveTo(x, shY + 16); c.lineTo(x, hipY + 8); c.stroke();
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x + 6, shY + 34 + i * 30, 2, 0, TAU); c.stroke(); }
    } else { // ribbing
      c.lineWidth = 1;
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * 10, hipY - 2); c.lineTo(x + i * 10, hipY + 8); c.stroke(); }
    }
  } else if (kind === 2 || kind === 3) {
    const len = kind === 2 ? foot - hipY - 18 : 74;
    c.fillStyle = kind === 2 ? 'rgba(94,91,87,1)' : bone();
    c.beginPath();
    c.moveTo(x - 36, hipY - 8); c.lineTo(x + 36, hipY - 8);
    c.lineTo(x + 34, hipY + len); c.lineTo(x + 3, hipY + len); c.lineTo(x, hipY + 26);
    c.lineTo(x - 3, hipY + len); c.lineTo(x - 34, hipY + len); c.closePath();
    c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 36, hipY + 4); c.lineTo(x + 36, hipY + 4); c.stroke();
  } else {
    c.fillStyle = RED(); c.strokeStyle = RED();
    c.beginPath();
    c.moveTo(x + 3, foot - 22); c.lineTo(x + 27, foot - 22); c.lineTo(x + 27, foot - 6);
    c.lineTo(x + 44, foot - 6); c.arc(x + 44, foot + 3, 9, -Math.PI / 2, Math.PI / 2); c.lineTo(x + 8, foot + 12);
    c.quadraticCurveTo(x + 3, foot + 12, x + 3, foot + 4); c.closePath();
    c.fill();
  }
}

/** Line icons of domestic mess in a ±22 px box. */
function drawMessIcon(c: C2D, k: number) {
  c.beginPath();
  switch (k) {
    case 0: // sock
      c.moveTo(-6, -20); c.lineTo(6, -20); c.lineTo(6, 6); c.lineTo(18, 12); c.quadraticCurveTo(22, 20, 12, 20);
      c.lineTo(-2, 16); c.quadraticCurveTo(-8, 14, -6, 6); c.closePath();
      c.moveTo(-6, -13); c.lineTo(6, -13);
      break;
    case 1: // mug, top view: ring + handle + a tea ring stain
      c.arc(0, 0, 13, 0, TAU); c.moveTo(9, 0); c.arc(0, 0, 9, 0, TAU);
      c.moveTo(13, -4); c.lineTo(20, -4); c.lineTo(20, 4); c.lineTo(13, 4);
      c.moveTo(-6 + 17, 14); c.arc(-6, 14, 17, 0, 1.8);
      break;
    case 2: // book, open
      c.moveTo(0, -12); c.quadraticCurveTo(-10, -16, -20, -12); c.lineTo(-20, 14); c.quadraticCurveTo(-10, 10, 0, 14);
      c.quadraticCurveTo(10, 10, 20, 14); c.lineTo(20, -12); c.quadraticCurveTo(10, -16, 0, -12); c.lineTo(0, 14);
      c.moveTo(-15, -4); c.lineTo(-5, -5); c.moveTo(-15, 2); c.lineTo(-5, 1); c.moveTo(5, -5); c.lineTo(15, -4);
      break;
    case 3: // pizza box with a slice gone
      c.rect(-19, -19, 38, 38); c.moveTo(13, 0); c.arc(0, 0, 13, 0, TAU * 0.8); c.lineTo(0, 0); c.closePath();
      break;
    case 4: // shirt, crumpled
      c.moveTo(-6, -16); c.lineTo(-18, -10); c.lineTo(-14, -2); c.lineTo(-10, -5); c.lineTo(-11, 17); c.lineTo(11, 15);
      c.lineTo(10, -5); c.lineTo(15, -1); c.lineTo(19, -9); c.lineTo(6, -16); c.quadraticCurveTo(0, -11, -6, -16);
      break;
    case 5: // plate with crumbs and a fork
      c.arc(0, 0, 16, 0, TAU); c.moveTo(10, 0); c.arc(0, 0, 10, 0, TAU);
      c.moveTo(-20, 18); c.lineTo(4, -6);
      c.moveTo(3, 4); c.arc(2, 4, 1, 0, TAU); c.moveTo(-3, -2); c.arc(-4, -2, 1, 0, TAU);
      break;
    case 6: // can on its side
      c.ellipse(-12, 0, 5, 10, 0, 0, TAU); c.moveTo(-12, -10); c.lineTo(14, -10); c.ellipse(14, 0, 5, 10, 0, -Math.PI / 2, Math.PI / 2); c.lineTo(-12, 10);
      break;
    default: // crumpled paper
      c.moveTo(-14, -8); c.lineTo(-4, -16); c.lineTo(8, -12); c.lineTo(16, -2); c.lineTo(10, 12); c.lineTo(-4, 15); c.lineTo(-15, 6); c.closePath();
      c.moveTo(-4, -16); c.lineTo(0, -2); c.lineTo(16, -2); c.moveTo(0, -2); c.lineTo(-4, 15); c.moveTo(0, -2); c.lineTo(-15, 6);
  }
  c.stroke();
}
