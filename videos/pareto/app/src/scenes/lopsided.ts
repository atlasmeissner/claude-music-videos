// PLATE VII / XII — "A lopsided world". The chorus' last two lines, one continuous camera move.
//   "Yeah, it's a lopsided world": a balance beam with 80 grey unit weights on the left and 20 red ones
//      on the right, level (as physics demands). The line is set on the beam. On "lopsided" the beam
//      slams down on the red side anyway; on "world" the whole frame tilts with it.
//   "a mathematical high": a red pen takes off from the low end of the beam and draws the Pareto curve
//      up out of the frame; the camera climbs with it; "high" stands on the 100% line.
//   "We're soaring on the fraction,": the curve's asymptote is the vinculum of a huge 20/100; the camera
//      flies along it like a runway, the words painted on it.
//   "watching time fly by!": clocks fly past the camera on the beats, the words streak, "by!" is held.
//   Hand-offs: n=1 a last clock's ink face swallows the frame (night: Camden). n=2 (ink, glowing red,
//      harder tilt, clocks on the 8ths) the clock hands wind into a guilloché rosette that slows into
//      the bridge.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { clamp, ease, hash, lerp, noise1, smoothstep, frameIdx, keys, TAU } from '../engine/util';
import { Ground, drawPlateHead, footnote, fg, RED, wordIn, pareto, PAPER_POST, INK_POST } from './_kit';
import { drawWord, lay, popAt, chase, hatchRect, type WordStyle, type C2D } from './chorus-kit';

/** World geometry (px at zoom 1). Beam pivot at the origin; y down. */
const BEAM = { half: 700, th: 14, foot: 118 };
/** The Pareto curve: origin (bottom-left) and size; its asymptote (y = top) is the vinculum. */
const CURVE = { x: 720, y: 150, w: 1500, h: 1090 };
const BAR_Y = CURVE.y - CURVE.h; // the 100% line / vinculum (top edge)
const CAP = 0.686;

interface Cam { x: number; y: number; z: number; r: number }

export default class Lopsided extends Scene {
  n = 1;
  g = new Ground();
  L = new Layer2D();
  G = new Layer2D();
  la!: Line; lb!: Line;
  tLop = 0; tWorld = 0; tMath = 0; tHigh = 0; tHighEnd = 0; tB0 = 0; tFracEnd = 0; tWatch = 0; tBy = 0; tByEnd = 0;
  wHigh!: Word; wBy!: Word;
  fam = F.archivo(62, 900);
  beamSize = 76;
  beamXs: number[] = [];
  bXs: number[] = []; bSize = 110;
  sSize = 170; sXs: number[] = [];
  clocks: { tb: number; a: number; spin: number; r: number }[] = [];
  tilt = 0.21;
  /** n=2: everything in screen space fades as the rosette takes over */
  dimOut = 1;

  override init() {
    const { lyrics, params, audio: au, end } = this.ctx;
    this.n = Number(params.n ?? 1);
    const k = this.n - 1, X = this.n === 2;
    this.la = lyrics.get('lopsided world', k);
    this.lb = lyrics.get('soaring on the fraction', k);
    this.tLop = wordIn(this.la, 'lopsided').start;
    this.tWorld = wordIn(this.la, 'world').start;
    this.tMath = wordIn(this.la, 'mathematical').start;
    this.wHigh = wordIn(this.la, 'high');
    this.tHigh = this.wHigh.start; this.tHighEnd = this.wHigh.end;
    this.tB0 = this.lb.words[0]!.start;
    this.tFracEnd = wordIn(this.lb, 'fraction').end;
    this.tWatch = wordIn(this.lb, 'watching').start;
    this.wBy = wordIn(this.lb, 'by');
    this.tBy = this.wBy.start; this.tByEnd = this.wBy.end;
    this.tilt = X ? 0.29 : 0.21;

    // line A on the beam (the words between the two loads)
    const aw = this.la.words.slice(0, this.la.words.indexOf(wordIn(this.la, 'world')) + 1);
    const sp = measure(' ', this.fam, 100) * 0.85;
    const em = aw.reduce((a, w) => a + lay(w.w, this.fam, 100).width, 0) + sp * (aw.length - 1);
    this.beamSize = Math.floor(Math.min(X ? 84 : 78, (900 / em) * 100));
    let x = -((em * this.beamSize) / 100) / 2;
    for (const w of aw) { this.beamXs.push(x); x += lay(w.w, this.fam, this.beamSize).width + (sp * this.beamSize) / 100; }
    // line B, first half, on the vinculum
    const bw = this.lb.words.slice(0, this.lb.words.indexOf(wordIn(this.lb, 'fraction')) + 1);
    this.bSize = X ? 124 : 112;
    x = CURVE.x + CURVE.w + 260;
    for (const w of bw) { this.bXs.push(x); x += lay(w.w, this.fam, this.bSize).width + (sp * this.bSize) / 100; }
    // line B, second half, in screen space
    const sw = this.lb.words.slice(this.lb.words.indexOf(wordIn(this.lb, 'watching')));
    const em2 = sw.reduce((a, w) => a + lay(w.w, this.fam, 100).width, 0) + sp * (sw.length - 1);
    this.sSize = Math.floor(Math.min(X ? 200 : 180, (1500 / em2) * 100));
    x = 960 - ((em2 * this.sSize) / 100) / 2;
    for (const w of sw) { this.sXs.push(x); x += lay(w.w, this.fam, this.sSize).width + (sp * this.sSize) / 100; }

    // clocks: one per beat (n=2: per 8th) from the end of "fraction," to the end
    const step = X ? 0.5 : 1;
    const b0 = Math.ceil(au.beatAt(this.tFracEnd - 0.25) / step) * step;
    for (let b = b0; ; b += step) {
      const tb = au.timeOfBeat(b);
      if (tb > end - 0.05) break;
      // in the instrumental gap each beat lands a burst of three
      const burst = tb < this.tWatch - 0.1 && Math.abs(b - Math.round(b)) < 1e-6 ? 3 : 1;
      for (let j = 0; j < burst; j++) {
        const i = this.clocks.length;
        this.clocks.push({ tb, a: (i * 2.39996 + j * 2.1 + hash(i, 7) * 0.8) % TAU, spin: 2 + hash(i, 9) * 4, r: 0.6 + hash(i, 11) * 0.7 });
      }
    }
  }

  // ------------------------------------------------------------------ geometry
  private beamAngle(t: number) {
    if (t < this.tLop) return 0;
    const u = t - this.tLop;
    // slam with a damped bounce
    const X = this.n === 2;
    return this.tilt * (1 - Math.exp(-u * (X ? 9 : 7)) * Math.cos(u * (X ? 26 : 20)));
  }
  private penU(t: number) {
    return keys(t, [[this.tMath - 0.05, 0], [this.tHigh, 0.22, ease.outCubic], [this.tHighEnd, 0.55, ease.inOutCubic], [this.tB0 + 0.2, 1, ease.inOutCubic]]);
  }
  private curvePt(u: number) { return { x: CURVE.x + u * CURVE.w, y: CURVE.y - pareto(u) * CURVE.h }; }

  private cam(t: number): Cam {
    const X = this.n === 2;
    const v0: Cam = { x: 0, y: -110, z: 1.14, r: 0 };
    // tilt on "world"
    const tiltR = t >= this.tWorld ? ease.outExpo(clamp((t - this.tWorld) / 0.35)) * (X ? 0.075 : 0.05) : 0;
    // climb with the pen
    const climb = smoothstep(this.tMath - 0.1, this.tMath + 0.7, t);
    const head = this.curvePt(this.penU(t - 0.12));
    const fx = lerp(v0.x, head.x - 120, climb), fy = lerp(v0.y, head.y + 170, climb);
    let x = fx, y = fy;
    let z = lerp(v0.z, 0.86, climb);
    let r = tiltR * (1 - smoothstep(this.tHigh - 0.3, this.tHighEnd, t));
    // fly along the vinculum, word by word
    if (t >= this.tB0 - 0.25) {
      const bw = this.lb.words.slice(0, this.bXs.length);
      const evs = [this.tB0 - 0.25, ...bw.slice(1).map((w) => w.start)];
      const tgt = (i: number) => this.bXs[i]! + lay(bw[i]!.w, this.fam, this.bSize).width * 0.5 + 220;
      const x0 = this.cam0x(this.tB0 - 0.25);
      let cx = chase(t, evs, tgt, x0, 0.5, ease.outCubic);
      const v = X ? 1100 : 950;
      if (t > this.tFracEnd) cx = chase(this.tFracEnd, evs, tgt, x0, 0.5, ease.outCubic) + v * (t - this.tFracEnd);
      const k = ease.inOutCubic(clamp((t - this.tB0 + 0.25) / 0.6));
      x = lerp(fx, cx, Math.min(1, k * 4));
      y = lerp(fy, BAR_Y + 40, k);
      z = lerp(z, X ? 1.3 : 1.24, k);
      // rise above the runway for the clocks
      y -= 240 * ease.inOutCubic(clamp((t - this.tFracEnd - 0.1) / 1.0));
    }
    return { x, y, z, r };
  }
  /** The climbing camera's x at time t (before the runway section), for continuity. */
  private cam0x(t: number) {
    const climb = smoothstep(this.tMath - 0.1, this.tMath + 0.7, t);
    return lerp(0, this.curvePt(this.penU(t - 0.12)).x - 120, climb);
  }

  // ------------------------------------------------------------------ render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio: au } = this.ctx;
    const t = f.t, X = this.n === 2, paper = !X;
    const c = this.L.ctx; this.L.clear();
    const gc = this.G.ctx; if (X) this.G.clear();
    const rc = X ? gc : c;
    const post: PostOverrides = X ? { ...INK_POST, bloom: 0.45 } : { ...PAPER_POST };
    this.g.render(renderer, out, { paper: X ? 0 : 1, grid: 0, vig: X ? 0 : 0.22, seed: 30 + this.n });

    // camera + beat punch
    const cm = this.cam(t);
    const db = [...au.downbeats].reverse().find((d) => d <= t + 1e-4) ?? this.ctx.start;
    const pk = Math.exp(-(t - db) * 8);
    const z = cm.z * (1 + (X ? 0.03 : 0.012) * pk);
    const roll = cm.r + (X ? (au.downbeats.indexOf(db) % 2 ? 1 : -1) * 0.006 * pk : 0);
    const apply = (cx: C2D) => { cx.translate(960, 540); cx.rotate(roll); cx.scale(z, z); cx.translate(-cm.x, -cm.y); };
    c.save(); apply(c); if (X) { gc.save(); apply(gc); }
    this.drawBalance(c, rc, t, paper);
    this.drawCurve(c, rc, t, paper);
    this.drawRunway(c, rc, t, paper);
    c.restore(); if (X) gc.restore();

    this.dimOut = X ? 1 - smoothstep(this.tByEnd - 0.05, this.tByEnd + 0.3, t) : 1;
    // screen space: speed lines, clocks, the second half of line B, furniture
    this.drawSpeed(c, rc, t, paper);
    this.drawClocks(c, rc, t, paper);
    this.drawStreakLine(c, gc, t, paper);
    const headA = 1 - smoothstep(this.tMath, this.tMath + 0.4, t);
    if (headA > 0) {
      c.save(); c.globalAlpha = headA;
      drawPlateHead(c, X ? 12 : 7, 'A lopsided world', f.lt / 0.6, { paper, right: X ? 'RE-WEIGHED, SAME RESULT' : 'THE WORLD, WEIGHED' });
      footnote(c, '¹ Weighed by importance, not by mass. Scales calibrated by Pareto (1896).', 96, 1012, { paper, a: clamp((f.lt - 0.3) / 0.4) });
      c.restore();
    }
    const tEnd = this.ctx.end;
    if (!X) this.drawNightfall(c, t, tEnd);
    else this.drawRosette(c, gc, t, tEnd);

    // hits
    let shake = 0;
    if (t >= this.tLop) shake += (X ? 30 : 16) * Math.exp(-(t - this.tLop) * 10);
    if (X) shake += 8 * pk * (t - db < 0.25 ? 1 : 0);
    for (const ck of this.clocks) if (t >= ck.tb && t < ck.tb + 0.3) shake += (X ? 3 : 2) * Math.exp(-(t - ck.tb) * 16);
    if (shake > 0.05) post.shake = [noise1(frameIdx(t) * 0.7, 3) * shake, noise1(frameIdx(t) * 0.7, 4) * shake];
    if (X && t >= this.tLop && t < this.tLop + 2 / 60) post.invert = 1;

    comp.draw(renderer, this.L.upload(), out);
    if (X) comp.draw(renderer, this.G.upload(), out, { tint: [1.35, 1.35, 1.35] });
    return post;
  }

  // ------------------------------------------------------------------ the balance
  private drawBalance(c: C2D, rc: C2D, t: number, paper: boolean) {
    const X = !paper;
    const A = 1 - smoothstep(this.tB0 + 0.6, this.tB0 + 1.2, t);
    if (A <= 0) return;
    const th = this.beamAngle(t);
    c.save(); c.globalAlpha = A; rc.save(); rc.globalAlpha = A;
    // ground + fulcrum
    c.strokeStyle = fg(paper, 0.8); c.lineWidth = X ? 2 : 1.25;
    c.beginPath(); c.moveTo(-1100, BEAM.foot); c.lineTo(1100, BEAM.foot); c.stroke();
    for (let x = -1100; x < 1100; x += 22) { c.beginPath(); c.moveTo(x, BEAM.foot); c.lineTo(x - 12, BEAM.foot + 12); c.stroke(); }
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-64, BEAM.foot); c.lineTo(64, BEAM.foot); c.closePath();
    c.fillStyle = X ? rgba('ink') : rgba('bone'); c.fill();
    hatchRect(c, -64, 0, 128, BEAM.foot, 6, fg(paper, 0.5));
    c.save(); c.beginPath(); c.moveTo(0, 0); c.lineTo(-64, BEAM.foot); c.lineTo(64, BEAM.foot); c.closePath(); c.stroke(); c.restore();
    // erase the hatch outside the triangle: redraw ground colour wedges
    c.fillStyle = X ? rgba('ink') : rgba('bone');
    c.beginPath(); c.moveTo(-65, -1); c.lineTo(0, -1); c.lineTo(-65, BEAM.foot + 1); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(65, -1); c.lineTo(0, -1); c.lineTo(65, BEAM.foot + 1); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-64, BEAM.foot); c.lineTo(64, BEAM.foot); c.closePath(); c.stroke();
    c.font = font(F.mono(500), 13); c.fillStyle = fg(paper, 0.6); c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText('FULCRUM (IMPARTIAL)', 0, BEAM.foot + 22);

    // the beam (rotates)
    for (const ctx of X ? [c, rc] : [c]) { ctx.save(); ctx.rotate(th); }
    c.fillStyle = fg(paper, 0.92);
    c.fillRect(-BEAM.half, -BEAM.th / 2, BEAM.half * 2, BEAM.th);
    c.fillStyle = X ? rgba('ink') : rgba('bone');
    c.beginPath(); c.arc(0, 0, 6, 0, TAU); c.fill();
    // loads: 80 grey (10×8) left, 20 red (5×4) right, same unit size
    const u = 15, gp = 4;
    const top = -BEAM.th / 2;
    for (let i = 0; i < 80; i++) {
      const col = i % 10, row = Math.floor(i / 10);
      const x = -BEAM.half + 6 + col * (u + gp), y = top - (row + 1) * (u + gp) + gp;
      // the pile drops in on the first beats
      const tIn = this.ctx.start + 0.02 * (79 - i) * 0.25;
      const d = clamp((t - tIn) / 0.2);
      if (d <= 0) continue;
      c.fillStyle = X ? rgba('ash', 0.7) : rgba('graphite', 0.85);
      c.fillRect(x, y - (1 - ease.outCubic(d)) * 40, u, u);
    }
    for (let i = 0; i < 20; i++) {
      const col = i % 5, row = Math.floor(i / 5);
      const x = BEAM.half - 6 - (5 - col) * (u + gp) + gp, y = top - (row + 1) * (u + gp) + gp;
      rc.fillStyle = RED();
      rc.fillRect(x, y, u, u);
    }
    // load labels
    c.font = font(F.mono(500), 13); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = fg(paper, 0.7);
    c.fillText('80 × FILLER', -BEAM.half + 6, top - 8 * (u + gp) - 14);
    c.fillStyle = RED(); c.textAlign = 'right';
    c.fillText('20 × VITAL', BEAM.half - 6, top - 4 * (u + gp) - 14);
    // line A, set on the beam
    const aw = this.la.words.slice(0, this.beamXs.length);
    aw.forEach((w, i) => {
      const pop = popAt(t, w.start, 0.22) * (w.w.toLowerCase().startsWith('lopsided') ? (X ? 0.22 : 0.14) : 0.04);
      const ww = lay(w.w, this.fam, this.beamSize).width;
      for (const [ctx, glow] of (X ? [[c, false], [rc, true]] : [[c, false]]) as [C2D, boolean][]) {
        ctx.save();
        ctx.translate(this.beamXs[i]! + ww / 2, top - 14); ctx.scale(1 + pop, 1 + pop); ctx.translate(-ww / 2, 0);
        drawWord(ctx, w, t, 0, 0, this.style(paper, this.beamSize, glow));
        ctx.restore();
      }
    });
    for (const ctx of X ? [c, rc] : [c]) ctx.restore();

    // the verdict
    if (t >= this.tLop + 0.15) {
      const s = 'VERDICT: LOPSIDED (AS SHOWN)';
      const k = clamp((t - this.tLop - 0.15) / 0.5);
      c.font = font(F.mono(600), X ? 20 : 18); c.fillStyle = RED(); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillText(s.slice(0, Math.ceil(s.length * k)), 300, -330);
      c.font = font(F.mono(400), 14); c.fillStyle = fg(paper, 0.65 * k);
      c.fillText(`Σ left = 80 units · Σ right = 20 units · tilt = ${((this.tilt * 180) / Math.PI).toFixed(1)}° right`, 300, -302);
    }
    c.restore(); rc.restore();
  }

  private style(paper: boolean, size: number, glow: boolean): WordStyle {
    const clear = 'rgba(0,0,0,0)';
    return { fam: this.fam, size, sung: glow ? clear : fg(paper), key: glow ? RED() : paper ? RED() : clear, base: glow ? clear : fg(paper), dim: paper ? 0.22 : 0.13 };
  }

  // ------------------------------------------------------------------ the curve ("a mathematical high")
  private drawCurve(c: C2D, rc: C2D, t: number, paper: boolean) {
    const X = !paper;
    if (t < this.tMath - 0.45) return;
    const u = this.penU(t);
    // launch from the low end of the beam (a short red lead-in)
    const th = this.beamAngle(t);
    const ex = Math.cos(th) * BEAM.half, ey = Math.sin(th) * BEAM.half;
    rc.save();
    rc.strokeStyle = RED(); rc.lineWidth = X ? 6 : 4.5; rc.lineCap = 'round'; rc.lineJoin = 'round';
    rc.beginPath(); rc.moveTo(ex, ey);
    rc.lineTo(CURVE.x, CURVE.y);
    const N = 140;
    for (let i = 1; i <= N; i++) { const p = this.curvePt((i / N) * u); rc.lineTo(p.x, p.y); }
    rc.stroke();
    const hp = this.curvePt(u);
    if (u > 0 && u < 0.999) { rc.fillStyle = RED(); rc.beginPath(); rc.arc(hp.x, hp.y, X ? 10 : 8, 0, TAU); rc.fill(); }
    rc.restore();
    // guides at 20/80 once passed
    if (u > 0.2) {
      const g = ease.outCubic(clamp((u - 0.2) / 0.12));
      const p = this.curvePt(0.2);
      c.save(); c.setLineDash([6, 6]); c.strokeStyle = fg(paper, 0.5); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(p.x, CURVE.y); c.lineTo(p.x, lerp(CURVE.y, p.y, g)); c.stroke();
      c.beginPath(); c.moveTo(CURVE.x, p.y); c.lineTo(lerp(CURVE.x, p.x, g), p.y); c.stroke();
      c.setLineDash([]);
      c.font = font(F.mono(500), 15); c.fillStyle = fg(paper, 0.8 * g); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillText('80%', CURVE.x - 52, p.y + 5);
      c.textAlign = 'center'; c.fillText('20%', p.x, CURVE.y + 26);
      c.restore();
      rc.save(); rc.fillStyle = RED(); rc.beginPath(); rc.arc(p.x, p.y, X ? 9 : 7, 0, TAU); rc.fill(); rc.restore();
    }
    // slope note at the launch
    {
      const a = clamp((t - this.tMath) / 0.3);
      c.save(); c.globalAlpha = a;
      c.font = font(F.mono(500), 14); c.fillStyle = fg(paper, 0.7); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillText('dy/dx at take-off = 7.21', CURVE.x + 26, CURVE.y + 6);
      c.fillText('(steep. mathematically.)', CURVE.x + 26, CURVE.y + 26);
      c.restore();
    }
    // "a mathematical" climbing beside the curve, "high" standing on the 100% line
    const ws = this.la.words.slice(this.beamXs.length);
    let x = CURVE.x + 120, y = CURVE.y - 0.4 * CURVE.h;
    for (const w of ws) {
      const isHigh = w === this.wHigh;
      const size = isHigh ? (X ? 270 : 240) : this.beamSize * 1.45;
      const ww = lay(w.w, this.fam, size).width;
      let wx = x, wy = y;
      if (isHigh) { wx = CURVE.x + 0.24 * CURVE.w - ww * 0.5; wy = BAR_Y - 34; }
      const vis = t >= this.tMath - 0.4;
      if (!vis) continue;
      const rise = isHigh ? ease.outBack(clamp((t - w.start) / 0.3), 2) : 1;
      const lift = isHigh ? (1 - rise) * 120 : 0;
      const pop = popAt(t, w.start, 0.22) * (isHigh ? 0 : 0.06);
      for (const [ctx, glow] of (X ? [[c, false], [rc, true]] : [[c, false]]) as [C2D, boolean][]) {
        ctx.save();
        ctx.translate(wx + ww / 2, wy + lift); ctx.scale(1 + pop, 1 + pop); ctx.translate(-ww / 2, 0);
        drawWord(ctx, w, t, 0, 0, this.style(paper, size, glow));
        ctx.restore();
      }
      if (!isHigh) { x += ww + size * 0.25; y -= 0; }
    }
  }

  // ------------------------------------------------------------------ the vinculum (runway) + 20/100
  private drawRunway(c: C2D, rc: C2D, t: number, paper: boolean) {
    const X = !paper;
    if (t < this.tHigh - 0.3) return;
    const x0 = CURVE.x + 0.5 * CURVE.w;
    const k = ease.outExpo(clamp((t - this.tHigh) / 0.8));
    const x1 = lerp(x0, x0 + 26000, k);
    c.save();
    c.fillStyle = fg(paper, 0.95);
    c.fillRect(x0, BAR_Y, x1 - x0, X ? 14 : 12);
    // runway marks
    c.fillStyle = X ? rgba('ink') : rgba('bone');
    for (let x = x0 + 120; x < x1; x += 160) c.fillRect(x, BAR_Y + (X ? 6 : 5), 70, 2);
    c.fillStyle = fg(paper, 0.7);
    c.font = font(F.mono(400), 12); c.textAlign = 'left'; c.textBaseline = 'top';
    for (let x = x0 + 40; x < x1; x += 640) c.fillText('ALT. 100% · CRUISING', x, BAR_Y + 26);
    c.restore();
    // runway lights: one in five lit
    for (let i = 0, x = x0 + 20; x < x1; x += 64, i++) {
      const lit = i % 5 === 0;
      const ctx = lit ? rc : c;
      ctx.fillStyle = lit ? RED() : fg(paper, 0.35);
      ctx.beginPath(); ctx.arc(x, BAR_Y + 64, lit ? 5 : 3, 0, TAU); ctx.fill();
    }
    // the fraction
    const fa = clamp((t - this.tHigh - 0.2) / 0.3);
    if (fa > 0) {
      const nx = CURVE.x + CURVE.w + 40 - 600;
      rc.save(); rc.globalAlpha = fa;
      rc.font = font(this.fam, X ? 360 : 330); rc.fillStyle = RED(); rc.textAlign = 'center'; rc.textBaseline = 'alphabetic';
      rc.fillText('20', nx, BAR_Y - 30);
      rc.restore();
      c.save(); c.globalAlpha = fa;
      c.font = font(this.fam, X ? 360 : 330); c.fillStyle = X ? rgba('ash', 0.9) : rgba('graphite', 0.9); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.fillText('100', nx, BAR_Y + 40 + 330 * CAP);
      c.font = font(F.mono(400), 14); c.fillStyle = fg(paper, 0.6); c.textAlign = 'left';
      c.fillText('vinculum (not to scale)', nx + 300, BAR_Y + 70);
      c.restore();
    }
    // the giant 20/100, passing under the camera in the instrumental gap (the vinculum is the horizon)
    {
      const tm = this.tFracEnd + 0.75;
      const gx = this.cam(tm).x;
      const S = X ? 700 : 640;
      if (t > this.tFracEnd - 1.2 && t < this.tWatch + 0.6) {
        rc.save();
        rc.font = font(this.fam, S); rc.fillStyle = RED(X ? 0.9 : 0.92); rc.textAlign = 'center'; rc.textBaseline = 'alphabetic';
        rc.fillText('20', gx, BAR_Y - 46);
        rc.restore();
        c.save();
        c.font = font(this.fam, S); c.fillStyle = X ? rgba('ash', 0.55) : rgba('graphite', 0.6); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
        c.fillText('100', gx, BAR_Y + 70 + S * CAP);
        c.font = font(F.mono(500), 16); c.fillStyle = fg(paper, 0.7); c.textAlign = 'left';
        c.fillText('20 / 100 = THE FRACTION (FIG. 7c, FLOWN OVER)', gx + S * 0.62, BAR_Y - 60);
        c.restore();
      }
    }
    // line B, first half, painted on the runway
    const bw = this.lb.words.slice(0, this.bXs.length);
    const a = clamp((t - this.tB0 + 0.4) / 0.25);
    if (a > 0) bw.forEach((w, i) => {
      const ww = lay(w.w, this.fam, this.bSize).width;
      const pop = popAt(t, w.start, 0.22) * (w.w.toLowerCase().startsWith('fraction') ? 0.12 : 0.05);
      for (const [ctx, glow] of (X ? [[c, false], [rc, true]] : [[c, false]]) as [C2D, boolean][]) {
        ctx.save();
        ctx.translate(this.bXs[i]! + ww / 2, BAR_Y - 14); ctx.scale(1 + pop, 1 + pop); ctx.translate(-ww / 2, 0);
        const st = this.style(paper, this.bSize, glow); st.alpha = a;
        drawWord(ctx, w, t, 0, 0, st);
        ctx.restore();
      }
    });
  }

  // ------------------------------------------------------------------ speed lines (the flight)
  private drawSpeed(c: C2D, rc: C2D, t: number, paper: boolean) {
    const X = !paper;
    if (t < this.tB0 - 0.3) return;
    const a = clamp((t - this.tB0 + 0.3) / 0.4) * (X ? 1 - smoothstep(this.tByEnd, this.tByEnd + 0.3, t) : 1);
    const v = X ? 2600 : 2000;
    const n = X ? 56 : 40;
    for (let i = 0; i < n; i++) {
      let y = 110 + hash(i, 1) * 860;
      if (y > 360 && y < 660) y = hash(i, 5) < 0.5 ? 360 - hash(i, 6) * 40 : 660 + hash(i, 6) * 40;
      const L = 60 + hash(i, 2) * 460;
      const spd = v * (0.45 + hash(i, 3));
      const span = 1920 + 2 * L;
      const x = 1920 + L - (((t * spd + hash(i, 4) * 5000) % span) + span) % span;
      const red = i % 5 === 0;
      const ctx = red ? rc : c;
      ctx.strokeStyle = red ? RED(0.75 * a) : fg(paper, (X ? 0.35 : 0.28) * a);
      ctx.lineWidth = red ? 1.6 : 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + L, y); ctx.stroke();
    }
  }

  // ------------------------------------------------------------------ clocks flying past
  private drawClock(c: C2D, rc: C2D, x: number, y: number, R: number, hands: number, paper: boolean, a: number, fill = false) {
    const X = !paper;
    c.save(); c.globalAlpha = a;
    c.translate(x, y);
    c.fillStyle = fill ? rgba('ink') : X ? rgba('ink2') : rgba('bone');
    c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
    c.strokeStyle = fill ? rgba('bone', 0.9) : fg(paper, 0.9); c.lineWidth = Math.max(1, R * 0.018);
    c.stroke();
    c.beginPath();
    for (let i = 0; i < 60; i++) {
      const an = (i / 60) * TAU, l = i % 5 === 0 ? 0.12 : 0.05;
      c.moveTo(Math.cos(an) * R * 0.92, Math.sin(an) * R * 0.92);
      c.lineTo(Math.cos(an) * R * (0.92 - l), Math.sin(an) * R * (0.92 - l));
    }
    c.lineWidth = Math.max(0.8, R * 0.01); c.stroke();
    // hands (the swallowing face loses them as it grows)
    c.globalAlpha = a * (fill ? 1 - smoothstep(250, 700, R) : 1);
    c.lineCap = 'round';
    const hA = hands / 12 - Math.PI / 2, mA = hands - Math.PI / 2;
    c.lineWidth = Math.max(1.5, R * 0.05);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(hA) * R * 0.5, Math.sin(hA) * R * 0.5); c.stroke();
    c.lineWidth = Math.max(1, R * 0.03);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(mA) * R * 0.78, Math.sin(mA) * R * 0.78); c.stroke();
    c.restore();
    // the red second hand: a fifth of the dial swept
    const ha = a * (fill ? 1 - smoothstep(250, 700, R) : 1);
    if (ha <= 0) return;
    rc.save(); rc.globalAlpha = ha; rc.translate(x, y);
    const sA = hands * 6 - Math.PI / 2;
    rc.fillStyle = RED(0.85);
    rc.beginPath(); rc.moveTo(0, 0); rc.arc(0, 0, R * 0.86, sA - TAU * 0.2, sA); rc.closePath(); rc.globalAlpha = ha * 0.22; rc.fill();
    rc.globalAlpha = ha;
    rc.strokeStyle = RED(); rc.lineWidth = Math.max(1, R * 0.015);
    rc.beginPath(); rc.moveTo(0, 0); rc.lineTo(Math.cos(sA) * R * 0.86, Math.sin(sA) * R * 0.86); rc.stroke();
    rc.restore();
  }
  private drawClocks(c: C2D, rc: C2D, t: number, paper: boolean) {
    const X = !paper;
    const life = X ? 1.3 : 1.6;
    // farthest first
    const live = this.clocks.filter((k) => t >= k.tb - 0.05 && t < k.tb + life).sort((p, q) => p.tb - q.tb);
    for (const k of live) {
      const age = t - k.tb;
      const s = 0.11 * Math.exp(age * (X ? 3.1 : 2.5)); // zoom-through
      const R = 260 * k.r * s;
      const d = 900 * s * (0.6 + k.r * 0.3);
      const x = 960 + Math.cos(k.a) * d, y = 540 + Math.sin(k.a) * d * 0.75;
      if (R > 2200) continue;
      const a = clamp(age / 0.08 + 0.3) * (1 - smoothstep(life * 0.8, life, age)) * this.dimOut;
      this.drawClock(c, rc, x, y, R, (t - this.tFracEnd) * k.spin * 6 + k.a * 5, paper, a);
    }
  }

  // ------------------------------------------------------------------ "watching time fly by!" (screen space, streaking)
  private drawStreakLine(c: C2D, gc: C2D, t: number, paper: boolean) {
    const X = !paper;
    const ws = this.lb.words.slice(this.lb.words.length - this.sXs.length);
    const t0 = ws[0]!.start - 0.4;
    if (t < t0) return;
    const kin = ease.outExpo(clamp((t - t0) / 0.3)) * this.dimOut;
    const y = 590;
    ws.forEach((w, i) => {
      const isBy = w === this.wBy;
      const ww = lay(w.w, this.fam, this.sSize).width;
      // held "by!": it stretches as the note is held
      const hold = isBy ? ease.outCubic(clamp((t - this.tBy) / Math.max(0.2, this.tByEnd - this.tBy))) : 0;
      const sx = 1 + (X ? 0.35 : 0.55) * hold;
      const pop = popAt(t, w.start, 0.25) * 0.08;
      const x = this.sXs[i]! + (1 - kin) * 60;
      // streaks: sung words leave fading copies behind them (time flies left)
      const sung = t >= w.start;
      const nS = sung ? (X ? 6 : 4) : 0;
      const speed = sung ? Math.exp(-(t - w.start) * 2.5) : 0;
      for (let s = nS; s >= 0; s--) {
        const off = s * (X ? 34 : 26) * (0.35 + speed);
        const al = s === 0 ? kin : 0.16 * (1 - s / (nS + 1)) * kin;
        for (const [ctx, glow] of (X ? [[c, false], [gc, true]] : [[c, false]]) as [C2D, boolean][]) {
          if (s > 0 && glow) continue;
          ctx.save();
          ctx.translate(x - off, y); ctx.scale(sx * (1 + pop), 1 + pop);
          const st = this.style(paper, this.sSize, glow); st.alpha = al;
          drawWord(ctx, w, t, 0, 0, st);
          ctx.restore();
        }
      }
      void ww;
    });
    // a deadpan caption
    const a = clamp((t - this.tWatch) / 0.3) * kin;
    c.save(); c.globalAlpha = a;
    c.font = font(F.mono(500), 15); c.fillStyle = fg(paper, 0.7); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText(`FIG. ${X ? '12b' : '7b'} — TIME, FLYING (n = ${this.clocks.length} clocks)`, 96, 140);
    c.fillText('each clock spends 80% of its dial on filler. red = the fifth that counts.', 96, 164);
    c.restore();
  }

  // ------------------------------------------------------------------ hand-offs
  /** n=1: the last clock's ink face swallows the frame (into the night of Camden). */
  private drawNightfall(c: C2D, t: number, tEnd: number) {
    const t0 = Math.max(this.tByEnd, tEnd - 0.75);
    if (t < t0) return;
    const k = clamp((t - t0) / (tEnd - 0.01 - t0));
    const R = 30 + 1150 * ease.inExpo(k);
    this.drawClock(c, c, 960, 540, R, (t - t0) * 40, true, 1, true);
  }
  /** n=2: the clock hands wind into a guilloché rosette, slowing into the bridge. */
  private drawRosette(c: C2D, gc: C2D, t: number, tEnd: number) {
    const t0 = this.tByEnd - 0.05;
    if (t < t0) return;
    const k = clamp((t - t0) / (tEnd - t0));
    const R = lerp(60, 640, ease.outCubic(k));
    const rot = 3.2 * ease.outCubic(k); // spins, then slows
    c.save(); c.translate(960, 540); c.rotate(rot);

    const N = 48;
    const reveal = ease.outCubic(clamp(k * 1.8));
    for (let j = 0; j < N; j++) {
      const red = j % 12 === 0;
      const ctx = red ? gc : c;
      if (red) { gc.save(); gc.translate(960, 540); gc.rotate(rot); }
      ctx.strokeStyle = red ? RED(0.7) : rgba('bone', 0.45);
      ctx.lineWidth = red ? 1.5 : 0.8;
      ctx.beginPath();
      const ph = (j / N) * TAU;
      const M = 420;
      for (let i = 0; i <= M * reveal; i++) {
        const a = (i / M) * TAU;
        const r = R * (0.7 + 0.16 * Math.cos(12 * a + ph) + 0.06 * Math.cos(30 * a - 2 * ph));
        const x = Math.cos(a + ph / 12) * r, y = Math.sin(a + ph / 12) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (red) gc.restore();
    }
    c.restore();
  }
}
