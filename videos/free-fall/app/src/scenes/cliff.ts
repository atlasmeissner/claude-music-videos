// cliff — verse 1b: "But the cliff is only shoulder-high / And the sky is screaming blue".
// A. Engraved elevation (Neufert-style): the cliff in hatched section, a levelling staff at its foot, and an
//    anthropometric outline beside it. On "shoulder-high" a witness line runs from the outline's shoulder to the
//    cliff top: dead level. 1.40 m. Stamped.
// B. The sky, measured: a spectrometer plate. The trace draws itself across the visible spectrum on "the sky is",
//    spikes at 470 nm on "screaming" and keeps climbing out of the chart while "blue" is held (dB readout). It is
//    drawn in orange: this video has no blue (deadpan footnote).
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, clearRT, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, noise1, prog, pulse } from '../engine/util';
import { drawFigure, drawKaraoke, mono, POSES, sparkHead, wordColor } from './_ff';
import { stamp } from './ledger-kit';

const GY = 910, M = 271; // ground y, px per metre
const TOP = GY - 1.4 * M; // cliff top = shoulder height
const CL = 760; // cliff edge x

export default class Cliff extends Scene {
  L = new Layer2D();
  lb = new LineBatch(800);
  l2!: Line; l3!: Line;
  tB = 0;

  override init() {
    const { lyrics, audio } = this.ctx;
    this.l2 = lyrics.lines[2]!; this.l3 = lyrics.lines[3]!;
    this.tB = audio.timeOfBeat(Math.floor(audio.beatAt(this.l3.words[0]!.start + 0.05)));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.ink);
    const L = this.L, c = L.ctx; L.clear();
    const lb = this.lb; lb.clear();
    let hit = 0;
    if (t < this.tB) hit = this.elevation(c, lb, t);
    else hit = this.spectrum(c, lb, t);
    comp.draw(renderer, L.upload(), out);
    lb.render(renderer, out);
    const sh = hit * 9;
    return { bloom: 0.65, vignette: 0.4, shake: [(hash(frameIdx(t), 1) - 0.5) * sh, (hash(frameIdx(t), 2) - 0.5) * sh] as [number, number], zoom: 1 + hit * 0.01 };
  }

  // ------------------------------------------------------------------ A
  elevation(c: CanvasRenderingContext2D, lb: LineBatch, t: number) {
    const s0 = this.ctx.start, w = this.l2.words;
    const k = prog(t, s0, s0 + 0.6, ease.outCubic);
    // slow push in
    const z = 1 + 0.04 * prog(t, s0, this.tB);
    c.save(); c.translate(W / 2, 600); c.scale(z, z); c.translate(-W / 2, -600);
    // the cliff: a rough top edge and face, hatched section
    const edge = (y: number) => CL + (noise1(y * 0.03, 4) - 0.5) * 26 + (y - TOP) * 0.06;
    c.save();
    c.beginPath();
    c.moveTo(-50, TOP + (noise1(0, 2) - 0.5) * 4);
    for (let x = -50; x <= CL; x += 10) c.lineTo(x, TOP + (noise1(x * 0.02, 2) - 0.5) * 6);
    for (let y = TOP; y <= GY; y += 8) c.lineTo(edge(y), y);
    c.lineTo(-50, GY); c.closePath();
    c.fillStyle = rgba('ink2', 1); c.fill();
    c.clip();
    // strata (engraved): wavy near-horizontal lines, denser toward the face
    c.strokeStyle = rgba('graphite', 0.9); c.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const y0 = TOP + 8 + i * 10;
      if (i > 40 * k) break;
      c.beginPath();
      for (let x = -50; x <= CL + 40; x += 14) {
        const y = y0 + (noise1(x * 0.01 + i * 3.1, 9) - 0.5) * 12;
        if (x === -50) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    // face shading: short vertical hatches near the face
    c.strokeStyle = rgba('ash', 0.35);
    for (let y = TOP; y < GY; y += 7) {
      const x = edge(y);
      const n = 3 + Math.floor(hash(Math.round(y), 3) * 4);
      for (let j = 0; j < n; j++) { const xx = x - 6 - j * 7; c.beginPath(); c.moveTo(xx, y); c.lineTo(xx - 2, y + 6); c.stroke(); }
    }
    c.restore();
    c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 2;
    c.beginPath();
    for (let x = -50; x <= CL; x += 10) { const y = TOP + (noise1(x * 0.02, 2) - 0.5) * 6; if (x === -50) c.moveTo(x, y); else c.lineTo(x, y); }
    for (let y = TOP; y <= GY; y += 8) c.lineTo(edge(y), y);
    c.stroke();
    // the ground
    c.beginPath(); c.moveTo(CL - 20, GY); c.lineTo(W + 50, GY); c.stroke();
    c.save(); c.beginPath(); c.rect(-50, GY, W + 100, 200); c.clip();
    c.strokeStyle = rgba('graphite', 0.7); c.lineWidth = 1;
    for (let x = -100; x < W + 300; x += 13) { c.beginPath(); c.moveTo(x, GY); c.lineTo(x - 160, GY + 160); c.stroke(); }
    c.restore();
    // the levelling staff: 10 cm blocks alternating, metre numerals
    const SX = 930, sk = prog(t, w[1]!.start, w[2]!.start + 0.2, ease.outCubic);
    const sh = 1.8 * M * sk;
    c.save(); c.beginPath(); c.rect(SX, GY - sh, 44, sh); c.clip();
    for (let i = 0; i < 18; i++) {
      const y = GY - (i + 1) * 0.1 * M;
      c.fillStyle = i % 2 ? rgba('bone', 0.92) : rgba('signal', 0.95);
      c.fillRect(SX + (i % 2 ? 0 : 22), y, 22, 0.1 * M);
    }
    c.restore();
    c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 1.2; c.strokeRect(SX, GY - sh, 44, sh);
    for (let m = 0.5; m <= 1.5; m += 0.5) if (m * M < sh) mono(c, `${m.toFixed(1)}`, SX + 54, GY - m * M + 5, { size: 13, color: rgba('ash', 0.85), track: 1 });
    // the anthropometric outline (Neufert-style): the sign pictogram, outlined
    const fx = 1230, S = 1.75 * M, hipY = GY - 0.53 * S;
    const fk = prog(t, w[2]!.start, w[2]!.start + 0.4, ease.outCubic);
    if (fk > 0) {
      c.save(); c.globalAlpha = fk;
      drawFigure(c, fx, hipY, S, POSES.stand, { color: rgba('bone', 0.95) });
      drawFigure(c, fx, hipY, S * 0.985, POSES.stand, { color: rgba('ink', 1) }); // hollow it: hairline outline
      c.restore();
      mono(c, 'ADULT, 50TH PCT · 1.75 m', fx + 120, GY - S + 30, { size: 13, color: rgba('ash', 0.85), track: 2 });
    }
    // the witness line: shoulder → cliff top, on "shoulder-high"
    const wsh = w[5]!;
    const wl = prog(t, wsh.start - 0.05, wsh.start + 0.35, ease.inOutCubic);
    if (wl > 0) {
      c.save(); c.setLineDash([10, 7]); c.strokeStyle = rgba('signal', 1); c.lineWidth = 2;
      const x0 = fx - 40, x1 = lerp(x0, CL - 60, wl);
      c.beginPath(); c.moveTo(x0, TOP); c.lineTo(x1, TOP); c.stroke(); c.restore();
      c.fillStyle = rgba('signal', 1);
      c.beginPath(); c.arc(fx - 30, TOP, 6, 0, Math.PI * 2); c.fill();
      // vertical dimension at the face
      const dx = CL + 70;
      c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(dx, TOP); c.lineTo(dx, TOP + (GY - TOP) * wl); c.stroke();
      if (wl >= 1) {
        for (const [y, d] of [[TOP, 1], [GY, -1]] as const) { c.beginPath(); c.moveTo(dx, y); c.lineTo(dx - 6, y + d * 14); c.lineTo(dx + 6, y + d * 14); c.closePath(); c.fillStyle = rgba('bone', 0.9); c.fill(); }
        mono(c, '1.40 m', dx + 14, (TOP + GY) / 2 + 6, { size: 22, color: rgba('bone', 1), track: 2, weight: 500 });
      }
    }
    c.restore();
    stamp(c, 470, 820, ['SHOULDER-HIGH', 'VERIFIED'], t, wsh.start + 0.45, { size: 26, rot: -0.08 });
    // the lyric
    drawKaraoke(c, this.l2, 104, 230, t, { family: F.archivo(112.5, 900), size: 96, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.2), active: rgba('signal', 1), lead: 0.4 });
    mono(c, 'ELEVATION · SECTION A–A · 1:20', 104, 96, { size: 13, color: rgba('ash', 0.75), track: 4 });
    void lb;
    return pulse(t, wsh.start + 0.45, 0.08) * 0.8;
  }

  // ------------------------------------------------------------------ B
  spectrum(c: CanvasRenderingContext2D, lb: LineBatch, t: number) {
    const w = this.l3.words;
    const X0 = 150, X1 = 1770, Y0 = 470, Y1 = 930;
    const lam0 = 380, lam1 = 750;
    const xOf = (l: number) => X0 + ((l - lam0) / (lam1 - lam0)) * (X1 - X0);
    const k0 = prog(t, this.tB, this.tB + 0.4, ease.outCubic);
    // frame + ticks + band names (no colour: the bands are words)
    c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(X0, Y0); c.lineTo(X0, Y1); c.lineTo(X0 + (X1 - X0) * k0, Y1); c.stroke();
    c.strokeStyle = rgba('graphite', 0.8); c.lineWidth = 1;
    c.beginPath(); c.moveTo(X0, Y0); c.lineTo(X0 + (X1 - X0) * k0, Y0); c.stroke();
    for (let l = 400; l <= 740; l += 20) {
      const x = xOf(l);
      if (x > X0 + (X1 - X0) * k0) break;
      c.strokeStyle = rgba('bone', 0.7);
      c.beginPath(); c.moveTo(x, Y1); c.lineTo(x, Y1 + (l % 100 === 0 ? 14 : 7)); c.stroke();
      if (l % 100 === 0) mono(c, `${l}`, x, Y1 + 34, { size: 13, color: rgba('ash', 0.85), track: 1, align: 'center' });
    }
    mono(c, 'λ (nm)', X1, Y1 + 34, { size: 13, color: rgba('ash', 0.85), track: 2, align: 'right' });
    const bands: [string, number][] = [['VIOLET', 410], ['BLUE', 470], ['CYAN', 495], ['GREEN', 530], ['YELLOW', 580], ['ORANGE', 610], ['RED', 680]];
    for (const [n, l] of bands) mono(c, n, xOf(l), Y1 - 14, { size: 11, color: rgba('graphite', 1), track: 3, align: 'center' });
    // the trace: draws across on "sky is"; the 470 nm spike grows on "screaming" and leaves the chart on "blue"
    const draw = prog(t, w[2]!.start - 0.1, w[4]!.start, ease.inOutCubic);
    const scream = prog(t, w[4]!.start, w[5]!.start + 0.1, ease.inQuad);
    const blue = w[5]!;
    const over = prog(t, blue.start, Math.max(blue.end, blue.start + 0.4) + 0.6, ease.outCubic);
    const peak = lerp(0.25, 0.92, scream) + over * 1.15; // fraction of chart height (>1: off the chart)
    const yOf = (l: number) => {
      const base = 0.08 + 0.05 * Math.sin(l * 0.05) + 0.03 * (hash(Math.round(l), 7) - 0.5);
      const sky = 0.22 * Math.exp(-(((l - 450) / 90) ** 2));
      const spike = peak * Math.exp(-(((l - 470) / (8 + 6 * (1 - scream))) ** 2));
      return Y1 - (Y1 - Y0) * (base + sky + spike);
    };
    c.save();
    c.strokeStyle = rgba('signal', 1); c.lineWidth = 2.6; c.lineJoin = 'round';
    c.beginPath();
    const lEnd = lerp(lam0, lam1, draw);
    for (let l = lam0; l <= lEnd; l += 1.5) { const x = xOf(l), y = yOf(l); if (l === lam0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.stroke();
    c.restore();
    // the peak, labelled; dB readout
    if (scream > 0) {
      const px = xOf(470), py = Math.max(-40, yOf(470));
      c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 1;
      const ly = Math.max(py, Y0 + 40);
      c.beginPath(); c.moveTo(px + 10, ly); c.lineTo(px + 120, ly + 30); c.stroke();
      mono(c, 'BLUE · λ ≈ 470 nm', px + 128, ly + 36, { size: 15, color: rgba('bone', 1), track: 2, weight: 500 });
      const db = Math.round(lerp(60, 140, scream) + over * 60);
      mono(c, `INTENSITY ${db} dB${over > 0.2 ? ' (SCREAMING)' : ''}`, px + 128, ly + 62, { size: 15, color: rgba('signal', 1), track: 2, weight: 500 });
      if (py < Y0) { // a spark on the tip once it pierces the chart
        sparkHead(lb, px, Math.max(py, 8), t, 0.8, 1);
      }
    }
    mono(c, 'FIG. — THE SKY, MEASURED (SPECTROMETER)', 104, 96, { size: 13, color: rgba('ash', 0.75), track: 4 });
    mono(c, '* plotted in orange: this video has no blue.', X1, Y1 + 70, { size: 13, color: rgba('ash', 0.7 * prog(t, blue.start + 0.4, blue.start + 0.8)), track: 1, align: 'right' });
    // the lyric: "And the sky is screaming" + BLUE stretched wide while held
    const fam = F.archivo(112.5, 900), size = 96;
    const sub: Line = { ...this.l3, words: w.slice(0, 5), text: w.slice(0, 5).map((x) => x.w).join(' '), end: w[4]!.end };
    const wd = drawKaraoke(c, sub, 104, 230, t, { family: fam, size, tracking: -2, sung: rgba('bone', 1), unsung: rgba('bone', 0.2), active: rgba('signal', 1), lead: 0.4 });
    if (t > this.l3.start - 0.4) {
      const hold = prog(t, blue.start, blue.start + 0.5, ease.outBack);
      c.save();
      c.font = font(F.archivo(125, 900), size * 1.25); c.letterSpacing = `${lerp(-2, 60, clamp(hold))}px`;
      c.fillStyle = t < blue.start ? rgba('bone', 0.2) : wordColor(blue, t, rgba('bone', 1), rgba('signal', 1));
      void wd;
      c.translate(104, 370);
      c.scale(1 + 0.3 * hold, 1 + 0.3 * hold);
      c.fillText(blue.w.toUpperCase(), 0, 0);
      c.restore();
    }
    return pulse(t, w[4]!.start, 0.08) * 0.6 + pulse(t, blue.start, 0.12) * 1.2 + over * 0.15 * (0.5 + 0.5 * Math.sin(t * 80));
  }
}
