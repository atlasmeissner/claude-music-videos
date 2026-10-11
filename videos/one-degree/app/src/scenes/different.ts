// different — final chorus (revision 2, replaces the sunrise): "One degree, one degree" ×2 / "Turned so slow I
// couldn't see" / "But the whole world's different now" / "One degree was all I need" / "One degree".
// THEN | NOW pairs, one opened on each "degree": one step | a worn path; one page | a book; one night | ten years of
// star trails; one snowflake | a mountain. The NOW halves keep growing slowly while the THEN halves dim ("couldn't
// see"); on "different" the THEN halves are gone and the four NOWs fill the frame, drawn hot. Then the line itself.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { F } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import type { Line } from '../engine/lyrics';
import { clamp, ease, hash, lerp, noise1, prog, pulse, TAU } from '../engine/util';
import { degreeTimes, drawCompound, drawKaraoke, mono, rollPost } from './_od';

type RGB = [number, number, number];
type Box = { x: number; y: number; w: number; h: number };
const LABELS: [string, string][] = [['ONE STEP', '10,000 STEPS'], ['ONE PAGE', 'A BOOK'], ['ONE NIGHT', 'TEN YEARS'], ['ONE FLAKE', 'A MOUNTAIN']];

export default class Different extends Scene {
  lb = new LineBatch(30000);
  text = new Layer2D();
  ls: Line[] = [];
  degs: number[] = [];
  tDiff = 0;

  override init() {
    const ly = this.ctx.lyrics;
    this.ls = [26, 27, 28, 29, 30, 31].map((i) => ly.lines[i]!);
    this.degs = degreeTimes(ly).filter((d) => d >= this.ctx.start && d < this.ctx.end);
    this.tDiff = this.ls[3]!.words[4]!.start; // "different"
  }

  // ---- the motifs, drawn into a box with growth k (0..1); THEN is k = 0
  step(b: Box, k: number, col: RGB, al: number) {
    const lb = this.lb;
    const n = k <= 0 ? 1 : Math.max(1, Math.floor(160 * k));
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / 159;
      const x = b.x + b.w * (0.08 + 0.84 * u);
      const y = b.y + b.h * (0.55 + 0.28 * Math.sin(u * 7.5 + 0.6) * (n === 1 ? 0 : 1)) + (i % 2 ? 7 : -7);
      lb.seg2(x - 3, y, x + 3, y, 5, col, al * (0.5 + 0.5 * clamp(1 - (n - i) / 40)));
    }
  }
  page(b: Box, k: number, col: RGB, al: number) {
    const lb = this.lb;
    const n = k <= 0 ? 1 : Math.max(1, Math.floor(70 * k));
    const x0 = b.x + b.w * 0.2, x1 = b.x + b.w * 0.8, y0 = b.y + b.h * 0.82;
    for (let i = 0; i < n; i++) {
      const y = y0 - i * 3.4, c = Math.sin(i * 0.37) * 3;
      lb.seg2(x0 + c * 0.3, y, x1 + c, y, 1, col, al * (n === 1 ? 1 : 0.7));
    }
    if (n === 1) { lb.seg2(x0, y0 - 60, x1, y0 - 60, 1, col, al * 0.4); lb.seg2(x0, y0 - 60, x0, y0, 1, col, al * 0.4); lb.seg2(x1, y0 - 60, x1, y0, 1, col, al * 0.4); }
    else lb.seg2(x0 - 4, y0 + 4, x0 - 4, y0 - n * 3.4, 2, col, al);
  }
  night(b: Box, k: number, col: RGB, al: number) {
    const lb = this.lb;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const sweep = k <= 0 ? 0.5 : lerp(0.5, TAU, Math.min(1, k * 1.4));
    const nStars = k <= 0 ? 1 : Math.floor(lerp(6, 46, k));
    for (let s = 0; s < nStars; s++) {
      const r = k <= 0 ? b.h * 0.3 : 10 + hash(s, 3) * b.h * 0.44;
      const a0 = hash(s, 5) * TAU, segs = Math.max(3, Math.ceil(sweep * r / 10));
      for (let i = 0; i < segs; i++) {
        const a = a0 + (sweep * i) / segs, a2 = a0 + (sweep * (i + 1)) / segs;
        lb.seg2(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, 1, col, al * (0.35 + 0.65 * (i / segs)));
      }
    }
  }
  snow(b: Box, k: number, col: RGB, al: number) {
    const lb = this.lb;
    if (k <= 0) {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = 16;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; lb.seg2(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.4, col, al); }
      return;
    }
    const base = b.y + b.h * 0.9;
    const shape = (x: number) => Math.exp(-(((x - (b.x + b.w * 0.5)) / (b.w * 0.24)) ** 2)) + 0.45 * Math.exp(-(((x - (b.x + b.w * 0.78)) / (b.w * 0.14)) ** 2));
    const NL = Math.max(2, Math.floor(28 * k));
    for (let j = 1; j <= NL; j++) {
      const hk = (j / NL) * b.h * 0.72 * k;
      let px = b.x + b.w * 0.04, py = base - shape(px) * hk;
      for (let x = px + 8; x <= b.x + b.w * 0.96; x += 8) {
        const y = base - shape(x) * hk + (noise1(x * 0.05 + j, j) - 0.5) * 2;
        if (base - y > 1.5 || base - py > 1.5) lb.seg2(px, py, x, y, 1, col, al * (0.3 + 0.7 * (j / NL)));
        px = x; py = y;
      }
    }
    lb.seg2(b.x + b.w * 0.04, base, b.x + b.w * 0.96, base, 1, col, al * 0.8);
  }
  motif(i: number, b: Box, k: number, col: RGB, al: number) {
    if (i === 0) this.step(b, k, col, al);
    else if (i === 1) this.page(b, k, col, al);
    else if (i === 2) this.night(b, k, col, al);
    else this.snow(b, k, col, al);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const lb = this.lb; lb.clear();
    const [l26, l27, l28, l29, l30, l31] = this.ls as [Line, Line, Line, Line, Line, Line];
    const diff = prog(t, this.tDiff - 0.03, this.tDiff + 0.35, ease.inOutCubic);
    const dimNow = prog(t, l30.start - 0.4, l30.start + 0.2, ease.inOutCubic) * 0.72;
    const then = 1 - prog(t, l28.words[4]!.start, l28.end, ease.inOutQuad) * 0.65; // "couldn't see": THEN dims
    // pairs grid (2×2) before "different"; NOW quadrants after
    const pairs: { then: Box; now: Box; full: Box }[] = [];
    for (let i = 0; i < 4; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const px = 140 + col * 840, py = 305 + row * 310, pw = 800, ph = 270;
      pairs.push({
        then: { x: px, y: py, w: pw * 0.32, h: ph },
        now: { x: px + pw * 0.36, y: py, w: pw * 0.64, h: ph },
        full: { x: col * W / 2 + 40, y: row * H / 2 + 40, w: W / 2 - 80, h: H / 2 - 80 },
      });
    }
    for (let i = 0; i < 4; i++) {
      const d = this.degs[i];
      if (d === undefined) continue;
      const open = prog(t, d - 0.08, d + 0.25, ease.outCubic);
      if (open <= 0) continue;
      // NOW grows: fast at first (the reveal), then keeps creeping for the rest of the plate
      const grow = 0.55 * ease.outCubic(prog(t, d, d + 1.2)) + 0.45 * prog(t, d + 1.2, this.tDiff, ease.linear);
      const P = pairs[i]!;
      const nb: Box = {
        x: lerp(P.now.x, P.full.x, diff), y: lerp(P.now.y, P.full.y, diff),
        w: lerp(P.now.w, P.full.w, diff), h: lerp(P.now.h, P.full.h, diff),
      };
      const hot = pulse(t, d, 0.35) + pulse(t, this.tDiff, 0.45);
      const nowCol: RGB = diff > 0.5 ? [LIN.signal[0] * (1.1 + hot), LIN.signal[1] * (1.1 + hot), LIN.signal[2] * (1.1 + hot)] : LIN.bone;
      this.motif(i, nb, Math.max(0.02, grow + diff * (1 - grow)), nowCol, open * (1 - dimNow));
      if (diff < 1) {
        this.motif(i, P.then, 0, LIN.bone, open * then * (1 - diff));
        // divider
        const dx = P.then.x + P.then.w + (P.now.x - P.then.x - P.then.w) / 2;
        lb.seg2(dx, P.then.y + 20, dx, P.then.y + P.then.h - 20, 1, LIN.graphite, open * (1 - diff));
      }
    }
    lb.render(renderer, out);

    const T = this.text, c = T.ctx; T.clear();
    // pair labels
    for (let i = 0; i < 4; i++) {
      const d = this.degs[i]; if (d === undefined) continue;
      const open = prog(t, d - 0.08, d + 0.25, ease.outCubic) * (1 - diff);
      if (open <= 0) continue;
      const P = pairs[i]!;
      mono(c, LABELS[i]![0], P.then.x + P.then.w / 2, P.then.y + P.then.h + 26, { size: 12, color: rgba('ash', 0.9 * open * then), track: 3, align: 'center' });
      mono(c, LABELS[i]![1], P.now.x + P.now.w / 2, P.now.y + P.now.h + 26, { size: 12, color: rgba('bone', 0.9 * open), track: 3, align: 'center' });
    }
    if (diff > 0.5) {
      for (let i = 0; i < 4; i++) {
        const P = pairs[i]!;
        mono(c, LABELS[i]![1], P.full.x + 20, P.full.y + 30, { size: 13, color: rgba('signal', 0.95 * (1 - dimNow)), track: 4, weight: 500 });
      }
    }
    if (diff < 1) {
      c.save(); c.globalAlpha = 1 - diff;
      mono(c, "THEN", 140, 296, { size: 12, color: rgba('ash', 0.8), track: 5 });
      mono(c, "NOW", 140 + 800 * 0.36, 296, { size: 12, color: rgba('bone', 0.9), track: 5 });
      c.restore();
    }
    // lyric
    const st = { family: F.archivo(100, 800), size: 80, tracking: -1.5, sung: rgba('bone', 1), unsung: rgba('bone', 0.16), active: rgba('signal', 1), lead: 0.5 } as const;
    const swA = prog(t, l28.start - 0.5, l28.start - 0.15, ease.inOutCubic);
    if (swA < 1) { c.save(); c.globalAlpha = 1 - swA; drawKaraoke(c, l26, 120, 160, t, st); drawKaraoke(c, l27, 120, 250, t, { ...st, lead: 1.2 }); c.restore(); }
    const swB = prog(t, l30.start - 0.4, l30.start - 0.1, ease.inOutCubic);
    if (swA > 0 && swB < 1) {
      c.save(); c.globalAlpha = swA * (1 - swB);
      // after "different", the lines sit on a dark band over the full-frame NOWs
      if (diff > 0) { c.fillStyle = `rgba(10,11,13,${0.82 * diff})`; c.fillRect(0, 70, W, 220); }
      drawKaraoke(c, l28, 120, 160, t, st); drawKaraoke(c, l29, 120, 250, t, { ...st, lead: 1.0 });
      c.restore();
    }
    if (swB > 0) {
      c.save(); c.globalAlpha = swB;
      drawKaraoke(c, l30, W / 2, 520, t, { ...st, family: F.archivo(112.5, 900), size: 110, tracking: -3, lead: 0.4, align: 'center' });
      drawKaraoke(c, l31, W / 2, 650, t, { ...st, family: F.archivo(112.5, 900), size: 110, tracking: -3, lead: 0.4, align: 'center' });
      c.restore();
    }
    drawCompound(c, 120, 1000, t, { ly: lyrics });
    comp.draw(renderer, T.upload(), out);
    return { ...rollPost(lyrics, t), bloom: 0.6, ca: 0.5, vignette: 0.42, flash: 0.35 * pulse(t, this.tDiff, 0.12) };
  }
}
