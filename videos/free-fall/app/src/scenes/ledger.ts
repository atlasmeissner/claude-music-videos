// ledger — verse 1a: "They said count the cost before you leap / Measure twice and think it through".
// Bone paper (an engineer's sheet). Left: an adding machine prints the cost of leaping onto its tape, one line
// item per sung word (PRIDE, 2 MIN OF TIME, ONE POLITE “NO”, A BRUISE…), the tape advancing a row each time;
// on the downbeat it prints the TOTAL in red: €0.18. Right: the lyric, big, word by word; under it the running
// total; then an elevation of the edge draws itself in and the drop is measured — on "Measure" (1.40 m) and
// again on "twice" (1.40 m) — and on "think it through" the arithmetic is worked: (1.40 + 1.40) ÷ 2 = 1.40 m,
// CHECKED TWICE.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, hash, prog, pulse } from '../engine/util';
import { drawFigure, HIP, mixCss, mixPose, mono, POSES } from './_ff';
import { dimV, karaokeRows, stamp, witness } from './ledger-kit';

// ---- the tape
const TX = 140, TW = 500, SLOT = 872, ROW = 50;
const PRINT = SLOT - 22; // baseline of the row under the print head

type Row = { t: number; text: string; amt?: string; kind: 'head' | 'sub' | 'rule' | 'item' | 'total' | 'meas' | 'up'; add?: number };
const ITEMS: [string, string, number][] = [
  ['PRIDE, SLIGHTLY', '0.04 +', 0.04],
  ['2 MIN OF TIME', '0.02 +', 0.02],
  ['ONE POLITE “NO”', '0.00 +', 0.0],
  ['A BRUISE', '0.05 +', 0.05],
  ['RAISED EYEBROW × 1', '0.01 +', 0.01],
  ['GRASS STAINS', '0.03 +', 0.03],
  ['AWKWARD SILENCE', '0.01 +', 0.01],
  ['A STUMBLE', '0.02 +', 0.02],
];

// ---- the elevation (right)
const EX0 = 720, EDGE = 1290, UP = 742, FS = 180; // upper ground y, scale-figure height
const DROP = 0.82 * FS; // 1.40 m: the figure's shoulder height (drawn to scale)
const LOW = UP + DROP;
const D1 = 1400, D2 = 1590; // the two dimension lines
const LX = 712; // lyric lane x

export default class Ledger extends Scene {
  L = new Layer2D();
  rows: Row[] = [];
  l0!: Line;
  l1!: Line;
  tRule = 27.367;
  tTotal = 27.784;
  tStamp = 30.709;

  override init() {
    const ly = this.ctx.lyrics, au = this.ctx.audio;
    this.l0 = ly.lines[0]!;
    this.l1 = ly.lines[1]!;
    const s = this.ctx.start;
    // the beat after line 0 ends, and the downbeat after that; the stamp on the last beat before the cut
    const beats = au.beats;
    const after = (x: number) => beats.find((b) => b > x + 0.05) ?? x + 0.4;
    this.tRule = after(this.l0.end);
    this.tTotal = au.downbeats.find((d) => d > this.tRule - 0.05) ?? this.tRule + 0.42;
    this.tStamp = [...beats].reverse().find((b) => b < this.ctx.end - 0.3) ?? this.ctx.end - 0.42;
    const R: Row[] = [
      { t: -1, kind: 'rule', text: '' },
      { t: -1, kind: 'item', text: 'CLEAR', amt: '0.00 C', add: 0 },
      { t: -1, kind: 'rule', text: '' },
      { t: -1, kind: 'head', text: 'COST OF LEAPING' },
      { t: -1, kind: 'sub', text: 'ITEMISED · SITE 01 · EUR' },
      { t: -1, kind: 'rule', text: '' },
    ];
    this.l0.words.forEach((w, i) => {
      const it = ITEMS[i]!;
      R.push({ t: Math.max(w.start, s + 0.02), kind: 'item', text: it[0], amt: it[1], add: it[2] });
    });
    R.push({ t: this.tRule, kind: 'rule', text: '' });
    R.push({ t: this.tTotal, kind: 'total', text: 'TOTAL', amt: '0.18 *' });
    const w1 = this.l1.words;
    R.push({ t: w1[0]!.start, kind: 'meas', text: 'DROP, MEASURED', amt: '1.40 m' });
    R.push({ t: w1[1]!.start, kind: 'meas', text: 'DROP, AGAIN', amt: '1.40 m' });
    R.push({ t: w1[3]!.start, kind: 'meas', text: 'DIFFERENCE', amt: '0.00 m' });
    R.push({ t: w1[5]!.start, kind: 'up', text: 'UPSIDE', amt: 'NOT ITEMISED' });
    this.rows = R;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    clearRT(renderer, out, LIN.bone);
    const L = this.L, c = L.ctx;
    L.clear(rgba('bone', 1));

    // slow push-in on the sheet
    const push = 1 + 0.035 * ease.inOutQuad(f.p);
    c.save();
    c.translate(960, 540); c.scale(push, push); c.translate(-960, -540);

    // ---- engineer's paper: a faint grid
    c.lineWidth = 1;
    for (let x = 0; x <= 1920; x += 40) { c.strokeStyle = rgba('ash', x % 200 === 0 ? 0.32 : 0.14); c.beginPath(); c.moveTo(x, -40); c.lineTo(x, 1120); c.stroke(); }
    for (let y = 0; y <= 1080; y += 40) { c.strokeStyle = rgba('ash', y % 200 === 0 ? 0.32 : 0.14); c.beginPath(); c.moveTo(-40, y); c.lineTo(1960, y); c.stroke(); }

    this.drawTape(c, t);
    this.drawMachine(c, t);
    this.drawRight(c, t);
    c.restore();

    // sheet title block (outside the push)
    mono(c, 'SHEET 02 / 12 · THE COST · SECTION A–A · SCALE 1:20', 1856, 1030, { size: 12, color: rgba('graphite', 0.8), track: 3, align: 'right' });

    comp.draw(renderer, L.upload(), out);

    // hits: every print, harder on the total and the stamp
    let hit = 0;
    for (const r of this.rows) if (r.t > 0) hit = Math.max(hit, pulse(t, r.t, 0.07) * (r.kind === 'total' ? 1.4 : 0.35));
    hit = Math.max(hit, pulse(t, this.tStamp, 0.1) * 1.2);
    for (const w of this.l1.words.slice(0, 2)) hit = Math.max(hit, pulse(t, w.start, 0.09) * 0.8);
    return { paper: 1, frame: 1 - prog(f.t, this.ctx.start, this.ctx.start + 0.5, ease.inCubic), bloom: 0.0, vignette: 0.18, ca: 0.3, halation: 0, shake: [hit * 4, hit * 2.5] as [number, number], zoom: 1 + hit * 0.006 };
  }

  /** How many rows the tape has advanced at t (continuous). */
  advance(t: number) {
    let a = 0;
    for (const r of this.rows) a += r.t < 0 ? 1 : ease.outCubic(clamp((t - r.t) / 0.09));
    return a;
  }

  drawTape(c: CanvasRenderingContext2D, t: number) {
    const adv = this.advance(t);
    // the strip, with a soft shadow on the sheet
    // the tape's torn top end rides up with the rows (a zigzag tear above the first row)
    const top = PRINT + (1 - adv) * ROW - ROW * 0.95;
    const tear = (dx: number, dy: number) => {
      c.beginPath(); c.moveTo(TX + dx, SLOT + dy);
      c.lineTo(TX + dx, top + dy);
      for (let i = 0; i <= 20; i++) c.lineTo(TX + dx + (i / 20) * TW, top + dy + (i % 2 ? -7 : 0) + (hash(i, 77) - 0.5) * 4);
      c.lineTo(TX + dx + TW, SLOT + dy); c.closePath();
    };
    c.fillStyle = rgba('ink', 0.07); tear(7, 5); c.fill();
    c.fillStyle = '#FFFEFA'; tear(0, 0); c.fill();
    c.strokeStyle = rgba('ink', 0.3); c.lineWidth = 1; c.stroke();
    c.save();
    tear(0, 0); c.clip();
    this.rows.forEach((r, n) => {
      if (r.t > 0 && t < r.t) return;
      // row n was printed at the head when the tape had advanced n rows; each later advance pushes it up
      const y = PRINT + (n + 1 - adv) * ROW;
      if (y < -30) return;
      const age = r.t < 0 ? 9 : t - r.t;
      const ink = r.kind === 'total' || r.kind === 'up' ? 'signal' : 'ink';
      // fresh ink is a touch darker and the glyphs strike in left to right
      const strike = clamp(age / 0.06);
      const col = rgba(ink, r.kind === 'sub' ? 0.6 : 0.92);
      const lx = TX + 30, rx = TX + TW - 30;
      c.save();
      if (strike < 1) { c.beginPath(); c.rect(TX, y - 40, (TW) * strike + 1, 60); c.clip(); }
      if (r.kind === 'rule') {
        c.strokeStyle = rgba('ink', 0.55); c.lineWidth = 1.2; c.setLineDash([6, 6]);
        c.beginPath(); c.moveTo(lx, y - 8); c.lineTo(rx, y - 8); c.stroke();
      } else if (r.kind === 'head' || r.kind === 'sub') {
        mono(c, r.text, TX + TW / 2, y, { size: r.kind === 'head' ? 26 : 16, color: col, align: 'center', track: r.kind === 'head' ? 5 : 3, weight: r.kind === 'head' ? 700 : 400 });
      } else {
        const big = r.kind === 'total';
        const sz = big ? 28 : 23;
        const wt = big ? 700 : 500;
        mono(c, r.text, lx, y, { size: sz, color: col, track: 1.5, weight: wt });
        mono(c, r.amt ?? '', rx, y, { size: sz, color: col, track: 1.5, align: 'right', weight: wt });
        // dot leaders
        c.font = font(F.mono(wt), sz); c.letterSpacing = '1.5px';
        const x0 = lx + c.measureText(r.text).width + 14, x1 = rx - c.measureText(r.amt ?? '').width - 14;
        c.fillStyle = rgba(ink, 0.45);
        for (let x = x0; x < x1; x += 11) { c.beginPath(); c.arc(x, y - 3, 1.3, 0, Math.PI * 2); c.fill(); }
        if (big) { // double rule under the total, as in the books
          c.strokeStyle = col; c.lineWidth = 1.5;
          const tw = c.measureText(r.amt ?? '').width;
          c.beginPath(); c.moveTo(rx - tw, y + 9); c.lineTo(rx, y + 9); c.moveTo(rx - tw, y + 14); c.lineTo(rx, y + 14); c.stroke();
        }
      }
      c.restore();
    });
    c.restore();
    // torn-off top edge is above the frame; the print head's shadow line
    c.fillStyle = rgba('ink', 0.12); c.fillRect(TX, SLOT - 8, TW, 3);
  }

  drawMachine(c: CanvasRenderingContext2D, t: number) {
    // body
    c.fillStyle = rgba('ink2', 1);
    c.beginPath(); c.roundRect(TX - 48, SLOT - 2, TW + 96, 300, 26); c.fill();
    c.fillStyle = rgba('ink', 1); c.fillRect(TX - 6, SLOT - 4, TW + 12, 8);
    // keys: the one pressed for each printed row goes down and lights
    const labels = ['7', '8', '9', '4', '5', '6', '+', '1', '2', '3', '0', '.', '×', '*'];
    let press: number[] = new Array(14).fill(0);
    this.rows.forEach((r, n) => {
      if (r.t < 0) return;
      const k = r.kind === 'total' ? 13 : r.kind === 'rule' ? 12 : Math.floor(hash(n, 31) * 12);
      press[k] = Math.max(press[k]!, pulse(t, r.t, 0.06) * (t >= r.t ? 1 : 0));
    });
    for (let i = 0; i < 14; i++) {
      const col = i % 7, row = Math.floor(i / 7);
      const kx = TX + 25 + col * 66, ky = SLOT + 40 + row * 62;
      const p = press[i]!;
      c.fillStyle = rgba('ink', 1);
      c.beginPath(); c.roundRect(kx, ky + 6, 54, 42, 8); c.fill();
      c.fillStyle = p > 0.05 ? mixCss(rgba('bone', 0.88), rgba('signal', 1), clamp(p * 1.5)) : (i >= 12 ? rgba('signal', 0.85) : rgba('bone', 0.88));
      c.beginPath(); c.roundRect(kx, ky + p * 5, 54, 40, 8); c.fill();
      mono(c, labels[i]!, kx + 27, ky + 27 + p * 5, { size: 17, color: rgba('ink', 0.85), align: 'center', track: 0, weight: 600 });
    }
  }

  drawRight(c: CanvasRenderingContext2D, t: number) {
    const ink = rgba('ink', 1), sig = rgba('signal', 1);
    const fam = F.archivo(112.5, 900);
    // ---- the lyric lane: line 0 then line 1
    const out0 = prog(t, this.tTotal - 0.25, this.tTotal, ease.inCubic);
    if (out0 < 1) {
      c.save(); c.translate(0, -60 * out0);
      karaokeRows(c, this.l0, [[0, 2], [2, 5], [5, 8]], LX, 172, t, {
        family: fam, size: 94, tracking: -1, lineH: 100, sung: ink, active: sig, unsung: rgba('ink', 0.13), lead: 0.5, alpha: 1 - out0,
      });
      c.restore();
    }
    if (t > this.tTotal - 0.05) {
      const inn = prog(t, this.tTotal, this.tTotal + 0.2, ease.outCubic);
      c.save(); c.translate(0, 40 * (1 - inn));
      karaokeRows(c, this.l1, [[0, 2], [2, 6]], LX, 172, t, {
        family: fam, size: 94, tracking: -1, lineH: 100, sung: ink, active: sig, unsung: rgba('ink', 0.13), lead: 0.3, alpha: inn,
      });
      c.restore();
    }

    // ---- the running total (moves up into the gap once line 0 has gone)
    let total = 0, lastAdd = -9;
    for (const r of this.rows) if (r.kind === 'item' && t >= r.t) { total += r.add!; lastAdd = r.t; }
    const isTotal = t >= this.tTotal;
    const hot = Math.max(pulse(t, lastAdd, 0.12), isTotal ? pulse(t, this.tTotal, 0.25) : 0);
    const ry = 512;
    const valCol = mixCss(ink, sig, clamp(hot * 1.3));
    mono(c, isTotal ? 'TOTAL · COST OF LEAPING' : 'RUNNING TOTAL · COST OF LEAPING', LX + 4, ry - 88, { size: 14, color: rgba('graphite', 1), track: 4 });
    const bump = 1 + 0.06 * hot;
    c.save();
    c.translate(LX, ry); c.scale(bump, bump);
    c.font = font(F.mono(500), 100); c.letterSpacing = '2px'; c.fillStyle = valCol; c.textBaseline = 'alphabetic';
    const val = `€${total.toFixed(2)}`;
    c.fillText(val, 0, 0);
    const vw = c.measureText(val).width;
    c.restore();
    if (isTotal) {
      const k = prog(t, this.tTotal, this.tTotal + 0.3, ease.outCubic);
      c.strokeStyle = ink; c.lineWidth = 3;
      c.beginPath(); c.moveTo(LX, ry + 18); c.lineTo(LX + vw * k, ry + 18); c.moveTo(LX, ry + 27); c.lineTo(LX + vw * k, ry + 27); c.stroke();
      const ak = prog(t, this.tTotal + 0.15, this.tTotal + 0.45);
      mono(c, '(ALL IN.)', LX + vw + 30, ry - 6, { size: 22, color: rgba('graphite', ak), track: 3 });
    }

    // ---- pencil underlay from the start: the construction lines of the edge, and the open question
    {
      const pk = prog(t, this.ctx.start + 0.1, this.ctx.start + 0.9, ease.outCubic);
      const qk = pk * (1 - prog(t, this.l1.words[0]!.start - 0.1, this.l1.words[0]!.start + 0.15));
      c.save();
      c.strokeStyle = rgba('graphite', 0.4 * pk); c.lineWidth = 1; c.setLineDash([3, 7]);
      c.beginPath(); c.moveTo(EX0, UP); c.lineTo(EDGE, UP); c.lineTo(EDGE, LOW); c.lineTo(1856, LOW); c.stroke();
      c.restore();
      if (qk > 0) mono(c, 'DROP  ? m', EDGE + 40, UP + DROP / 2 + 10, { size: 26, color: rgba('graphite', 0.75 * qk), track: 4 });
    }

    // ---- the elevation: draws itself in on the beats after line 0
    const g0 = this.tRule - 0.15;
    const kG = prog(t, g0, g0 + 0.4, ease.inOutCubic);
    const kD = prog(t, g0 + 0.3, g0 + 0.6, ease.outCubic);
    const kF = prog(t, this.tTotal - 0.05, this.tTotal + 0.15, ease.outCubic);
    if (kG > 0) {
      // section poché under both grounds
      c.save();
      c.beginPath(); c.rect(EX0, UP, (EDGE - EX0) * kG, 60); c.rect(EDGE, LOW, (1856 - EDGE) * kD, 60); c.clip();
      c.strokeStyle = rgba('ink', 0.35); c.lineWidth = 1;
      for (let x = EX0 - 80; x < 1900; x += 11) { c.beginPath(); c.moveTo(x, UP); c.lineTo(x + 70, UP + 70); c.moveTo(x, LOW); c.lineTo(x + 70, LOW + 70); c.stroke(); }
      c.restore();
      c.strokeStyle = ink; c.lineWidth = 2.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(EX0, UP); c.lineTo(EX0 + (EDGE - EX0) * kG, UP); c.stroke();
      if (kD > 0) {
        c.beginPath(); c.moveTo(EDGE, UP); c.lineTo(EDGE, UP + DROP * Math.min(1, kD * 1.6));
        if (kD > 0.6) c.lineTo(EDGE + (1856 - EDGE) * (kD - 0.6) / 0.4, LOW);
        c.stroke();
      }
      mono(c, 'EDGE', EDGE - 8, UP + 86, { size: 13, color: rgba('graphite', kG), track: 3, align: 'right' });
    }
    // the scale figure, on its toes at the edge
    if (kF > 0) {
      const bob = Math.abs(Math.sin(Math.PI * (t - this.tTotal) / 0.418)) * 4;
      drawFigure(c, EDGE - 70, UP - HIP * FS - 3 - bob, FS, mixPose(POSES.stand, POSES.ready, 0.8), { color: rgba('ink', kF) });
      mono(c, 'FIG. 1 · FOR SCALE', EDGE - 125, UP - 14, { size: 12, color: rgba('graphite', kF), track: 3, align: 'right' });
    }

    // ---- measured twice: on "Measure" and on "twice"
    const w1 = this.l1.words;
    const m1 = w1[0]!.start, m2 = w1[1]!.start;
    const dk = (t0: number) => prog(t, t0 - 0.02, t0 + 0.32);
    const dimCol = (t0: number) => mixCss(sig, ink, clamp((t - t0 - 0.35) / 0.4));
    for (const [x, t0, n] of [[D1, m1, 1], [D2, m2, 2]] as const) {
      if (t < t0 - 0.02) continue;
      witness(c, EDGE + 10, x + 16, UP, dk(t0) * 1.4, { col: rgba('ink', 0.7) });
      witness(c, x - 16, x + 16, LOW, dk(t0) * 1.4, { col: rgba('ink', 0.7) });
      dimV(c, x, UP, LOW, '1.40 m', { k: dk(t0), col: dimCol(t0), size: 36, label: 'right', arrow: 16, lw: 2 });
      mono(c, n === 1 ? 'MEASURED' : 'AGAIN', x, UP - 16, { size: 13, color: rgba('graphite', dk(t0)), track: 3, align: 'center' });
    }

    // ---- think it through: the arithmetic, typed on with the words
    const th = w1[3]!, thru = w1[5]!;
    const calc = '(1.40 + 1.40) ÷ 2 = 1.40 m';
    if (t > th.start - 0.02) {
      const eq = calc.indexOf('=');
      const n = t < thru.start ? Math.floor(prog(t, th.start, thru.start - 0.05) * eq) : eq + Math.ceil(prog(t, thru.start, thru.start + 0.25) * (calc.length - eq));
      const s = calc.slice(0, n);
      c.save();
      c.font = font(F.mono(500), 30); c.letterSpacing = '2px'; c.textBaseline = 'alphabetic';
      c.fillStyle = ink;
      const cx = EX0 + 4, cy = UP + 122;
      c.fillText(s.slice(0, Math.min(n, eq)), cx, cy);
      if (n > eq) {
        const ox = c.measureText(calc.slice(0, eq)).width;
        c.fillStyle = mixCss(sig, ink, clamp((t - thru.end) / 0.4));
        c.fillText(s.slice(eq), cx + ox + 2, cy);
      }
      c.restore();
    }
    // the stamp on the last beat
    stamp(c, 1600, 560, ['CHECKED', 'TWICE'], t, this.tStamp, { size: 44, rot: -0.12 });
  }
}
