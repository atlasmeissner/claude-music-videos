// PLATE VI / XI — "The Pareto chart". The chorus' first four lines.
// The sung words ARE the chart's data: each word drops a bar into a sorted Pareto chart the moment it
// is sung, tied to its word in the lyric line by a hairline leader (the leaders cross as the bars sort:
// a little sorting network). The red cumulative curve rides the bar tops; 20% of the words reach 80%.
//   L1 "Oh, give me the twenty…": 10 bars build, insertion-sorted; "twenty" and "lot" land red, the
//      curve shoots to 80% at x = 20%, guides + dot.
//   L2 "The cream of the crop…": the y-axis rescales to 21 bars on the beat; "cream" and "best" slot in
//      red; crop marks frame the vital fifth on "crop".
//   L3 "I don't need the filler…": leaders from "filler" / "weight" bracket the grey tail, strike it, and
//      the bars fall out of the frame on the beats. The curve flatlines at 80% (retained).
//   L4 "Just the twenty percent…": on the downbeat the 20% guide becomes a hard rule, the left fifth floods
//      red with the four survivors in it, the line takes the other 80% in big type; "great" slams.
// n=1: bone paper, ink, hatched filler. n=2 (XI): ink, bone, glowing red, heavier bars, beat-punch
// camera, inverted flash frames, and on "great" the red fifth takes the whole frame.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { clamp, ease, hash, lerp, noise1, prog, smoothstep, frameIdx } from '../engine/util';
import { Ground, drawPlateHead, footnote, fg, RED, wkey, wordIn, PAPER_POST, INK_POST } from './_kit';
import { drawWord, lay, popAt, chase, hatchRect, beatAfter, nearestOf, type WordStyle, type C2D } from './chorus-kit';

/** Chart box (logical px): left/right axis x, baseline, top. */
const CH = { x0: 150, x1: 1756, yb: 836, yt: 156 };
const CW = CH.x1 - CH.x0, CHH = CH.yb - CH.yt;
const X20 = CH.x0 + 0.2 * CW;
/** The lyric sits inside the chart, under the curve and over the tail: two big rows. */
const BOX = { x: X20 + 70, w: 1716 - (X20 + 70), r1: 572, maxSize: 150 };
/** Camera pivot. */
const PIV = { x: 960, y: 520 };
/** The red fifth after the split. */
const FIFTH = 384;
const CAP = 0.686;

type Cls = 'vital' | 'weight' | 'filler';
interface Bar {
  w: Word; label: string; li: number; cls: Cls;
  r1: number; r2: number; // rank in phase 1 (L1 only; -1 for L2) and phase 2
  w1: number; w2: number; // share of meaning in each phase
  tIn: number;
  tStrike: number; tFall: number; // Infinity for survivors
  spin: number; vx: number;
  evs: number[];
}

type BarDraw = { b: Bar; x: number; top: number; w: number; h: number; share: number; on: boolean };
const VITAL1 = ['twenty', 'lot'], VITAL2 = ['cream', 'best'];
const WEIGHT = ['give', 'gives', 'crop', 'got'];

function geomShares(n: number, r: number, total: number) {
  const a = Array.from({ length: n }, (_, i) => Math.pow(r, i));
  const s = a.reduce((x, y) => x + y, 0);
  return a.map((v) => (v / s) * total);
}

export default class Chorus extends Scene {
  n = 1;
  g = new Ground();
  L = new Layer2D();
  G = new Layer2D(); // glow layer (red, n=2)
  lines: Line[] = [];
  bars: Bar[] = [];
  events: number[] = [];
  tRescale = 0; tCrop = 0; tGuide = 0; tSplit = 0; tGreat = 0; tTwenty = 0;
  wFiller!: Word; wWeight!: Word; wGreat!: Word;
  fillFall: [number, number] = [0, 0]; weightFall = 0;
  band: { size: number; xs: number[]; ys: number[]; ws: number[] }[] = [];
  big = { size: 0, xs: [] as number[], ys: [] as number[], gSize: 0 };
  fam = F.archivo(62, 900);
  famBig = F.archivo(62, 900);
  famGreat = F.archivo(125, 900);
  max1 = 0.5; max2 = 0.3;
  bump = 0; // beat bump (0..~0.06)

  override init() {
    const { lyrics, params, audio: au } = this.ctx;
    this.n = Number(params.n ?? 1);
    const k = this.n - 1;
    const l1 = lyrics.get('give me the twenty', k), l2 = lyrics.get('cream of the crop', k);
    const l3 = lyrics.get('need the filler', k), l4 = lyrics.get('makes me feel great', k);
    this.lines = [l1, l2, l3, l4];
    this.wFiller = wordIn(l3, 'filler'); this.wWeight = wordIn(l3, 'weight'); this.wGreat = wordIn(l4, 'great');
    this.tTwenty = wordIn(l1, 'twenty').start;
    this.tGuide = wordIn(l1, 'lot').start;
    this.tCrop = wordIn(l2, 'crop').start;
    this.tRescale = beatAfter(au.beats, l1.end + 0.15);
    this.tSplit = nearestOf(au.downbeats, wordIn(l4, 'twenty').start);
    this.tGreat = this.wGreat.start;

    // ---- the data: one bar per word of lines 1–2
    const mk = (w: Word, li: number): Bar => {
      const key = wkey(w.w);
      const cls: Cls = [...VITAL1, ...VITAL2].includes(key) ? 'vital' : WEIGHT.includes(key) ? 'weight' : 'filler';
      return { w, label: w.w.toLowerCase().replace(/[^a-z’']/g, ''), li, cls, r1: -1, r2: -1, w1: 0, w2: 0, tIn: w.start, tStrike: Infinity, tFall: Infinity, spin: 0, vx: 0, evs: [] };
    };
    const b1 = l1.words.map((w) => mk(w, 0)), b2 = l2.words.map((w) => mk(w, 1));
    const dur = (b: Bar) => b.w.end - b.w.start;
    const order = (bs: Bar[], vit: string[]) => {
      const v = vit.map((q) => bs.find((b) => wkey(b.w.w) === q)!).filter(Boolean);
      const wt = bs.filter((b) => b.cls === 'weight').sort((a, b) => dur(b) - dur(a));
      const fl = bs.filter((b) => b.cls === 'filler').sort((a, b) => dur(b) - dur(a) || a.w.gi - b.w.gi);
      return [...v, ...wt, ...fl];
    };
    const o1 = order(b1, VITAL1);
    const s1 = [...geomShares(2, 0.6, 0.8), ...geomShares(o1.length - 2, 0.8, 0.2)];
    o1.forEach((b, i) => { b.r1 = i; b.w1 = s1[i]!; });
    const all = [...b1, ...b2];
    const o2 = order(all, [...VITAL1, ...VITAL2]);
    const s2 = [...geomShares(4, 0.72, 0.8), ...geomShares(o2.length - 4, 0.86, 0.2)];
    o2.forEach((b, i) => { b.r2 = i; b.w2 = s2[i]!; });
    this.max1 = s1[0]!; this.max2 = s2[0]!;
    this.bars = all;

    // ---- the cull: filler falls in two beats (right half first), then the weight
    const fb1 = beatAfter(au.beats, this.wFiller.start + 0.3);
    const fb2 = beatAfter(au.beats, fb1 + 0.3);
    this.fillFall = [fb1, fb2];
    this.weightFall = beatAfter(au.beats, this.wWeight.start + 0.2);
    const fill = o2.filter((b) => b.cls === 'filler');
    fill.forEach((b, i) => {
      b.tStrike = this.wFiller.start + 0.22;
      b.tFall = (i >= fill.length / 2 ? fb1 : fb2) + 0.012 * (i % 6);
    });
    o2.filter((b) => b.cls === 'weight').forEach((b, i) => { b.tStrike = this.wWeight.start + 0.2; b.tFall = this.weightFall + 0.02 * i; });
    all.forEach((b) => { b.spin = (hash(b.w.gi, 3) - 0.5) * (this.n === 2 ? 14 : 7); b.vx = (hash(b.w.gi, 5) - 0.5) * 260; });

    // ---- re-sort events
    this.events = [...new Set([...all.map((b) => b.tIn), this.tRescale])].sort((a, b) => a - b);
    for (const b of all) b.evs = this.events.filter((e) => e >= b.tIn - 1e-6);

    // ---- lyric layouts: two balanced rows inside the chart, as big as they fit
    for (const l of this.lines) {
      const sp = measure(' ', this.fam, 100) * 0.9;
      const w100 = l.words.map((w) => lay(w.w, this.fam, 100).width);
      const rowW = (a: number, b: number) => w100.slice(a, b).reduce((x, y) => x + y, 0) + sp * (b - a - 1);
      let best = 1, bestW = 1e9;
      for (let k2 = 1; k2 < l.words.length; k2++) { const m = Math.max(rowW(0, k2), rowW(k2, l.words.length)); if (m < bestW) { bestW = m; best = k2; } }
      // prefer breaking after a comma when it costs little width
      const minW = bestW;
      for (let k2 = 1; k2 < l.words.length; k2++) {
        if (!/,$/.test(l.words[k2 - 1]!.w)) continue;
        const m = Math.max(rowW(0, k2), rowW(k2, l.words.length));
        if (m < minW * 1.18) { best = k2; bestW = m; }
      }
      const size = Math.floor(Math.min(BOX.maxSize + (this.n === 2 ? 8 : 0), (BOX.w / bestW) * 100));
      const ws = l.words.map((w) => lay(w.w, this.fam, size).width);
      const xs: number[] = [], ys: number[] = [];
      let x = BOX.x;
      l.words.forEach((_, i) => {
        if (i === best) x = BOX.x;
        xs.push(x); ys.push(i < best ? BOX.r1 : BOX.r1 + size * 0.96);
        x += ws[i]! + (sp * size) / 100;
      });
      this.band.push({ size, xs, ys, ws });
    }
    // ---- line 4 in big type in the right 80%: two rows, then "great" alone, wide and huge
    {
      const words = l4.words;
      const gi = words.indexOf(this.wGreat);
      const x0 = FIFTH + 96, maxW = 1824 - x0;
      const rowsFor = (s: number) => {
        const rows: number[][] = []; let row: number[] = []; let w = 0;
        const sp = measure(' ', this.famBig, s) * 0.9;
        words.forEach((wd, i) => {
          if (i === gi) return;
          const ww = lay(wd.w, this.famBig, s).width;
          if (row.length && w + sp + ww > maxW) { rows.push(row); row = []; w = 0; }
          w += (row.length ? sp : 0) + ww; row.push(i);
        });
        if (row.length) rows.push(row);
        return rows;
      };
      let size = 176;
      let rows = rowsFor(size);
      while (rows.length > 2 && size > 90) { size -= 4; rows = rowsFor(size); }
      const gSize = Math.min(330, Math.floor((maxW * 0.86 * 100) / lay(this.wGreat.w, this.famGreat, 100).width));
      const lead = size * 0.9;
      const blockH = (rows.length - 1) * lead + gSize * 0.95;
      const y0 = 540 - blockH / 2 + size * CAP * 0.5 - 10;
      const sp = measure(' ', this.famBig, size) * 0.9;
      const xs: number[] = [], ys: number[] = [];
      rows.forEach((r, ri) => {
        let x = x0;
        for (const i of r) { xs[i] = x; ys[i] = y0 + ri * lead; x += lay(words[i]!.w, this.famBig, size).width + sp; }
      });
      xs[gi] = x0 - gSize * 0.04; ys[gi] = y0 + (rows.length - 1) * lead + gSize * 0.86;
      this.big = { size, xs, ys, gSize };
    }
  }

  // ------------------------------------------------------------------ data at time t
  private phase(t: number) { return t < this.tRescale ? 1 : 2; }
  private rank(b: Bar, ph: number) { return ph === 1 ? b.r1 : b.r2; }
  private present(b: Bar, t: number) { return t >= b.tIn; }
  private slotW(ph: number) { return CW / (ph === 1 ? this.lines[0]!.words.length : this.bars.length); }
  private xTarget(b: Bar, t: number) {
    const ph = this.phase(t);
    let idx = 0;
    for (const o of this.bars) if (o !== b && this.present(o, t) && this.rank(o, ph) < this.rank(b, ph) && this.rank(o, ph) >= 0) idx++;
    return CH.x0 + (idx + 0.5) * this.slotW(ph);
  }
  /** Bar centre x (sorted, eased). */
  private bx(b: Bar, t: number) {
    const v0 = this.xTarget(b, b.tIn + 1e-4);
    return chase(t, b.evs, (i) => this.xTarget(b, b.evs[i]! + 1e-4), v0, this.n === 2 ? 0.16 : 0.22, ease.outExpo);
  }
  private sw(t: number) { return chase(t, [this.tRescale], () => this.slotW(2), this.slotW(1), 0.35, ease.outExpo); }
  /** Share of meaning (eased across the rescale) times its spawn. */
  private share(b: Bar, t: number) {
    const s = b.li === 0 ? chase(t, [this.tRescale], () => b.w2, b.w1, 0.35) : b.w2;
    return s;
  }
  private yScale(t: number) {
    return chase(t, [this.tRescale], () => (CHH * 0.84) / this.max2, (CHH * 0.84) / this.max1, 0.35, ease.outExpo);
  }
  private grow(b: Bar, t: number) {
    const k = clamp((t - b.tIn) / (this.n === 2 ? 0.2 : 0.26));
    return k <= 0 ? 0 : ease.outBack(k, this.n === 2 ? 2.6 : 1.9);
  }
  private fallK(b: Bar, t: number) { return t < b.tFall ? 0 : t - b.tFall; }
  private vitalLabelSize(barW: number) { return Math.min(118, barW * 0.92); }

  // ------------------------------------------------------------------ render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio: au } = this.ctx;
    const t = f.t, X = this.n === 2, paper = !X;
    const c = this.L.ctx; this.L.clear();
    const gc = this.G.ctx; if (X) this.G.clear();
    const rc = X ? gc : c; // red ink goes to the glow layer on n=2
    this.bump = (X ? 0.06 : 0.03) * Math.exp(-f.beatPhase * 9) * (t < this.tSplit ? 1 : 0);
    const post: PostOverrides = X ? { ...INK_POST, bloom: 0.5, bloomThreshold: 1.0, bloomKnee: 0.15, halation: 0.04, ca: 0.4 } : { ...PAPER_POST, ca: 0.4 };
    let shake = 0;

    // background
    this.g.render(renderer, out, { paper: X ? 0 : 1, grid: X ? 44 : 0, gridA: X ? 0.12 : 0, vig: X ? 0 : 0.22, seed: this.n * 7 });

    const split = t >= this.tSplit ? ease.outExpo(clamp((t - this.tSplit) / 0.38)) : 0;
    const splitHard = t >= this.tSplit;
    const great = t >= this.tGreat - 0.05;
    const fullRed = X && great ? ease.outExpo(clamp((t - (this.tGreat - 0.05)) / 0.16)) : 0;

    // ---- camera on the chart: punch on each downbeat (n=2: harder, with a roll)
    const db = [...au.downbeats].reverse().find((d) => d <= t + 1e-4) ?? this.ctx.start;
    const dbi = au.downbeats.indexOf(db);
    const pk = Math.exp(-(t - db) * (X ? 7 : 8));
    const bk = Math.exp(-f.beatPhase * 10);
    const zoom = 1 + (X ? 0.04 : 0.024) * pk + (X ? 0.016 : 0.01) * bk + (X ? 0.05 : 0.035) * Math.exp(-(f.lt) * 9);
    const roll = (dbi % 2 ? 1 : -1) * (X ? 0.008 : 0.003) * pk;

    // ---- the red fifth (behind everything)
    const fifthW = splitHard ? FIFTH * split + (X ? 26 : 16) * (db >= this.tSplit ? pk : 0) + (X ? 0 : 40) * popAt(t, this.tGreat, 0.3) : 0;
    if (fifthW > 0) {
      c.fillStyle = RED();
      c.fillRect(0, 0, lerp(fifthW, 1920, fullRed), 1080);
    }

    // ---- chart (camera)
    c.save(); if (X) { gc.save(); }
    const cam = (cx: C2D) => { cx.translate(PIV.x, PIV.y); cx.rotate(roll); cx.scale(zoom, zoom); cx.translate(-PIV.x, -PIV.y); };
    cam(c); if (X) cam(gc);
    const chartA = 1 - smoothstep(this.tSplit, this.tSplit + 0.25, t);
    this.drawAxes(c, t, paper, chartA);
    const bars = this.drawBars(c, rc, t, paper, split);
    if (chartA > 0) {
      this.drawCurve(c, rc, t, paper, bars, chartA);
      this.drawCull(c, rc, t, paper, bars, chartA);
      this.drawCrop(c, rc, t, paper, bars, chartA);
    }
    // the lyric, inside the chart (lines 1–3, and line 4 until the split), with words flying to their bars
    this.drawLyric(c, gc, t, paper, bars);
    c.restore(); if (X) gc.restore();

    // ---- lyric band + leaders (lines 1–3, and line 4 until the split)
    
    // ---- line 4 in the 80% (after the split)
    if (splitHard) this.drawBig(c, gc, t, paper, split, fullRed);
    if (split > 0) this.drawFifthNotes(c, t, split, fullRed, X);

    // ---- page furniture
    const headA = 1 - smoothstep(this.tSplit - 0.1, this.tSplit + 0.1, t);
    if (headA > 0) {
      c.save(); c.globalAlpha = headA;
      drawPlateHead(c, X ? 11 : 6, 'The Pareto chart', f.lt / 0.6, { paper, right: X ? '2ND ED., REVISED & LOUDER' : 'MEANING, BY WORD' });
      c.restore();
    }
    const note = t < this.tSplit
      ? (X ? '¹ n = 2 choruses. Same data, louder. Weights assigned by ear.' : '¹ n = 1 chorus. Weights assigned by ear; “Oh” counted under protest.')
      : '¹ The other 80% of this frame has been let to the lyric.';
    const nx = t < this.tSplit ? 96 : FIFTH + 92;
    if (fullRed < 0.5) footnote(c, note, nx, 1012, { paper, a: t < this.tSplit ? prog(f.lt, 0.3, 0.9) : prog(t, this.tSplit + 0.3, this.tSplit + 0.7) });

    // ---- hits
    if (X) {
      for (const tw of [this.tTwenty, this.tGreat]) if (t >= tw && t < tw + 2 / 60) post.invert = 1;
      shake += 14 * Math.exp(-(t - db) * 14) * (t - db < 0.3 ? 1 : 0);
    }
    shake += (X ? 26 : 12) * (t >= this.tGreat ? Math.exp(-(t - this.tGreat) * 12) : 0);
    for (const tf of [...this.fillFall, this.weightFall]) if (t >= tf) shake += (X ? 10 : 5) * Math.exp(-(t - tf) * 18);
    for (const b of this.bars) if (b.cls === 'vital' && t >= b.tIn && t < b.tIn + 0.5) shake += (X ? 16 : 5) * Math.exp(-(t - b.tIn) * 14);
    if (shake > 0.05) post.shake = [noise1(frameIdx(t) * 0.7, 1) * shake, noise1(frameIdx(t) * 0.7, 2) * shake];
    if (X) post.flash = 0.12 * Math.exp(-(t - this.tGreat) * 10) * (t >= this.tGreat ? 1 : 0);

    comp.draw(renderer, this.L.upload(), out);
    if (X) comp.draw(renderer, this.G.upload(), out, { tint: [1.8, 1.8, 1.8] });
    return post;
  }

  // ------------------------------------------------------------------ axes, ticks, captions
  private drawAxes(c: C2D, t: number, paper: boolean, A: number) {
    if (A <= 0) return;
    const k = 1;
    const X = !paper;
    c.save(); c.globalAlpha = A;
    c.strokeStyle = fg(paper, 0.85); c.lineWidth = X ? 2 : 1.25;
    c.beginPath();
    c.moveTo(CH.x0, CH.yb); c.lineTo(lerp(CH.x0, CH.x1, k), CH.yb); // baseline
    c.moveTo(CH.x0, CH.yb); c.lineTo(CH.x0, lerp(CH.yb, CH.yt - 20, k)); // left axis
    c.moveTo(CH.x1, CH.yb); c.lineTo(CH.x1, lerp(CH.yb, CH.yt - 20, k)); // right axis
    c.stroke();
    // right axis: cumulative %
    c.font = font(F.mono(500), 14); c.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const y = CH.yb - (i / 5) * CHH;
      const a = clamp(k * 6 - i * 0.6);
      if (a <= 0) continue;
      const red = i === 4;
      c.globalAlpha = A * a;
      c.strokeStyle = red ? RED() : fg(paper, 0.7);
      c.beginPath(); c.moveTo(CH.x1, y); c.lineTo(CH.x1 + 10, y); c.stroke();
      c.fillStyle = red ? RED() : fg(paper, 0.7); c.textAlign = 'left';
      c.fillText(`${i * 20}%`, CH.x1 + 16, y);
      // faint grid
      if (i > 0) { c.strokeStyle = fg(paper, X ? 0.1 : 0.08); c.setLineDash([2, 6]); c.beginPath(); c.moveTo(CH.x0, y); c.lineTo(CH.x1, y); c.stroke(); c.setLineDash([]); }
    }
    // left axis: meaning, arbitrary units (minor ticks)
    for (let i = 1; i <= 10; i++) {
      const y = CH.yb - (i / 10) * CHH;
      c.globalAlpha = A * clamp(k * 6 - i * 0.3);
      c.strokeStyle = fg(paper, 0.6);
      c.beginPath(); c.moveTo(CH.x0 - (i % 5 === 0 ? 10 : 5), y); c.lineTo(CH.x0, y); c.stroke();
    }
    c.globalAlpha = A * clamp(k * 2 - 0.6);
    c.save(); c.translate(CH.x0 - 26, CH.yb); c.rotate(-Math.PI / 2);
    c.font = font(F.mono(500), 12); c.fillStyle = fg(paper, 0.6); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText('MEANING (ARB. UNITS) →', 0, 0);
    c.restore();
    c.save(); c.translate(CH.x1 + 74, CH.yb); c.rotate(-Math.PI / 2);
    c.font = font(F.mono(500), 12); c.fillStyle = fg(paper, 0.6); c.textAlign = 'left';
    c.fillText('CUMULATIVE →', 0, 0);
    c.restore();
    // caption
    c.font = font(F.mono(500), 14); c.fillStyle = fg(paper, 0.8); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const cap = `FIG. ${X ? 11 : 6} — THE CHORUS, SORTED BY WHAT IT MEANS`;
    c.fillText(cap.slice(0, Math.floor(cap.length * clamp((t - this.ctx.start) / 0.7 + 0.25))), CH.x0, CH.yt - 44);
    c.restore();
    // the hypothesis, slammed in on the first beat: a red crosshair at (20%, 80%) waiting for the data
    if (t < this.tGuide + 0.1) {
      const y80 = CH.yb - 0.8 * CHH;
      const sk = ease.outExpo(clamp((t - this.ctx.start) / 0.3));
      const ha = A * (1 - smoothstep(this.tGuide - 0.05, this.tGuide + 0.1, t));
      c.save(); c.globalAlpha = ha;
      c.strokeStyle = RED(0.85); c.lineWidth = X ? 2 : 1.5; c.setLineDash([10, 8]);
      c.beginPath(); c.moveTo(X20, CH.yb); c.lineTo(X20, lerp(CH.yb, y80, sk)); c.stroke();
      c.beginPath(); c.moveTo(CH.x1, y80); c.lineTo(lerp(CH.x1, X20, sk), y80); c.stroke();
      c.setLineDash([]);
      const r = 18 * lerp(4, 1, sk) * (1 + 0.25 * Math.exp(-((t - this.ctx.start) % 0.62) * 9));
      c.lineWidth = X ? 3 : 2.5;
      c.beginPath(); c.arc(X20, y80, r, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(X20 - r - 10, y80); c.lineTo(X20 - r + 8, y80); c.moveTo(X20 + r - 8, y80); c.lineTo(X20 + r + 10, y80);
      c.moveTo(X20, y80 - r - 10); c.lineTo(X20, y80 - r + 8); c.stroke();
      c.font = font(F.mono(600), X ? 22 : 20); c.fillStyle = RED(); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillText('PREDICTED: 20% → 80%', X20 + 34, y80 - 26);
      c.font = font(F.mono(400), 14); c.fillStyle = fg(paper, 0.6);
      c.fillText('(data to follow, sung)', X20 + 34, y80 - 6 + 0 * sk);
      c.restore();
    }
  }

  // ------------------------------------------------------------------ bars
  private drawBars(c: C2D, rc: C2D, t: number, paper: boolean, split: number) {
    const X = !paper;
    const sw = this.sw(t), ys = this.yScale(t);
    const out: { b: Bar; x: number; top: number; w: number; h: number; share: number; on: boolean }[] = [];
    // after the split the vital bars move into the red fifth
    const vital = this.bars.filter((b) => b.cls === 'vital').sort((a, b) => a.r2 - b.r2);
    for (const b of this.bars) {
      if (!this.present(b, t)) continue;
      let x = this.bx(b, t);
      const g = this.grow(b, t);
      let w = sw * (X ? 0.8 : 0.68);
      let h = Math.max(3, this.share(b, t) * ys) * g * (1 + this.bump * (b.cls === 'vital' ? 1 : 0.5));
      let base = CH.yb;
      const fk = this.fallK(b, t);
      let rot = 0, dx = 0, dy = 0;
      if (fk > 0) {
        const gk = X ? 5200 : 3800;
        dy = -260 * fk + 0.5 * gk * fk * fk; dx = b.vx * fk; rot = b.spin * fk;
        if (dy > 1200) { out.push({ b, x, top: base - h, w, h, share: 0, on: false }); continue; }
      }
      if (split > 0 && b.cls === 'vital') {
        const i = vital.indexOf(b);
        const fw = 52, gap = 18, fx = 96 + fw / 2 + i * (fw + gap);
        x = lerp(x, fx, split); w = lerp(w, fw, split);
        const fh = (b.w2 / this.max2) * 400;
        h = lerp(h, fh, split); base = lerp(CH.yb, 820, split);
      } else if (split > 0) continue;
      out.push({ b, x, top: base - h, w, h, share: this.share(b, t) * Math.min(1, g) * (fk > 0 ? Math.max(0, 1 - fk * 6) : 1), on: true });
      const ctx = b.cls === 'vital' ? rc : c;
      ctx.save();
      ctx.translate(x + dx, base + dy); ctx.rotate(rot);
      if (b.cls === 'vital') {
        const onRed = split > 0.02;
        ctx.fillStyle = onRed ? (X ? rgba('ink') : rgba('bone')) : RED();
        // on n=2 the bars on red go to the main layer (no glow)
        if (onRed && X) { c.save(); c.translate(x + dx, base + dy); c.fillStyle = rgba('ink'); c.fillRect(-w / 2, -h, w, h); c.restore(); }
        else ctx.fillRect(-w / 2, -h, w, h);
      } else {
        if (X) {
          ctx.fillStyle = rgba('ash', 0.55); ctx.fillRect(-w / 2, -h, w, h);
          ctx.strokeStyle = rgba('bone', 0.8); ctx.lineWidth = 1.5; ctx.strokeRect(-w / 2, -h, w, h);
        } else {
          hatchRect(ctx, -w / 2, -h, w, h, 5, rgba('graphite', 0.7), 1);
          ctx.strokeStyle = rgba('ink', 0.85); ctx.lineWidth = 1; ctx.strokeRect(-w / 2 + 0.5, -h + 0.5, w - 1, h - 0.5);
        }
      }
      // label above the bar (rotated, reads bottom→top)
      const land = b.tIn + (X ? 0.24 : 0.3);
      const la = clamp((t - land) / 0.08) * (split > 0 ? 1 - split : 1);
      if (la > 0 && b.cls === 'vital') {
        // the word itself, set big inside its bar (reads bottom→top), knocked out of the red
        const ls = this.vitalLabelSize(w);
        ctx.save();
        ctx.beginPath(); ctx.rect(-w / 2, -h, w, h); ctx.clip();
        ctx.translate(ls * CAP * 0.5, -h + 14); ctx.rotate(-Math.PI / 2);
        ctx.font = font(this.fam, ls); ctx.fillStyle = X ? rgba('ink', la) : rgba('bone', la);
        ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(b.label, 0, 0);
        ctx.restore();
      } else if (la > 0) {
        const lc = ctx;
        lc.save();
        lc.translate(0, -h - 8); lc.rotate(-Math.PI / 2);
        lc.font = font(F.mono(400), 13);
        lc.fillStyle = fg(paper, 0.62 * la);
        lc.textAlign = 'left'; lc.textBaseline = 'middle';
        lc.fillText(b.label, 0, 0);
        lc.restore();
        // struck: a red rule through the label
        if (t >= b.tStrike) {
          const sk = ease.outExpo(clamp((t - b.tStrike) / 0.15));
          const lw = lay(b.label, F.mono(400), 13).width;
          rc.save(); rc.translate(x + dx, base + dy); rc.rotate(rot);
          rc.strokeStyle = RED(); rc.lineWidth = X ? 2.5 : 1.6;
          rc.beginPath(); rc.moveTo(0, -h - 4); rc.lineTo(0, -h - 4 - (lw + 8) * sk); rc.stroke();
          rc.restore();
        }
      }
      ctx.restore();
      // rank number under the baseline
      if (split <= 0 && fk <= 0) {
        c.font = font(F.mono(400), 11); c.fillStyle = fg(paper, 0.45 * la); c.textAlign = 'center'; c.textBaseline = 'top';
        const idx = Math.round((x - CH.x0) / sw - 0.5) + 1;
        c.fillText(String(idx).padStart(2, '0'), x, CH.yb + 8);
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ cumulative curve + 80/20 guides
  private drawCurve(c: C2D, rc: C2D, t: number, paper: boolean, bars: { b: Bar; x: number; w: number; share: number; on: boolean }[], A: number) {
    const X = !paper;
    const sw = this.sw(t);
    const pts = bars.filter((p) => p.b.tIn <= t).sort((a, b) => a.x - b.x);
    if (!pts.length) return;
    const P: [number, number][] = [[CH.x0, CH.yb]];
    let cum = 0;
    for (const p of pts) { cum += p.share; P.push([p.x + sw / 2, CH.yb - Math.min(1.02, cum) * CHH]); }
    // pen reveal on the first word
    rc.save(); rc.globalAlpha = A;
    rc.strokeStyle = RED(); rc.lineWidth = X ? 4.5 : 3; rc.lineJoin = 'round'; rc.lineCap = 'round';
    rc.beginPath(); P.forEach(([x, y], i) => (i ? rc.lineTo(x, y) : rc.moveTo(x, y))); rc.stroke();
    // markers
    for (let i = 1; i < P.length; i++) {
      const [x, y] = P[i]!;
      rc.fillStyle = X ? rgba('ink') : rgba('bone');
      rc.beginPath(); rc.arc(x, y, X ? 5 : 4, 0, Math.PI * 2); rc.fill();
      rc.lineWidth = X ? 2.5 : 2; rc.stroke();
    }
    rc.restore();
    // the 80/20 guide sits on the vital boundary: 2 of 10 bars (20%), then 4 of 21 (19.05%, "close enough")
    const ph = this.phase(t);
    const nW = ph === 1 ? this.lines[0]!.words.length : this.bars.length;
    const nV = ph === 1 ? 2 : 4;
    const GX = CH.x0 + nV * sw;
    let y20 = CH.yb;
    for (let i = 1; i < P.length; i++) {
      const [ax, ay] = P[i - 1]!, [bx, by] = P[i]!;
      if (GX >= ax - 0.5 && GX <= bx + 0.5) { y20 = lerp(ay, by, clamp((GX - ax) / Math.max(1e-3, bx - ax))); break; }
      if (i === P.length - 1 && GX > bx) y20 = by;
    }
    const gk = t >= this.tGuide ? ease.outExpo(clamp((t - this.tGuide) / 0.35)) : 0;
    if (gk > 0) {
      c.save(); c.globalAlpha = A;
      c.setLineDash([6, 6]); c.strokeStyle = fg(paper, 0.55); c.lineWidth = X ? 1.5 : 1;
      c.beginPath(); c.moveTo(GX, CH.yb); c.lineTo(GX, lerp(CH.yb, y20, gk)); c.stroke();
      c.beginPath(); c.moveTo(CH.x1, y20); c.lineTo(lerp(CH.x1, GX, gk), y20); c.stroke();
      c.setLineDash([]);
      c.font = font(F.mono(600), 14); c.fillStyle = fg(paper, 0.85); c.textAlign = 'center'; c.textBaseline = 'top';
      c.fillText(ph === 1 ? '20%' : '≈20%', GX, CH.yb + 26);
      c.restore();
      rc.save(); rc.globalAlpha = A;
      const pr = (X ? 8 : 7) + 9 * Math.exp(-(t - this.tGuide) * 8) + 60 * this.bump;
      rc.fillStyle = RED(); rc.beginPath(); rc.arc(GX, y20, pr, 0, Math.PI * 2); rc.fill();
      rc.restore();
      // the annotation (live value; it reads 80.0% once the vital words are in)
      const cumNow = Math.min(100, Math.round((1 - (y20 - CH.yt) / CHH) * 1000) / 10);
      const s1 = ph === 1 ? `${nV} OF ${nW} WORDS (20%)` : `${nV} OF ${nW} WORDS (${((nV / nW) * 100).toFixed(2)}%)`;
      const s2 = `→ ${cumNow.toFixed(1)}% OF THE MEANING`;
      const ax = GX + 30, ay = y20 + 58;
      const la = clamp((t - this.tGuide - 0.1) / 0.3);
      c.save(); c.globalAlpha = A * la;
      c.font = font(F.mono(600), X ? 22 : 20); c.fillStyle = RED(); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillText(s1, ax, ay);
      c.font = font(F.mono(500), X ? 22 : 20); c.fillStyle = fg(paper, 0.9);
      c.fillText(s2, ax, ay + 29);
      const tBest = this.bars.find((b) => wkey(b.w.w) === 'best')!.tIn;
      if (ph === 2 && t >= tBest + 0.3) {
        c.font = font(F.mono(400, true), 15); c.fillStyle = fg(paper, 0.6 * clamp((t - tBest - 0.3) / 0.2));
        c.fillText('close enough.', ax, ay + 54);
      }
      c.restore();
    }
    // cumulative readout at the curve's end
    const [ex, ey] = P[P.length - 1]!;
    c.save(); c.globalAlpha = A * clamp((t - pts[0]!.b.tIn) / 0.2);
    c.font = font(F.mono(500), 13); c.fillStyle = fg(paper, 0.7); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const tot = Math.min(100, cum * 100);
    void ex; void ey;
    c.font = font(F.mono(600), X ? 40 : 36); c.fillStyle = fg(paper, 0.9); c.textAlign = 'right';
    c.fillText(`Σ ${tot.toFixed(1)}%`, CH.x1, CH.yt - 40);
    c.font = font(F.mono(500), 12); c.fillStyle = fg(paper, 0.55);
    c.fillText('CUMULATIVE MEANING, SO FAR', CH.x1, CH.yt - 20);
    c.restore();
  }

  // ------------------------------------------------------------------ crop marks on "crop"
  private drawCrop(c: C2D, rc: C2D, t: number, paper: boolean, bars: { b: Bar; x: number; top: number; w: number; on: boolean }[], A: number) {
    if (t < this.tCrop || t > this.wFiller.start) return;
    const k = ease.outExpo(clamp((t - this.tCrop) / 0.3));
    const out = 1 - smoothstep(this.wFiller.start - 0.6, this.wFiller.start - 0.2, t);
    const sw = this.sw(t);
    const x0 = CH.x0 + 6, x1 = CH.x0 + 4 * sw - 4;
    const y0 = CH.yt + 4, y1 = CH.yb - 2;
    const m = lerp(90, 10, k), L = 40;
    void bars;
    rc.save(); rc.globalAlpha = A * out * k;
    rc.strokeStyle = RED(); rc.lineWidth = paper ? 1.5 : 2.5;
    rc.beginPath();
    for (const [cx, cy, sx, sy] of [[x0 - m, y0 - m, -1, -1], [x1 + m, y0 - m, 1, -1], [x0 - m, y1 + m, -1, 1], [x1 + m, y1 + m, 1, 1]] as const) {
      rc.moveTo(cx - sx * 4, cy); rc.lineTo(cx + sx * L, cy);
      rc.moveTo(cx, cy - sy * 4); rc.lineTo(cx, cy + sy * L);
    }
    rc.stroke();
    rc.restore();
    c.save(); c.globalAlpha = A * out * clamp((t - this.tCrop - 0.1) / 0.2);
    c.font = font(F.mono(500), 13); c.fillStyle = RED(); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText('CROP: THE CREAM', x1 + 16, y0 + 8);
    c.restore();
  }

  // ------------------------------------------------------------------ the cull (line 3)
  private group(bars: { b: Bar; x: number; w: number; top: number; on: boolean }[], cls: Cls) {
    const g = bars.filter((p) => p.b.cls === cls);
    if (!g.length) return null;
    return { x0: Math.min(...g.map((p) => p.x - p.w / 2)), x1: Math.max(...g.map((p) => p.x + p.w / 2)), top: Math.min(...g.map((p) => p.top)), n: g.length, share: g.reduce((a, p) => a + p.b.w2, 0) };
  }
  private bracketY() { return CH.yb + 46; }
  private drawCull(c: C2D, rc: C2D, t: number, paper: boolean, bars: { b: Bar; x: number; w: number; top: number; on: boolean }[], A: number) {
    const X = !paper;
    for (const [cls, w, tf] of [['filler', this.wFiller, this.fillFall[1]], ['weight', this.wWeight, this.weightFall]] as const) {
      if (t < w.start) continue;
      const g = this.group(bars, cls);
      if (!g) continue;
      const k = ease.outExpo(clamp((t - w.start) / 0.3));
      const fk = t >= tf ? t - tf : 0;
      const dy = fk > 0 ? -160 * fk + 0.5 * (X ? 6400 : 4800) * fk * fk : 0;
      if (dy > 1200) continue;
      const y = this.bracketY() + dy;
      const mid = (g.x0 + g.x1) / 2;
      const hx0 = lerp(mid, g.x0, k), hx1 = lerp(mid, g.x1, k);
      c.save();
      c.translate(mid, y); c.rotate(fk * (cls === 'filler' ? 0.35 : -0.6)); c.translate(-mid, -y);
      c.strokeStyle = fg(paper, 0.85); c.lineWidth = X ? 2 : 1.25;
      c.beginPath(); c.moveTo(hx0, y - 12); c.lineTo(hx0, y); c.lineTo(hx1, y); c.lineTo(hx1, y - 12); c.stroke();
      const txt = cls === 'filler' ? `FILLER · ${g.n} WORDS · ${(g.share * 100).toFixed(1)}%` : `DEAD WEIGHT · ${g.n} WORDS · ${(g.share * 100).toFixed(1)}%`;
      c.font = font(F.mono(600), X ? 19 : 17); c.fillStyle = fg(paper, 0.9); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      const tw = c.measureText(txt).width;
      const nch = Math.floor(txt.length * clamp((t - w.start - 0.22) / 0.3));
      c.fillText(txt.slice(0, nch), mid, y + 36);
      // struck through
      const st = this.bars.find((b) => b.cls === cls)!.tStrike;
      if (t >= st) {
        const sk = ease.outExpo(clamp((t - st) / 0.18));
        rc.save(); rc.translate(mid, y); rc.rotate(fk * (cls === 'filler' ? 0.35 : -0.6)); rc.translate(-mid, -y);
        rc.strokeStyle = RED(); rc.lineWidth = X ? 4 : 2.5;
        rc.beginPath(); rc.moveTo(mid - tw / 2 - 8, y + 30); rc.lineTo(mid - tw / 2 - 8 + (tw + 16) * sk, y + 30); rc.stroke();
        rc.restore();
      }
      c.restore();
    }
    // the retained note, once the tail is gone
    const tr = this.weightFall + 0.25;
    if (t >= tr) {
      const a = clamp((t - tr) / 0.25) * A;
      c.save(); c.globalAlpha = a;
      c.font = font(F.mono(500), 15); c.fillStyle = fg(paper, 0.75); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillText('RETAINED: 80.0% OF THE MEANING · DISCARDED: 17 WORDS, 0 REGRETS', X20 + 40, CH.yb - 24);
      c.restore();
    }
  }

  // ------------------------------------------------------------------ lyric band + leaders
  private bandStyle(paper: boolean, size: number, glow: boolean): WordStyle {
    const clear = 'rgba(0,0,0,0)';
    return { fam: this.fam, size, sung: glow ? clear : fg(paper), key: glow ? RED() : !paper ? clear : RED(), base: glow ? clear : fg(paper), dim: paper ? 0.22 : 0.13 };
  }
  /** Where a word's flying copy lands: its bar's label (lines 1–2) or its bracket (filler / weight). */
  private flightTarget(w: Word, li: number, bars: BarDraw[]): { x: number; y: number; rot: number; scale: number; size: number } | null {
    const bl = this.band[li]!;
    if (li < 2) {
      const p = bars.find((q) => q.b.w === w);
      if (!p || !p.on) return null;
      if (p.b.cls === 'vital') {
        const ls = this.vitalLabelSize(p.w);
        return { x: p.x, y: p.top + 14 + lay(p.b.label, this.fam, ls).width / 2, rot: -Math.PI / 2, scale: ls / bl.size, size: ls };
      }
      return { x: p.x, y: p.top - 8 - lay(p.b.label, F.mono(400), 13).width / 2, rot: -Math.PI / 2, scale: 15 / bl.size, size: 15 };
    }
    if (li === 2 && (w === this.wFiller || w === this.wWeight)) {
      const g = this.group(bars, w === this.wFiller ? 'filler' : 'weight');
      if (!g) return null;
      return { x: (g.x0 + g.x1) / 2, y: this.bracketY() + 30, rot: 0, scale: 22 / bl.size, size: 22 };
    }
    return null;
  }
  private drawLyric(c: C2D, gc: C2D, t: number, paper: boolean, bars: BarDraw[]) {
    const X = !paper;
    const FLY = X ? 0.24 : 0.3;
    for (let li = 0; li < 4; li++) {
      const l = this.lines[li]!;
      const t0 = l.words[0]!.start - 0.4;
      const t1 = li < 3 ? this.lines[li + 1]!.words[0]!.start - 0.4 : this.tSplit;
      if (t < Math.min(t0, this.ctx.start) || t >= t1) continue;
      const kin = t0 <= this.ctx.start ? 1 : ease.outExpo(clamp((t - t0) / 0.22));
      const kout = li < 3 ? smoothstep(t1 - 0.12, t1, t) : 0;
      const A = kin * (1 - kout);
      const dy = (1 - kin) * 40 - kout * 30;
      const bl = this.band[li]!;
      for (let i = 0; i < l.words.length; i++) {
        const w = l.words[i]!;
        const key = [...VITAL1, ...VITAL2, 'filler', 'weight'].includes(wkey(w.w));
        const pop = popAt(t, w.start, 0.24) * (key ? (X ? 0.22 : 0.15) : (X ? 0.07 : 0.05));
        const x = bl.xs[i]!, y = bl.ys[i]! + dy, ww = bl.ws[i]!;
        const draw = (ctx: C2D, glow: boolean) => {
          ctx.save();
          ctx.translate(x + ww / 2, y); ctx.scale(1 + pop, 1 + pop); ctx.translate(-ww / 2, 0);
          const st = this.bandStyle(paper, bl.size, glow); st.alpha = A;
          drawWord(ctx, w, t, 0, 0, st);
          ctx.restore();
        };
        draw(c, false);
        if (X) draw(gc, true);
        // the flying copy: lifts out of the line and lands on its bar / bracket, leaving a fading trail
        if (t < w.start || t > w.start + FLY + 0.5) continue;
        const tg = this.flightTarget(w, li, bars);
        if (!tg) continue;
        const red = key;
        const u = clamp((t - w.start) / FLY);
        const e = ease.inOutCubic(u);
        const sx = x + ww / 2, sy = y - bl.size * CAP * 0.5;
        const cx = (sx + tg.x) / 2, cy = Math.min(sy, tg.y) - 120;
        const qx = (k: number) => (1 - k) * (1 - k) * sx + 2 * (1 - k) * k * cx + k * k * tg.x;
        const qy = (k: number) => (1 - k) * (1 - k) * sy + 2 * (1 - k) * k * cy + k * k * tg.y;
        // trail
        const ta = 1 - smoothstep(FLY, FLY + 0.5, t - w.start);
        const tctx = red && X ? gc : c;
        tctx.save();
        tctx.strokeStyle = red ? RED(0.9 * ta * A) : fg(paper, 0.5 * ta * A);
        tctx.lineWidth = red ? (X ? 2.4 : 1.8) : 1.1;
        tctx.setLineDash([4, 5]);
        tctx.beginPath();
        for (let s2 = 0; s2 <= 20; s2++) { const k = (s2 / 20) * e; if (s2 === 0) tctx.moveTo(qx(k), qy(k)); else tctx.lineTo(qx(k), qy(k)); }
        tctx.stroke();
        tctx.restore();
        if (u >= 1) continue;
        // the copy itself
        const px = qx(e), py = qy(e);
        const sc = lerp(1 + pop, tg.scale, e), rot = lerp(0, tg.rot, e);
        const ctx = red && X ? gc : c;
        ctx.save();
        ctx.translate(px, py); ctx.rotate(rot); ctx.scale(sc, sc);
        ctx.font = font(this.fam, bl.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const ca = A * clamp(u / 0.3);
        ctx.fillStyle = red ? RED(ca) : fg(paper, ca);
        ctx.fillText(w.w, 0, 0);
        ctx.restore();
      }
    }
  }

  // ------------------------------------------------------------------ line 4, big, in the 80%
  private drawBig(c: C2D, gc: C2D, t: number, paper: boolean, split: number, fullRed: number) {
    const X = !paper;
    const l = this.lines[3]!, bl = this.band[3]!;
    const k = ease.outExpo(clamp((t - this.tSplit) / 0.42));
    for (let i = 0; i < l.words.length; i++) {
      const w = l.words[i]!;
      const isGreat = w === this.wGreat;
      const fam = isGreat ? this.famGreat : this.famBig;
      const S = isGreat ? this.big.gSize : this.big.size;
      const ww = lay(w.w, fam, S).width;
      const fs = bl.size / S;
      // fly from the band (word centre) to the big layout
      const fcx = bl.xs[i]! + bl.ws[i]! / 2, tcx = this.big.xs[i]! + ww / 2;
      const cx = lerp(fcx, tcx, k), y = lerp(bl.ys[i]!, this.big.ys[i]!, k), s = lerp(fs, 1, k);
      // "great" slams: arrives oversized and tilted, lands on its syllable
      let sc = 1, rot = 0;
      if (isGreat && t >= this.tGreat - 0.03) {
        const g = ease.outExpo(clamp((t - this.tGreat + 0.03) / 0.22));
        sc = lerp(X ? 1.9 : 1.55, 1, g); rot = lerp(X ? -0.09 : -0.05, 0, g);
      }
      const onRed = fullRed > 0.6;
      const pop = isGreat ? 0 : popAt(t, w.start, 0.22) * (X ? 0.08 : 0.05);
      const draw = (ctx: C2D, glow: boolean) => {
        const clear = 'rgba(0,0,0,0)';
        const st: WordStyle = {
          fam, size: S,
          sung: glow ? clear : onRed ? rgba('ink') : fg(paper),
          key: glow ? (onRed ? clear : RED()) : onRed ? rgba('ink') : X ? clear : RED(),
          base: glow ? clear : onRed ? rgba('ink') : fg(paper), dim: paper ? 0.2 : 0.13,
        };
        ctx.save();
        ctx.translate(cx, y); ctx.rotate(rot); ctx.scale(s * sc * (1 + pop), s * sc * (1 + pop)); ctx.translate(-ww / 2, 0);
        drawWord(ctx, w, t, 0, 0, st);
        ctx.restore();
      };
      draw(c, false);
      if (X) draw(gc, true);
    }
    void split;
  }

  // ------------------------------------------------------------------ notes in the red fifth
  private drawFifthNotes(c: C2D, t: number, split: number, fullRed: number, X: boolean) {
    const a = clamp((t - this.tSplit - 0.12) / 0.3) * (1 - fullRed);
    if (a <= 0) return;
    const inkK = X ? 'ink' : 'bone';
    const col = (al: number) => rgba(inkK, al * a);
    c.save();
    c.fillStyle = col(0.95); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.font = font(F.mono(600), 15);
    c.fillText('THE VITAL FEW', 96, 160);
    c.font = font(F.mono(400), 13); c.fillStyle = col(0.75);
    c.fillText('FIG. 6c — SURVIVORS', 96, 182);
    // baseline + a little cumulative curve over the four survivors (drawn in the ground colour)
    const base = 820, fw = 52, gap = 18;
    c.strokeStyle = col(0.9); c.lineWidth = 1.25;
    c.beginPath(); c.moveTo(90, base + 0.5); c.lineTo(FIFTH - 30, base + 0.5); c.stroke();
    const shares = this.bars.filter((b) => b.cls === 'vital').sort((p, q) => p.r2 - q.r2).map((b) => b.w2);
    let cum = 0;
    const kk = ease.outExpo(clamp((t - this.tSplit - 0.25) / 0.5));
    c.strokeStyle = X ? rgba('bone', 0.9 * a) : rgba('ink', 0.85 * a); c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(96, base);
    const pts: [number, number][] = [];
    shares.forEach((sh, i) => { cum += sh; pts.push([96 + (i + 1) * (fw + gap) - gap / 2, base - (cum / 0.8) * 460 * kk]); });
    pts.forEach(([x, y]) => c.lineTo(x, y));
    c.stroke();
    c.fillStyle = X ? rgba('bone', a) : rgba('ink', a);
    for (const [x, y] of pts) { c.beginPath(); c.arc(x, y, 3.5, 0, Math.PI * 2); c.fill(); }
    // labels under the bars
    c.font = font(F.mono(500), 12); c.fillStyle = col(0.9); c.textAlign = 'center';
    ['twenty', 'lot', 'cream', 'best'].forEach((s, i) => c.fillText(s, 96 + fw / 2 + i * (fw + gap), base + 22));
    c.textAlign = 'left';
    c.font = font(F.mono(500), 12); c.fillStyle = col(0.85);
    c.fillText('4 OF 21 WORDS = 80% OF MEANING', 96, base + 52);
    c.font = font(F.archivo(62, 900), 134); c.fillStyle = col(1);
    c.fillText('20%', 92, 984);
    c.restore();
    void split;
  }
}
