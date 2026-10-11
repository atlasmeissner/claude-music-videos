// PLATE I `open` — "Title page" (intro, 0 → first word of verse 1).
//   0 → first beat: the crop-mark frame on bone paper; the survey grid's hairlines rule in on the pickup.
//   Guitar alone (6 bars): the 100 cells of the census fill graphite one per 16th note, row by row, while
//   PARETO stamps in one letter per bar; the subtitle is written on bar 5; a red pen plots the Pareto
//   curve in FIG. 1 over bars 4–6.
//   Drums and bass enter with a fill (≈17.9 s): the 20 vital cells flip red, two per hit of the fill.
//   Full band (3 bars): the trivial many dim, the vital few pulse on the kicks, leader labels and a
//   share-of-meaning readout tick in; a fifth bar fills under the title.
//   Last bar: the title column slides off, the frame flies out and the fills drain cell by cell, leaving
//   the bare grid exactly where PLATE II (the flat's survey) picks it up (its 64 px plan at 1.22×).
//   The first frame (paper + crop marks) is also the outro's last frame: the video loops.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { F, font, layout, type TextLayout } from '../engine/type';
import { clamp, ease, lerp, prog, hash } from '../engine/util';
import { Ground, PAPER_POST, VITAL20, isVital, drawParetoCurve, drawFifthBar, footnote, fg, RED, type C2D } from './_kit';

// the flat's plan: top-left (168, 236), 64 px cells, shown at 1.22× about its centre (488, 556)
const PITCH = 64 * 1.22;
const GX = 488 + (168 - 488) * 1.22, GY = 556 + (236 - 556) * 1.22;
const COLX = 1010; // title column
const TITLE = 'PARETO';
const TFAM = F.archivo(125, 900);
let TSIZE = 196; // fitted to the column in init()

export default class Open extends Scene {
  g = new Ground();
  L = new Layer2D();
  B: number[] = []; // beats from the first beat
  D: number[] = []; // downbeats in the window
  tB0 = 0; tDrums = 0; tBand = 0; tOut = 0; tEnd = 0;
  fill: number[] = []; // time each cell fills (graphite)
  flip: number[] = []; // time each vital cell turns red
  drain: number[] = []; // time each cell empties in the last bar
  tLay!: TextLayout;

  override init() {
    const { audio, start, end } = this.ctx;
    this.tEnd = end;
    const b0 = Math.max(0, Math.ceil(audio.beatAt(start + 0.5) - 1e-3));
    for (let k = 0; k < 48; k++) { const t = audio.timeOfBeat(b0 + k); if (t < end + 0.01) this.B.push(t); }
    this.tB0 = this.B[0]!;
    this.D = audio.downbeats.filter((d) => d >= start - 0.01 && d < end - 0.05);
    // drums enter: the first kick of the song
    const k0 = audio.onsets.kick?.[0]?.[0] ?? this.D[6] ?? lerp(start, end, 0.65);
    this.tDrums = this.D.reduce((b, d) => (Math.abs(d - k0) < Math.abs(b - k0) ? d : b), this.D[0]!);
    // band in properly after the fill: the next downbeat
    this.tBand = this.D.find((d) => d > this.tDrums + 1) ?? this.tDrums + 2.5;
    this.tOut = this.D[this.D.length - 1]!; // the last bar
    // fills: one cell per 16th from the first beat to the drums, row-major
    const n16 = (this.tDrums - this.tB0) / 100;
    for (let i = 0; i < 100; i++) this.fill.push(this.tB0 + i * n16);
    // flips: two per kick of the fill (kicks in [tDrums - 0.1, tDrums + 1.6]), else spread over the bar
    const kicks = (audio.onsets.kick ?? []).map((k) => k[0]).filter((t) => t >= this.tDrums - 0.1 && t < this.tDrums + 1.6);
    const order = [...VITAL20].sort((a, b) => hash(a, 3) - hash(b, 3));
    order.forEach((cell, j) => {
      const k = kicks.length >= 10 ? kicks[Math.floor(j / 2)]! : lerp(this.tDrums, this.tDrums + 1.4, j / 19);
      this.flip[cell] = k + (j % 2) * 0.03;
    });
    // drain: grey cells reverse row-major over the last bar's first 3 beats, red cells on the last beat
    const beatsOut = this.B.filter((t) => t >= this.tOut - 0.01 && t < end - 0.2);
    const tLast = beatsOut[beatsOut.length - 1] ?? end - 0.6;
    const greys = Array.from({ length: 100 }, (_, i) => 99 - i).filter((i) => !isVital(i));
    greys.forEach((cell, j) => (this.drain[cell] = lerp(this.tOut + 0.05, tLast - 0.05, j / greys.length)));
    VITAL20.forEach((cell, j) => (this.drain[cell] = tLast + j * 0.012));
    TSIZE = 196;
    this.tLay = layout(TITLE, TFAM, TSIZE, -2);
    if (this.tLay.width > 800) { TSIZE = Math.floor(TSIZE * 800 / this.tLay.width); this.tLay = layout(TITLE, TFAM, TSIZE, -2); }
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    this.g.render(renderer, out, { paper: 1, grid: 16, gridA: 0.07, vig: 0.22 });
    const c = this.L.ctx; this.L.clear();

    const outK = prog(t, this.tOut, this.tOut + 0.55, ease.inOutCubic); // column leaves
    this.drawGrid(c, t);
    c.save();
    c.translate(outK * 1000, 0);
    c.globalAlpha = 1 - outK * 0.5;
    this.drawColumn(c, t);
    c.restore();

    comp.draw(renderer, this.L.upload(), out);

    // crop-mark frame: in from the start (the loop point), flies out with the column
    const frame = 1 - prog(t, this.tOut + 0.25, this.tEnd - 0.1, ease.inCubic);
    // punches: each title letter, and the vital flips
    let punch = 0;
    for (let i = 0; i < TITLE.length; i++) { const d = this.D[i]; if (d !== undefined && t >= d) punch = Math.max(punch, Math.exp(-(t - d) * 9)); }
    if (t >= this.tDrums) punch = Math.max(punch, f.a.kick * 0.8 * (t < this.tOut ? 1 : 0));
    return { ...PAPER_POST, frame, zoom: 1 + 0.012 * punch, hud: 1 };
  }

  // ------------------------------------------------------------ the census grid
  drawGrid(c: C2D, t: number) {
    const B = this.B;
    // hairlines rule in on the pickup (the 4 beats before the first beat, extrapolated)
    const per = B.length > 1 ? B[1]! - B[0]! : 0.62;
    const r0 = this.tB0 - per * 3.2;
    c.save();
    c.lineWidth = 1;
    const endA = 0.11 + 0.17 * (1 - prog(t, this.tOut, this.tEnd - 0.2)); // fade to the flat's opening alpha
    for (let i = 0; i <= 10; i++) {
      const kv = prog(t, r0 + i * per * 0.08, r0 + i * per * 0.08 + per * 1.6, ease.outExpo);
      const kh = prog(t, r0 + 0.3 + i * per * 0.08, r0 + 0.3 + i * per * 0.08 + per * 1.6, ease.outExpo);
      c.strokeStyle = fg(true, endA + 0.12 * (1 - prog(t, this.tOut, this.tEnd - 0.2)));
      if (kv > 0) { c.beginPath(); c.moveTo(GX + i * PITCH, GY); c.lineTo(GX + i * PITCH, GY + 10 * PITCH * kv); c.stroke(); }
      if (kh > 0) { c.beginPath(); c.moveTo(GX, GY + i * PITCH); c.lineTo(GX + 10 * PITCH * kh, GY + i * PITCH); c.stroke(); }
    }
    // coordinates (the survey's), typed in with the lines
    const ck = prog(t, r0 + per * 1.2, r0 + per * 2.4) * (1 - prog(t, this.tOut, this.tEnd - 0.15));
    if (ck > 0) {
      c.font = font(F.mono(500), 13); c.fillStyle = fg(true, 0.5 * ck); c.textAlign = 'center';
      for (let i = 0; i < 10; i++) {
        c.fillText('ABCDEFGHIJ'[i]!, GX + (i + 0.5) * PITCH, GY - 18);
        c.textAlign = 'right'; c.fillText(String(i + 1), GX - 14, GY + (i + 0.5) * PITCH + 5); c.textAlign = 'center';
      }
      c.textAlign = 'left';
    }
    // cells
    const dimMany = prog(t, this.tBand, this.tBand + 0.4, ease.outExpo) * (1 - prog(t, this.tOut, this.tOut + 0.3));
    const kick = this.ctx.audio.hit('kick', t, 0.1);
    const inset = 7;
    for (let i = 0; i < 100; i++) {
      const tf = this.fill[i]!;
      if (t < tf) continue;
      const td = this.drain[i]!;
      const dk = prog(t, td, td + 0.12, ease.inCubic);
      if (dk >= 1) continue;
      const pop = ease.outBack(prog(t, tf, tf + 0.14));
      const vital = isVital(i) && t >= this.flip[i]!;
      let sc = (0.55 + 0.45 * pop) * (1 - dk);
      if (vital) {
        const fp = prog(t, this.flip[i]!, this.flip[i]! + 0.16, ease.outExpo);
        sc *= 1 + 0.25 * (1 - fp) + (t >= this.tBand && t < this.tOut ? 0.08 * kick : 0);
      }
      const x = GX + (i % 10) * PITCH, y = GY + Math.floor(i / 10) * PITCH;
      const s = (PITCH - inset * 2) * sc, o = (PITCH - s) / 2;
      c.fillStyle = vital ? RED() : fg(true, lerp(0.78, 0.3, dimMany));
      c.fillRect(x + o, y + o, s, s);
    }
    // the cell being counted: a tiny mono tally under the grid
    const counted = this.fill.filter((x) => t >= x).length;
    const reds = VITAL20.filter((i) => t >= this.flip[i]!).length;
    const tk = (t >= this.tB0 ? 1 : 0) * (1 - prog(t, this.tOut, this.tOut + 0.3));
    if (tk > 0) {
      c.font = font(F.mono(500), 15); c.fillStyle = fg(true, 0.7 * tk);
      const yy = GY + 10 * PITCH + 34;
      c.fillText(`CENSUS  ${String(counted).padStart(3, '0')} / 100`, GX, yy);
      if (reds > 0) { c.fillStyle = RED(tk); c.fillText(`VITAL  ${String(reds).padStart(2, '0')}`, GX + 260, yy); }
      if (t >= this.tBand) {
        const sh = clamp((t - this.tBand) / 1.2);
        const v = (80 * ease.outExpo(sh)).toFixed(1);
        c.fillStyle = fg(true, 0.7 * tk); c.textAlign = 'right';
        c.fillText(`SHARE OF MEANING  ${v}%`, GX + 10 * PITCH, yy); c.textAlign = 'left';
      }
    }
    // leader labels on the band's downbeats
    if (t >= this.tBand && t < this.tOut + 0.3) {
      const la = 1 - prog(t, this.tOut, this.tOut + 0.3);
      const D2 = this.D.filter((d) => d >= this.tBand);
      this.leader(c, t, D2[0] ?? this.tBand, 23, 'THE TRIVIAL MANY · 80', false, la);
      this.leader(c, t, (D2[1] ?? this.tBand + 2.5) - 1.24, VITAL20[VITAL20.length - 3]!, 'THE VITAL FEW · 20', true, la);
    }
    c.restore();
  }

  /** A hairline leader from a cell out to the right edge of the grid with a mono label. */
  leader(c: C2D, t: number, t0: number, cell: number, label: string, red: boolean, a: number) {
    const k = prog(t, t0, t0 + 0.35, ease.outExpo);
    if (k <= 0) return;
    const cx = GX + (cell % 10 + 0.5) * PITCH, cy = GY + (Math.floor(cell / 10) + 0.5) * PITCH;
    const ex = GX + 10 * PITCH + 34;
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = red ? RED() : fg(true, 0.75); c.lineWidth = 1.2;
    c.beginPath(); c.arc(cx, cy, 5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(cx + 5, cy); c.lineTo(lerp(cx + 5, ex, k), cy); c.stroke();
    c.font = font(F.mono(600), 15); c.fillStyle = red ? RED() : fg(true, 0.85);
    const n = Math.floor(label.length * clamp(k * 1.5));
    c.fillText(label.slice(0, n), ex + 8, cy + 5);
    c.restore();
  }

  // ------------------------------------------------------------ the title column
  drawColumn(c: C2D, t: number) {
    const D = this.D;
    const start = this.ctx.start;
    // eyebrow (types in on the pickup)
    const ek = prog(t, start + 0.4, start + 1.6);
    c.font = font(F.mono(500), 15); c.fillStyle = fg(true, 0.7);
    const eb = 'AN ALMANAC OF THE VITAL FEW  ·  VOL. I  ·  PLATE I';
    c.fillText(eb.slice(0, Math.floor(eb.length * ek)), COLX, 238);
    c.strokeStyle = fg(true, 0.45); c.lineWidth = 1;
    c.beginPath(); c.moveTo(COLX, 256); c.lineTo(lerp(COLX, 1824, ease.outExpo(ek)), 256); c.stroke();

    // PARETO: one letter per bar, slammed
    const by = 452;
    c.font = font(TFAM, TSIZE); c.textBaseline = 'alphabetic';
    for (const g of this.tLay.glyphs) {
      const d = D[g.i];
      if (d === undefined || t < d - 0.02) {
        // ghost of the letter to come (appears with the eyebrow: the first frame is bare paper, the loop point)
        c.fillStyle = fg(true, 0.06 * ek); c.fillText(g.ch, COLX + g.x, by);
        continue;
      }
      const k = prog(t, d - 0.02, d + 0.2, ease.outExpo);
      const s = lerp(1.45, 1, k);
      const red = g.i === TITLE.length - 1 && t >= this.tDrums; // the last letter: 1 of 6 ≈ the vital fifth (near enough)
      c.save();
      c.translate(COLX + g.x + g.w / 2, by); c.scale(s, s); c.translate(-(COLX + g.x + g.w / 2), -by);
      c.globalAlpha = k;
      c.fillStyle = red ? RED() : fg(true);
      c.fillText(g.ch, COLX + g.x, by);
      c.restore();
    }
    // fifth bar under the title (fills on the band)
    if (t >= this.tDrums) {
      const fk = prog(t, this.tBand - 0.05, this.tBand + 0.5, ease.outExpo);
      drawFifthBar(c, COLX, by + 34, this.tLay.width, 14, { fill: fk, split: prog(t, this.tBand + 0.3, this.tBand + 0.8), labels: false });
    } else {
      c.strokeStyle = fg(true, 0.5); c.lineWidth = 1;
      c.beginPath(); c.moveTo(COLX, by + 41); c.lineTo(COLX + this.tLay.width * prog(t, D[0]!, D[5] ?? D[0]! + 12), by + 41); c.stroke();
    }

    // subtitle: written in over bar 5 (a clip wipe with a pen nib)
    const s0 = D[4] ?? start + 10, s1 = (D[5] ?? s0 + 2.5) + 1.2;
    const sk = prog(t, s0, s1, ease.inOutQuad);
    if (sk > 0) {
      const sub = 'On the Distribution of Things That Matter';
      const sf = F.serif(400, true);
      c.font = font(sf, 50);
      const w = c.measureText(sub).width;
      c.save();
      c.beginPath(); c.rect(COLX - 4, by + 60, (w + 8) * sk, 80); c.clip();
      c.fillStyle = fg(true, 0.9); c.fillText(sub, COLX, by + 118);
      c.restore();
      if (sk < 1) { c.fillStyle = RED(); c.fillRect(COLX + w * sk, by + 84, 3, 40); }
    }

    // FIG. 1: the Pareto curve, plotted over bars 4–6
    const fx = COLX + 58, fy = 930, fw = 470, fh = 250;
    const ak = prog(t, D[3] ?? start + 9, (D[3] ?? start + 9) + 0.6, ease.outExpo);
    if (ak > 0) {
      c.save();
      c.strokeStyle = fg(true, 0.8); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(fx, fy - fh * ak - 10); c.lineTo(fx, fy); c.lineTo(fx + (fw + 10) * ak, fy); c.stroke();
      // ticks
      c.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        const x = fx + (fw * i) / 5, y = fy - (fh * i) / 5;
        if (i / 5 <= ak) { c.beginPath(); c.moveTo(x, fy); c.lineTo(x, fy + 6); c.moveTo(fx - 6, y); c.lineTo(fx, y); c.stroke(); }
      }
      c.font = font(F.mono(500), 13); c.fillStyle = fg(true, 0.65 * ak);
      c.fillText('CAUSES →', fx + fw - 70, fy + 48);
      c.save(); c.translate(fx - 24, fy - 24); c.rotate(-Math.PI / 2); c.fillText('EFFECTS →', 0, 0); c.restore();
      c.fillText('FIG. 1', fx, fy - fh - 30);
      c.restore();
      const pk = prog(t, (D[3] ?? 0) + 0.6, this.tDrums - 0.05, ease.inOutCubic);
      const pen = drawParetoCurve(c, fx, fy, fw, fh, pk, { paper: true, lw: 3 });
      if (pk > 0 && pk < 1) { c.fillStyle = RED(); c.beginPath(); c.arc(pen.x, pen.y, 5, 0, Math.PI * 2); c.fill(); }
    }
    // the fig. 1 key (right of the chart)
    const kk = prog(t, this.tDrums + 0.2, this.tDrums + 1.4);
    if (kk > 0) {
      const lines = ['100 squares.', '20 of them matter.', 'Which 20 is', 'the whole question.'];
      c.font = font(F.mono(400), 16);
      lines.forEach((l, i) => {
        const a = clamp(kk * 4 - i);
        c.fillStyle = i === 1 ? RED(a) : fg(true, 0.75 * a);
        c.fillText(l, fx + fw + 70, fy - fh + 40 + i * 28);
      });
    }
    // credit, bottom right
    const ck = prog(t, (D[1] ?? start + 4), (D[1] ?? start + 4) + 1);
    if (ck > 0) {
      c.font = font(F.mono(500), 14); c.fillStyle = fg(true, 0.6 * ck); c.textAlign = 'right';
      c.fillText('A SONG BY JOBURGALEX', 1824, 1010);
      c.textAlign = 'left';
      footnote(c, '¹ The census is exact. The 20 were chosen by hash; nature uses other methods.', COLX, 1010, { a: kk });
    }
  }
}
