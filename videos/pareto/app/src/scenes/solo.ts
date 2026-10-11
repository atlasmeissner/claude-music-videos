// PLATE XV `solo` — "Resonance". The guitar solo, no words, four movements cut on bar lines.
// The strings are real: 100 log-spaced bands of the guitar stem's spectrum (150 Hz – 6 kHz, precomputed
// in solo-spectrum.ts); at every moment the 20 loudest are red, and a readout says how much of the
// sound they carry. I. Risonanza: 100 vertical strings ring with their bands, delay echoes trail one
// beat behind. II. Eco: a four-channel oscilloscope, the same phrase arriving on each channel a beat
// later at 80% of the level (feedback 80%). III. Fase: the strings turn radial around a red core and
// step round on the drum fills. IV. Gloria del mattino: the spokes become a sunburst of light around
// a red sun, brightening until the frame is light (hand-off to the outro).
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, lerp, ease, prog, hash, TAU } from '../engine/util';
import { Ground, INK_POST, drawPlateHead, fg, RED, footnote, type C2D } from './_kit';
import { SPEC_B64, SHARE_B64, SPEC_T0, SPEC_FPS, SPEC_BANDS, SPEC_FRAMES, SPEC_F0, SPEC_F1 } from './solo-spectrum';

const NB = SPEC_BANDS; // 100
type RGB = [number, number, number];
const BONE = LIN.bone, SIG = LIN.signal, EMB = LIN.ember;
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const ROMAN = ['I', 'II', 'III', 'IV'];
const NAMES = ['Risonanza', 'Eco', 'Fase', 'Gloria del mattino'];
const SUBS = ['resonance: 100 strings, one per band', 'echo: delay 1 beat, feedback 80%', 'phase: the strings, wound round', 'morning glory: light, mostly'];

export default class Solo extends Scene {
  g = new Ground();
  lb = new LineBatch(60000, { blend: 'add' });
  L = new Layer2D();
  B = new Layer2D(); // sunburst wedges (behind the strings)
  spec = new Float32Array(SPEC_FRAMES * NB);
  shareA = new Float32Array(SPEC_FRAMES);
  bars: number[] = []; // downbeats in the window (+ end)
  mv: number[] = []; // movement starts: [m1, m2, m3, m4, end]
  plucks: [number, number][] = [];

  override init() {
    const bin = atob(SPEC_B64);
    for (let i = 0; i < bin.length && i < this.spec.length; i++) this.spec[i] = bin.charCodeAt(i) / 255;
    const sb = atob(SHARE_B64);
    for (let i = 0; i < sb.length && i < this.shareA.length; i++) this.shareA[i] = sb.charCodeAt(i) / 255;
    const { audio } = this.ctx;
    const s = this.ctx.start, e = this.ctx.end;
    this.bars = audio.downbeats.filter((d) => d >= s - 0.05 && d < e - 0.05);
    const bar = (i: number) => this.bars[Math.min(i, this.bars.length - 1)] ?? s;
    // movements cut on the bar lines where the drum fills land: 3 + 2 + 2 + 3 bars
    this.mv = [s, bar(3), bar(5), bar(7), e];
    this.plucks = audio.events('guitar', s - 1, e);
  }

  /** Band energy 0..1 at time t (linear interpolation between analysis frames), shaped for display. */
  band(t: number, i: number) {
    const x = clamp((t - SPEC_T0) * SPEC_FPS, 0, SPEC_FRAMES - 1.001);
    const k = Math.floor(x), u = x - k;
    const v = this.spec[k * NB + i]! * (1 - u) + this.spec[(k + 1) * NB + i]! * u;
    return Math.pow(clamp((v - 0.12) / 0.88), 1.25);
  }
  /** Measured power share of the 20 loudest bands (raw spectrum, not the display shaping), smoothed. */
  share(t: number) {
    let acc = 0, n = 0;
    for (let d = -0.15; d <= 0.15; d += 0.05) {
      const x = clamp((t + d - SPEC_T0) * SPEC_FPS, 0, SPEC_FRAMES - 1);
      acc += this.shareA[Math.round(x)]!; n++;
    }
    return acc / n;
  }
  bands(t: number) {
    const a = new Float32Array(NB);
    for (let i = 0; i < NB; i++) a[i] = this.band(t, i);
    return a;
  }
  /** Indices of the 20 loudest bands, and their share of the (squared) amplitude. */
  top20(a: Float32Array) {
    const idx = Array.from({ length: NB }, (_, i) => i).sort((p, q) => a[q]! - a[p]!);
    const set = new Set(idx.slice(0, 20));
    let tot = 0, top = 0;
    for (let i = 0; i < NB; i++) { const e = a[i]! * a[i]!; tot += e; if (set.has(i)) top += e; }
    return { set, share: tot > 1e-6 ? top / tot : 0.2, idx };
  }
  freqOf(i: number) { return SPEC_F0 * Math.pow(SPEC_F1 / SPEC_F0, (i + 0.5) / NB); }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const c = this.L.ctx; this.L.clear();
    this.lb.clear();
    const m = t < this.mv[1]! ? 0 : t < this.mv[2]! ? 1 : t < this.mv[3]! ? 2 : 3;
    const post: PostOverrides = { ...INK_POST, bloom: 0.75 };
    // the downbeat that opens the solo: a quick flash out of the fire
    if (t - this.ctx.start < 0.4) post.flash = 0.35 * Math.exp(-(t - this.ctx.start) * 9);
    const a = this.bands(t);
    const top = this.top20(a);
    const beat = this.beatLen(t);

    this.g.render(renderer, out, { paper: 0, vig: 0 });
    if (m === 1 || m === 3) {
      this.B.clear();
      if (m === 1) this.scopeBack(t, this.B.ctx); else this.wedges(t, this.B.ctx, a);
      comp.draw(renderer, this.B.upload(), out);
    }

    if (m === 0) this.strings(f, c, a, top, beat);
    else if (m === 1) this.scope(f, c, a, top, beat);
    else if (m === 2) this.radial(f, c, a, top, beat);
    else this.sunburst(f, c, a, top, beat, post);

    this.lb.render(renderer, out);
    this.chrome(f, c, m, this.share(t));
    comp.draw(renderer, this.L.upload(), out);
    return post;
  }

  beatLen(t: number) {
    const au = this.ctx.audio, b = Math.floor(au.beatAt(t));
    return au.timeOfBeat(b + 1) - au.timeOfBeat(b);
  }
  /** Time of the most recent pluck (guitar onset) and its strength. */
  lastPluck(t: number): [number, number] | null {
    let best: [number, number] | null = null;
    for (const p of this.plucks) { if (p[0] <= t) best = p; else break; }
    return best;
  }
  /** Downbeat punch within the current movement (1 at a bar line, decaying). */
  barPunch(t: number, k = 6) {
    let d = -1;
    for (const b of this.bars) if (b <= t) d = b;
    return d < 0 ? 0 : Math.exp(-(t - d) * k);
  }

  // ---------------------------------------------------------------- page furniture + movement title
  chrome(f: Frame, c: C2D, m: number, share: number) {
    const t = f.t;
    const m0 = this.mv[m]!;
    const sun = m === 3 ? this.sunPaper(t) : 0;
    const ink = sun > 0.5; // on the bright end of the sunburst, furniture switches to ink
    const headK = Math.min((t - this.ctx.start) / 0.6, 1 - prog(t, this.mv[1]! - 0.4, this.mv[1]!));
    if (headK > 0) drawPlateHead(c, 15, 'Resonance', headK, { paper: ink, right: 'GUITAR SOLO · 12-STRING · 10 BARS · NO WORDS' });
    // movement title (bottom left): a big roman numeral that sweeps its width on each bar line
    const since = t - m0;
    const k = prog(t, m0, m0 + 0.35, ease.outExpo);
    const bp = this.barPunch(t, 5);
    const widths = [62, 75, 87.5, 100, 112.5, 125];
    const wi = Math.min(5, Math.floor(clamp(since / 0.32) * 5.99));
    const wBar = Math.round(lerp(3, 5, bp));
    const wdt = since < 0.32 ? widths[wi]! : widths[wBar]!;
    c.save();
    c.globalAlpha = k * (1 - 0.0 * sun);
    const x = 96, y = 990;
    c.font = font(F.archivo(wdt, 900), 92); c.fillStyle = ink ? fg(true, 0.9) : fg(false, 0.95); c.textBaseline = 'alphabetic';
    c.fillText(ROMAN[m]!, x, y);
    const nw = c.measureText(ROMAN[m]!).width;
    c.font = font(F.serif(600, true), 46); c.fillStyle = ink ? fg(true, 0.85) : fg(false, 0.9);
    c.fillText(NAMES[m]!, x + nw + 22, y - 30);
    c.font = font(F.mono(500), 15); c.fillStyle = ink ? fg(true, 0.55) : fg(false, 0.55);
    c.fillText(SUBS[m]!, x + nw + 24, y);
    c.restore();
    // the live Pareto readout (top right)
    if (m < 3 || sun < 0.85) {
      c.save();
      c.globalAlpha = prog(t, this.ctx.start + 0.3, this.ctx.start + 0.8) * (1 - sun);
      c.fillStyle = rgba('ink', 0.85); c.fillRect(W - 96 - 400, 96, 412, 96);
      c.textAlign = 'right';
      c.font = font(F.mono(500), 15); c.fillStyle = fg(false, 0.55);
      c.fillText('SHARE OF SOUND IN THE 20 LOUDEST STRINGS', W - 96, 118);
      c.font = font(F.mono(600), 34); c.fillStyle = RED();
      c.fillText(`${(share * 100).toFixed(1)}%`, W - 96, 158);
      c.font = font(F.mono(400), 13); c.fillStyle = fg(false, 0.45);
      c.fillText('PARETO PREDICTS 80.0%', W - 96, 182);
      c.restore();
    }
  }

  // ---------------------------------------------------------------- I. strings
  strings(f: Frame, c: C2D, a: Float32Array, top: { set: Set<number> }, beat: number) {
    const t = f.t, lb = this.lb;
    const m0 = this.mv[0]!;
    const sp = 15.5, x0 = (W - sp * (NB - 1)) / 2, y0 = 200, y1 = 880, Ls = y1 - y0;
    const seg = 36;
    // strings draw in from the centre outwards on the first beat
    const reveal = prog(t, m0, m0 + beat * 0.7, ease.outExpo);
    const bp = this.barPunch(t, 4);
    // camera: reframes on each bar line — full view, a close-up on the loudest course, a wider tilt-free pull-back
    const bi = Math.max(0, this.bars.filter((b) => b <= t + 1e-3 && b >= m0 - 0.01).length - 1);
    const bt = this.bars[this.bars.indexOf(this.bars.find((b) => b >= m0 - 0.01)!) + bi] ?? m0;
    const focus = (tb: number) => {
      let best = 0, bx = 50;
      for (let i = 4; i < NB - 4; i++) {
        let e = 0;
        for (let q = -4; q <= 4; q++) e += this.band(tb + 0.3, i + q) + this.band(tb + 0.9, i + q);
        if (e > best) { best = e; bx = i; }
      }
      return x0 + bx * sp;
    };
    const shots = [{ z: 1, x: 960, y: 540 }, { z: 1.75, x: focus(this.bars[1] ?? m0), y: 470 }, { z: 1.3, x: focus(this.bars[2] ?? m0), y: 480 }];
    const cur = shots[Math.min(bi, 2)]!, prev = shots[Math.max(0, Math.min(bi, 2) - 1)]!;
    const ke = bi === 0 ? 1 : ease.outExpo(clamp((t - bt) / 0.45));
    const z = lerp(prev.z, cur.z, ke) * (1 + 0.02 * bp), fx = lerp(prev.x, cur.x, ke), fy = lerp(prev.y, cur.y, ke);
    const X = (x: number) => 960 + (x - fx) * z, Y = (y: number) => 540 + (y - fy) * z;
    const echoes = 3;
    for (let i = 0; i < NB; i++) {
      const di = Math.abs(i - (NB - 1) / 2) / (NB / 2);
      if (di > reveal) continue;
      const x = x0 + i * sp;
      const red = top.set.has(i);
      // echoes first (dimmer, one beat apart, shifted right like a tape delay)
      for (let e = echoes; e >= 0; e--) {
        const te = t - e * beat;
        const amp = (e === 0 ? a[i]! : this.band(te, i)) * Math.pow(0.8, e);
        if (e > 0 && amp < 0.05) continue;
        const A = 26 * amp;
        const fr = 5 + (i % 12) * 0.45; // visible wobble rate (12-string courses)
        const ph = Math.cos(TAU * fr * te + hash(i) * TAU);
        const mode = 1 + (i % 3);
        const col: RGB = red && e === 0 ? mul(SIG, 1.7 + 1.2 * amp) : red ? mul(SIG, 0.45 * Math.pow(0.8, e)) : mul(BONE, (0.22 + 0.5 * amp) * Math.pow(0.55, e));
        const w = e === 0 ? (red ? 1.6 : 1.0) : 0.8;
        const xo = e * 5;
        let px = 0, py = 0;
        for (let k = 0; k <= seg; k++) {
          const u = k / seg;
          const d = A * Math.sin(Math.PI * u * mode) * ph * Math.sin(Math.PI * u);
          const xx = X(x + xo + d), yy = Y(y0 + u * Ls);
          if (k > 0) lb.seg2(px, py, xx, yy, w, col, 1);
          px = xx; py = yy;
        }
      }
      // envelope ghosts of the loud ones (long-exposure look)
      if (a[i]! > 0.35) {
        const A = 26 * a[i]!;
        const mode = 1 + (i % 3);
        for (const sg of [-1, 1]) {
          let px = 0, py = 0;
          for (let k = 0; k <= seg; k++) {
            const u = k / seg;
            const d = sg * A * Math.abs(Math.sin(Math.PI * u * mode)) * Math.sin(Math.PI * u);
            const xx = X(x + d), yy = Y(y0 + u * Ls);
            if (k > 0) lb.seg2(px, py, xx, yy, 0.7, red ? mul(SIG, 0.35) : mul(BONE, 0.08), 1);
            px = xx; py = yy;
          }
        }
      }
    }
    // bridge and nut: two hairline bars
    for (const yy of [y0, y1]) lb.seg2(X(x0 - 20), Y(yy), X(x0 + sp * (NB - 1) + 20), Y(yy), 1.4, mul(BONE, 0.5), reveal);
    // labels
    c.save();
    c.globalAlpha = reveal;
    c.font = font(F.mono(400), 13); c.fillStyle = fg(false, 0.5); c.textAlign = 'center';
    for (let i = 0; i < NB; i += 11) {
      const f0 = this.freqOf(i);
      c.fillText(f0 >= 1000 ? `${(f0 / 1000).toFixed(1)}k` : `${Math.round(f0)}`, X(x0 + i * sp), Y(y1) + 28);
    }
    c.textAlign = 'left'; c.fillText('Hz', X(x0 + sp * (NB - 1)) + 18, Y(y1) + 28);
    c.fillText('FIG. XV·1  ONE STRING PER BAND OF THE GUITAR', X(x0 - 20), Y(y0) - 18);
    // pluck ticks: red marks over the loudest string at each guitar onset
    const lp = this.lastPluck(t);
    if (lp && t - lp[0] < 0.5) {
      let bi = 0; for (let i = 1; i < NB; i++) if (a[i]! > a[bi]!) bi = i;
      const k = 1 - (t - lp[0]) / 0.5;
      c.fillStyle = RED(k);
      c.beginPath(); c.moveTo(X(x0 + bi * sp), Y(y0) - 4); c.lineTo(X(x0 + bi * sp) - 6, Y(y0) - 16); c.lineTo(X(x0 + bi * sp) + 6, Y(y0) - 16); c.closePath(); c.fill();
    }
    c.restore();
  }

  // ---------------------------------------------------------------- II. oscilloscope + delay
  /** Pseudo-waveform from the band amplitudes at time te (the 20 loudest partials), sampled at u ∈ [0,1]. */
  wave(te: number, u: number, a: Float32Array, set: Iterable<number>) {
    let y = 0;
    for (const i of set) {
      const fr = 1.5 + i * 0.3; // cycles across the screen (higher bands: finer ripple)
      y += a[i]! * Math.sin(TAU * (fr * u + hash(i, 5)) + te * (3 + i * 0.08)) * (1.4 - i / NB);
    }
    return y;
  }
  /** The oscilloscope's screen (behind the traces). */
  scopeBack(t: number, c: C2D) {
    const m0 = this.mv[1]!;
    const sx0 = 300, sx1 = 1620, sy0 = 200, sy1 = 880;
    const open = prog(t, m0, m0 + 0.3, ease.outExpo);
    const midY = (sy0 + sy1) / 2, hh = (sy1 - sy0) / 2 * open;
    c.save();
    c.fillStyle = rgba('ink2', 1);
    c.beginPath(); c.roundRect(sx0, midY - hh, sx1 - sx0, hh * 2, 18); c.fill();
    c.strokeStyle = fg(false, 0.45); c.lineWidth = 1.2; c.stroke();
    c.restore();
  }
  scope(f: Frame, c: C2D, a: Float32Array, top: { set: Set<number> }, beat: number) {
    const t = f.t, lb = this.lb;
    const m0 = this.mv[1]!;
    const sx0 = 300, sx1 = 1620, sy0 = 200, sy1 = 880;
    const open = prog(t, m0, m0 + 0.3, ease.outExpo);
    const midY = (sy0 + sy1) / 2;
    const hh = (sy1 - sy0) / 2 * open;
    if (open < 0.05) return;
    // graticule: 10 × 8 divisions, with minor ticks on the centre lines
    const gx = (sx1 - sx0) / 10, gy = (hh * 2) / 8;
    const gcol: RGB = mul(BONE, 0.07);
    for (let i = 1; i < 10; i++) lb.seg2(sx0 + i * gx, midY - hh, sx0 + i * gx, midY + hh, 1, gcol, 1);
    for (let j = 1; j < 8; j++) lb.seg2(sx0, midY - hh + j * gy, sx1, midY - hh + j * gy, 1, gcol, 1);
    // four channels: dry, and the delay taps one beat apart at 80% each
    const chans = 4, chH = (hh * 2) / chans;
    const N = 260;
    const set = top.set;
    for (let ch = 0; ch < chans; ch++) {
      const te = t - ch * beat;
      const aa = ch === 0 ? a : this.bands(te);
      const tset = ch === 0 ? set : this.top20(aa).set;
      const g = Math.pow(0.8, ch);
      const cy = midY - hh + chH * (ch + 0.5);
      const amp = chH * 0.2 * g;
      const col: RGB = ch === 0 ? mul(BONE, 1.15) : mul(BONE, 0.55 * g);
      // triggered sweep: one screen per beat; ahead of the beam, last beat's sweep, fading
      const sweep = f.beatPhase;
      let px = 0, py = 0;
      for (let k = 0; k <= N; k++) {
        const u = k / N;
        const y = cy + this.wave(te, u, aa, tset) * amp / 3;
        const x = sx0 + 10 + u * (sx1 - sx0 - 20);
        const ahead = u > sweep;
        const br = ahead ? 0.35 * (1 - (u - sweep)) : 1;
        if (k > 0) lb.seg2(px, py, x, y, ch === 0 ? 1.8 : 1.2, mul(col, br), 1);
        px = x; py = y;
      }
      if (ch === 0) {
        // the beam
        const u = sweep, x = sx0 + 10 + u * (sx1 - sx0 - 20), y = cy + this.wave(te, u, aa, tset) * amp / 3;
        lb.seg2(x - 1, y, x + 1, y, 7, mul(BONE, 2.2), 1);
      }
      // phosphor persistence: the dry trace a few frames back, dim red
      if (ch === 0) {
        for (let p = 1; p <= 3; p++) {
          const tp = t - p * 0.05;
          const ap = this.bands(tp);
          const sp = this.top20(ap).set;
          let qx = 0, qy = 0;
          for (let k = 0; k <= N; k += 2) {
            const u = k / N;
            const y = cy + this.wave(tp, u, ap, sp) * amp / 3;
            const x = sx0 + 10 + u * (sx1 - sx0 - 20);
            if (k > 0) lb.seg2(qx, qy, x, y, 1.2, mul(SIG, 0.5 / p), 1);
            qx = x; qy = y;
          }
        }
      }
      // channel label
      c.save();
      c.font = font(F.mono(500), 14); c.fillStyle = ch === 0 ? fg(false, 0.8) : fg(false, 0.5);
      c.fillText(ch === 0 ? 'CH1  DRY' : `CH${ch + 1}  +${ch} BEAT${ch > 1 ? 'S' : ''} × ${g.toFixed(2)}`, sx0 + 16, cy - chH / 2 + 22);
      c.restore();
    }
    // spectrum strip under the screen: 100 bars, the 20 loudest red
    const bx0 = sx0, bw = (sx1 - sx0) / NB, by = sy1 + 70;
    for (let i = 0; i < NB; i++) {
      const h = 6 + 46 * a[i]!;
      const red = set.has(i);
      lb.seg2(bx0 + (i + 0.5) * bw, by, bx0 + (i + 0.5) * bw, by - h, bw * 0.6, red ? mul(SIG, 1.6) : mul(BONE, 0.3), open);
    }
    c.save();
    c.font = font(F.mono(500), 14); c.fillStyle = fg(false, 0.55);
    c.fillText('FIG. XV·2  TIMEBASE 1 BEAT / SCREEN · DELAY 1 BEAT · FEEDBACK 80%', sx0, sy0 - 18);
    c.textAlign = 'right'; c.fillStyle = RED(0.9);
    c.fillText('20 OF 100 BANDS', sx1, by + 22);
    c.restore();
  }

  // ---------------------------------------------------------------- III. radial strings
  radial(f: Frame, c: C2D, a: Float32Array, top: { set: Set<number> }, beat: number) {
    const t = f.t, lb = this.lb, au = this.ctx.audio;
    const m0 = this.mv[2]!;
    const cx = 960, cy = 545;
    const k = prog(t, m0, m0 + beat, ease.outExpo);
    // rotation steps on the snares of the fills
    let rot = -Math.PI / 2;
    for (const [st, s] of au.events('snare', m0, t + 0.001)) if (s > 0.3) rot += (TAU / 100) * 3 * ease.outExpo(clamp((t - st) / 0.25));
    const r0 = lerp(60, 120, k);
    // echo rings: the closed waveform, one beat apart, 80% each
    for (let e = 3; e >= 0; e--) {
      const te = t - e * beat;
      const aa = e === 0 ? a : this.bands(te);
      const st = this.top20(aa).set;
      const g = Math.pow(0.8, e);
      const R = (r0 + 40) + e * 26;
      const N = 300;
      let px = 0, py = 0;
      for (let j = 0; j <= N; j++) {
        const u = j / N, th = u * TAU + rot * 0.5;
        // wrap the waveform round (integer cycles so it closes)
        let y = 0;
        for (const i of st) y += aa[i]! * Math.sin(TAU * Math.round(2 + i * 0.12) * u + hash(i, 5) * TAU + te * 2);
        const r = R + y * 6 * g * k;
        const x = cx + Math.cos(th) * r, yy = cy + Math.sin(th) * r;
        if (j > 0) lb.seg2(px, py, x, yy, e === 0 ? 1.5 : 1, e === 0 ? mul(SIG, 1.5) : mul(BONE, 0.35 * g), 1);
        px = x; py = yy;
      }
    }
    // the strings, radial; each vibrates across its own direction
    for (let i = 0; i < NB; i++) {
      const th = rot + (i / NB) * TAU;
      const red = top.set.has(i);
      const len = (160 + 260 * a[i]!) * k;
      const rr0 = r0 + 150;
      const dx = Math.cos(th), dy = Math.sin(th), nx = -dy, ny = dx;
      const A = 9 * a[i]! * Math.cos(TAU * (5 + (i % 12) * 0.45) * t + hash(i) * TAU);
      const seg = 14;
      let px = 0, py = 0;
      for (let s = 0; s <= seg; s++) {
        const u = s / seg;
        const d = A * Math.sin(Math.PI * u);
        const r = rr0 + u * len;
        const x = cx + dx * r + nx * d, y = cy + dy * r + ny * d;
        if (s > 0) lb.seg2(px, py, x, y, red ? 1.7 : 1, red ? mul(SIG, 1.8 + a[i]!) : mul(BONE, 0.25 + 0.45 * a[i]!), 1);
        px = x; py = y;
      }
    }
    // red core
    c.save();
    c.fillStyle = RED();
    c.beginPath(); c.arc(cx, cy, r0 * 0.55 * (1 + 0.12 * f.a.kick), 0, TAU); c.fill();
    c.font = font(F.mono(500), 14); c.fillStyle = fg(false, 0.55);
    c.fillText('FIG. XV·3  THE SAME 100 STRINGS, WOUND ROUND; ECHO RINGS 1 BEAT APART', 96, 118);
    c.restore();
  }

  // ---------------------------------------------------------------- IV. sunburst
  /** 0..1: how far the sunburst has turned the frame to light (the last bar). */
  sunPaper(t: number) {
    return ease.inCubic(prog(t, this.mv[4]! - 2.6, this.mv[4]! - 0.05));
  }
  /** Sunrise geometry for movement IV: the horizon, the sun's centre and radius. */
  sunGeo(t: number) {
    const m0 = this.mv[3]!, m1 = this.mv[4]!;
    const k = prog(t, m0, m1 - 0.8, ease.outCubic);
    return { hy: 735, cx: 960, cy: lerp(905, 540, k), r: lerp(130, 205, k) * (1 + 0.05 * this.ctx.audio.hit('kick', t, 0.12)) };
  }
  /** Behind the rays: the sky warming around the sun, flooding to light at the end. */
  wedges(t: number, c: C2D, a: Float32Array) {
    const { hy, cx, cy, r } = this.sunGeo(t);
    const light = this.sunPaper(t);
    const lvl = 0.05 + 0.18 * (a.reduce((p, q) => p + q, 0) / NB);
    c.save();
    const gr = c.createRadialGradient(cx, cy, r * 0.9, cx, cy, 900 + 600 * light);
    gr.addColorStop(0, `rgba(241,235,221,${lvl * 2 + light})`);
    gr.addColorStop(0.3, `rgba(241,235,221,${lvl * 0.6 + light * 0.6})`);
    gr.addColorStop(1, `rgba(241,235,221,${light * 0.9})`);
    c.fillStyle = gr; c.fillRect(0, 0, W, hy);
    c.fillStyle = `rgba(241,235,221,${light})`; c.fillRect(0, 0, W, H);
    c.restore();
  }
  sunburst(f: Frame, c: C2D, a: Float32Array, top: { set: Set<number> }, beat: number, post: PostOverrides) {
    const t = f.t, lb = this.lb;
    const m0 = this.mv[3]!, m1 = this.mv[4]!;
    const { hy, cx, cy, r } = this.sunGeo(t);
    const k = prog(t, m0, m0 + beat * 2, ease.outExpo);
    const light = this.sunPaper(t);
    const rot = (t - m0) * 0.05;
    const bp = this.barPunch(t, 4);
    // clip a ray to the sky (above the horizon)
    const ray = (th: number, r1: number, r2: number, w: number, col: RGB) => {
      const dx = Math.cos(th), dy = Math.sin(th);
      let x1 = cx + dx * r1, y1 = cy + dy * r1, x2 = cx + dx * r2, y2 = cy + dy * r2;
      if (y1 > hy && y2 > hy) return;
      if (y1 > hy) { const u = (hy - y1) / (y2 - y1); x1 += (x2 - x1) * u; y1 = hy; }
      if (y2 > hy) { const u = (hy - y1) / (y2 - y1); x2 = x1 + (x2 - x1) * u; y2 = hy; }
      lb.seg2(x1, y1, x2, y2, w, col, 1);
    };
    // fine engraved rays: 240 hairlines, each lit by its band
    const fade = 1 - light;
    for (let j = 0; j < 240; j++) {
      const th = -Math.PI + (j / 240) * TAU + rot * 0.5;
      const e = a[Math.floor((j * NB) / 240) % NB]!;
      ray(th, r + 30, 2200, 0.8, mul(BONE, (0.10 + 0.35 * e + 0.15 * bp) * k * fade));
    }
    // the 100 strings as rays: the 20 loudest red
    for (let i = 0; i < NB; i++) {
      const th = -Math.PI + (i / NB) * TAU * 0.5 + rot + 0.004; // fanned over the upper half
      const red = top.set.has(i);
      const len = (220 + 1000 * a[i]!) * k;
      const col: RGB = red ? mul(SIG, (1.6 + a[i]!) * (1 - light * 0.7)) : mul(BONE, (0.2 + 0.7 * a[i]!) * fade);
      ray(th, r + 22, r + 22 + len, red ? 2.2 : 1.2, col);
    }
    // water: engraved horizontal lines below the horizon, broken by the sun's reflection
    for (let q = 0; q < 34; q++) {
      const y = hy + 5 + Math.pow(q, 1.45) * 4.2;
      if (y > H) break;
      const refl = r * (1.05 - q * 0.018) * (1 + 0.2 * Math.sin(t * 3 + q * 1.7));
      const g = mul(BONE, (0.10 + 0.05 * (q % 2)) * fade + 0.0);
      lb.seg2(0, y, cx - refl, y, 1, g, 1);
      lb.seg2(cx + refl, y, W, y, 1, g, 1);
      // the reflection: short red strokes, wobbling
      const n = 3 + (q % 3);
      for (let s2 = 0; s2 < n; s2++) {
        const u0 = (s2 + 0.15 + 0.1 * Math.sin(t * 2.3 + q + s2)) / n, u1 = (s2 + 0.75) / n;
        lb.seg2(cx - refl + 2 * refl * u0, y, cx - refl + 2 * refl * u1, y, 1.6, mul(SIG, (1.2 - q * 0.025) * (cy < hy ? 1 : 0.4)), 1);
      }
    }
    lb.seg2(0, hy, W, hy, 1.4, mul(BONE, 0.6 * fade + 0.2), 1);
    // the sun (front layer), clipped at the horizon, engraved lines across its lower half
    c.save();
    c.beginPath(); c.rect(0, 0, W, hy); c.clip();
    c.fillStyle = RED();
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    // a hairline corona, pulsing on the bar lines
    c.strokeStyle = light > 0.5 ? fg(true, 0.5) : fg(false, 0.55); c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, r + 12 + 10 * bp, 0, TAU); c.stroke();
    c.restore();
    c.save();
    c.font = font(F.mono(500), 14); c.fillStyle = light > 0.5 ? fg(true, 0.6) : fg(false, 0.55);
    if (light < 0.9) c.fillText('FIG. XV·4  SUNRISE OVER THE 80%, AFTER NO ALBUM IN PARTICULAR', 96, 118);
    c.restore();
    post.ca = 0.9;
    post.bloom = 0.8;
    post.paper = light;
    post.halation = 0.12 * (1 - light);
    post.vignette = lerp(0.35, 0.15, light);
    post.flash = 0.5 * ease.inQuad(prog(t, m1 - 0.22, m1));
    footnote(c, '* the sun: 20% of the picture, 80% of the light', W - 96, 1012, { paper: light > 0.5, align: 'right', a: prog(t, m0 + 1, m0 + 1.6) });
  }
}
