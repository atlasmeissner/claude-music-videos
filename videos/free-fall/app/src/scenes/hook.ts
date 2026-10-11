// HOOK ×3 — "FREE / FALL, FREE / FALL": one full-frame slam per sung word; the letters of FALL obey gravity (they
// drop in from above the frame, accelerating, and land with a squash). After the first pair the whole slab falls
// out of the bottom of the frame; on the second pair THE ODDS take the frame and roll to their new value on the
// last "fall", with a deadpan footnote — pdoom's P(doom) hook, re-cast.
//   n=1 bone on ink, clean.                         odds 1 → 3
//   n=2 ink on a signal field, heavier.              odds 10 → 40
//   n=3 maximal: strobe inverts on every word, stacked repeats, shake, the zeros multiply.   odds 100 → 1,000
//   n=4 the last call (after the final chorus): bone on ink again, and the odds are rounded up.  1,000,000 → ∞
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W, H } from '../engine/gl';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, prog, pulse } from '../engine/util';
import { cachedLayout, fmtOdds, mono, odds, type Odds } from './_ff';

const NOTES: Record<number, string> = {
  1: 'odds · updated on one (1) leap',
  2: 'odds · updated on a door (either way)',
  3: 'odds · updated on everyone who jumped',
  4: 'odds · rounded up',
};
const FAM = F.archivo(125, 900);
const CAP = 0.686;

export default class Hook extends Scene {
  n = 1;
  L = new Layer2D();
  line!: Line;
  w: Word[] = [];
  od!: Odds;
  tDrop = 0; // the first pair falls out
  tB = 0; // the instrument's entrance

  override init() {
    this.n = this.ctx.params.n ?? 1;
    this.line = this.ctx.lyrics.lines[this.ctx.params.line ?? 6]!;
    this.w = this.line.words;
    this.od = odds(this.ctx.lyrics);
    this.tDrop = this.w[2]!.start - 0.5;
    this.tB = this.w[2]!.start - 0.12;
  }

  /** Colours per variant: field, FREE, FALL, dim. */
  pal(t: number) {
    const n = this.n;
    // n=3 strobes: each word inverts the frame for an 8th
    let inv = false;
    if (n === 3) for (const w of this.w) if (t >= w.start && t < w.start + 0.11) inv = true;
    if (n === 2) return { field: LIN.signal, free: rgba('ink', 1), fall: rgba('bone', 1), dim: rgba('ink', 0.55), num: rgba('ink', 1), hot: rgba('bone', 1) };
    if (inv) return { field: LIN.bone, free: rgba('ink', 1), fall: rgba('signal', 1), dim: rgba('ink', 0.5), num: rgba('ink', 1), hot: rgba('signal', 1) };
    return { field: LIN.ink, free: rgba('bone', 1), fall: rgba('signal', 1), dim: rgba('ash', 0.75), num: rgba('bone', 1), hot: rgba('signal', 1) };
  }

  /** A word slammed full-frame: per-glyph, kerned; `fall` letters drop in under gravity. */
  word(c: CanvasRenderingContext2D, s: string, w: Word, x: number, base: number, size: number, col: string, t: number, fall: boolean, alpha = 1) {
    const L = cachedLayout(s, FAM, size, -size * 0.03);
    c.save();
    c.font = font(FAM, size);
    c.letterSpacing = '0px';
    c.textBaseline = 'alphabetic';
    c.fillStyle = col;
    c.globalAlpha *= alpha;
    L.glyphs.forEach((g, i) => {
      if (!fall) {
        const k = clamp((t - w.start + 0.02) / 0.1);
        if (k <= 0) return;
        const sc = 1 + 0.22 * (1 - ease.outBack(k, 2.4));
        c.save();
        c.translate(x + L.width / 2, base - size * CAP / 2);
        c.scale(sc, sc);
        c.translate(-(x + L.width / 2), -(base - size * CAP / 2));
        c.fillText(g.ch, x + g.x, base);
        c.restore();
        return;
      }
      // gravity: each letter falls d s from above the frame, landing at land_i, then squashes
      const d = 0.24, land = w.start + 0.04 + i * 0.045;
      const u = (t - (land - d)) / d;
      if (u <= 0) return;
      const H0 = base + size;
      let dy = 0, sy = 1, sx = 1;
      if (u < 1) { dy = -H0 * (1 - u * u); sy = 1 + 0.25 * u; sx = 1 - 0.08 * u; }
      else {
        const a = t - land;
        const sq = Math.exp(-a * 14) * Math.cos(a * 38);
        sy = 1 - 0.22 * sq; sx = 1 + 0.12 * sq;
      }
      c.save();
      c.translate(x + g.x + g.w / 2, base + dy);
      c.scale(sx, sy);
      c.fillText(g.ch, -g.w / 2, 0);
      c.restore();
    });
    c.restore();
    return L.width;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, n = this.n, w = this.w;
    const p = this.pal(t);
    clearRT(renderer, out, p.field);
    const L = this.L, c = L.ctx; L.clear();

    // ---- A: the first pair, two rows, full frame; then the slab falls out of the bottom
    const size = n === 3 ? 360 : 340;
    const fallA = t > this.tDrop ? 0.5 * 9000 * (t - this.tDrop) ** 2 : 0;
    if (fallA < H + 800) {
      const x0 = 104;
      const reps = n === 3 ? 3 : 1;
      for (let r = reps - 1; r >= 0; r--) {
        // n=3: stacked repeats behind, offset down-right, in alternating tones
        const ox = r * 26, oy = r * 26;
        const colF = r === 0 ? p.free : r % 2 ? rgba('signal', 0.55) : rgba('graphite', 0.8);
        const colL = r === 0 ? p.fall : r % 2 ? rgba('bone', 0.35) : rgba('blood', 0.8);
        if (r > 0 && t < w[0]!.start + 0.08 * r) continue;
        this.word(c, 'FREE', w[0]!, x0 + ox, 470 + oy + fallA, size, colF, t, false);
        this.word(c, 'FALL', w[1]!, x0 + ox, 470 + size * 0.98 + oy + fallA * 1.15, size, colL, t, true);
      }
      // a deadpan label beside the slab
      const la = prog(t, w[1]!.start + 0.2, w[1]!.start + 0.5);
      if (la > 0) mono(c, `g = 9.81 m/s²  ·  t = ${(Math.max(0, t - w[1]!.start)).toFixed(2)} s`, W - 104, 150 + fallA, { size: 14, color: p.dim, align: 'right', track: 3 });
    }

    // ---- B: the second pair across the top; THE ODDS take the rest of the frame
    const kB = prog(t, this.tB, this.tB + 0.35, ease.outExpo);
    if (kB > 0) {
      const v = this.od.value(t, 0.55);
      const step = this.od.stepTime(this.n === 1 ? 1 : this.n === 2 ? 3 : this.n === 3 ? 5 : 7);
      const flash = pulse(t, step, 0.18);
      // row: FREE FALL (smaller, left), drop-in letters again
      const s2 = 150;
      const wF = this.word(c, 'FREE', w[2]!, 104, 250, s2, p.free, t, false);
      this.word(c, 'FALL', w[3]!, 104 + wF + s2 * 0.3, 250, s2, p.fall, t, true);
      // the label
      c.save(); c.globalAlpha = kB;
      mono(c, 'THE ODDS', 112, 340, { size: 22, color: p.dim, track: 8, weight: 500 });
      mono(c, 'UPSIDE : DOWNSIDE', 112, 372, { size: 14, color: p.dim, track: 5 });
      c.restore();
      // the big number, rising in from below; it rolls on the last "fall"
      let num = fmtOdds(v);
      if (n === 3 && t > step) {
        // the zeros multiply: extra zeros flicker in per frame for a moment after the step
        const extra = Math.floor(prog(t, step, step + 0.35) * 6 * (0.5 + 0.5 * hash(frameIdx(t), 3)));
        if (t < step + 0.45) num = num + '0'.repeat(extra);
      }
      const txt = `${num} : 1`;
      const chars = txt.length;
      const ns = Math.min(430, 1700 / (chars * 0.6));
      const ny = lerp(H + ns, 860, kB);
      c.save();
      c.font = font(F.mono(500), ns); c.letterSpacing = '0px'; c.textBaseline = 'alphabetic';
      const numW = c.measureText(num).width;
      c.fillStyle = flash > 0.05 ? p.hot : p.num;
      if (n === 1 || n === 4) c.fillStyle = flash > 0.05 ? rgba('signal', 1) : t > step ? rgba('signal', 1) : p.num;
      const shake = n === 3 ? (hash(frameIdx(t), 7) - 0.5) * 18 * flash : 0;
      c.fillText(num, 104 + shake, ny);
      c.fillStyle = p.num;
      c.fillText(' : 1', 104 + numW + shake, ny);
      c.restore();
      // tick bar (log scale 1 … ∞) and the footnote
      const by = 930, bw = W - 208;
      c.save(); c.globalAlpha = kB;
      c.strokeStyle = p.dim; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(104, by); c.lineTo(104 + bw, by); c.stroke();
      const dec = ['1', '10', '100', '1,000', '10⁴', '10⁵', '10⁶', '∞'];
      dec.forEach((d, i) => {
        const xx = 104 + (i / (dec.length - 1)) * bw;
        c.beginPath(); c.moveTo(xx, by - 8); c.lineTo(xx, by + 8); c.stroke();
        mono(c, d, xx, by + 30, { size: 12, color: p.dim, track: 1, align: i === 0 ? 'left' : i === dec.length - 1 ? 'right' : 'center' });
      });
      const fr = Number.isFinite(v) ? Math.min(1, Math.log10(Math.max(1, v)) / 7) : 1;
      c.fillStyle = n === 2 ? rgba('bone', 1) : rgba('signal', 1);
      c.fillRect(104, by - 3, bw * fr, 6);
      mono(c, NOTES[n] ?? '', W - 104, by + 64, { size: 13, color: p.dim, track: 2, align: 'right' });
      c.restore();
    }
    comp.draw(renderer, L.upload(), out);

    // post: hits on every word, a flash on the step
    let hit = 0;
    for (const x of w) hit = Math.max(hit, pulse(t, x.start, n === 3 ? 0.12 : 0.08));
    const step = this.od.stepTime(n === 1 ? 1 : n === 2 ? 3 : n === 3 ? 5 : 7);
    const sh = hit * (n === 3 ? 16 : n === 2 ? 9 : 6);
    return {
      bloom: n === 2 ? 0.35 : 0.6, vignette: n === 2 ? 0.25 : 0.4, ca: 1.2 + hit * 2,
      shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number],
      zoom: 1 + hit * 0.015, flash: pulse(t, step, 0.06) * (n === 2 ? 0.1 : 0.18),
    };
  }
}
