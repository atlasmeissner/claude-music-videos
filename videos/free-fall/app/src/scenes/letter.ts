// letter — verse 2 (lines 11–14), bone paper.
// A cold email being written: a ruled compose form (TO: / SUBJECT:), the lyric written into its body word by word
// as it is sung. "What if nobody answers": a REPLIES counter slams to 0, the inbox is an empty tray that gets
// re-checked on every handclap. "What if all your words get lost": the written words peel off the page one by one,
// fold into paper planes and fly away, leaving empty ruled lines. "But a whisper costs you nothing": the writer starts
// over; a price tag on a string, tied to the word "whisper", swings in — COST €0.00. "And silence is the only
// cost": the ledger: every entry blank but SILENCE, the total ∞; the SEND button still unpressed.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, clearRT } from '../engine/gl';
import { F, font, fitSize, measure } from '../engine/type';
import { LIN, rgba } from '../engine/palette';
import { clamp, ease, hash, lerp, prog, pulse, TAU } from '../engine/util';
import { Lyrics as LyricsC, type Line, type Word } from '../engine/lyrics';
import { mixCss, mono, wordBoxes, wordColor, type WordBox } from './_ff';
import { drawPlane } from './letter-planes';

const FAM = F.archivo(112.5, 800);
// the compose form
const FX = 64, FY = 150, FW = 1170, FH = 850;
const BX = FX + 40; // body text left edge
const ROW = (i: number) => FY + 285 + i * 128; // body row baselines
const RX = 1316, RW = 1856 - 1316; // the right column

const INK = rgba('ink', 1), SIG = rgba('signal', 1);

interface Placed { line: Line; row: number; boxes: WordBox[]; peel: number[] }

export default class Letter extends Scene {
  text = new Layer2D();
  size = 60;
  placed: Placed[] = [];
  claps: number[] = [];

  override init() {
    const ly = this.ctx.lyrics, au = this.ctx.audio;
    const lines = [11, 12, 13, 14].map((i) => ly.lines[i]!);
    this.size = Math.min(62, ...lines.map((l) => fitSize(l.text, FAM, FW - 90, 200)));
    const bx = (l: Line) => wordBoxes(l, FAM, this.size, 0);
    const [l11, l12, l13, l14] = lines as [Line, Line, Line, Line];
    // the words of lines 11–12 peel off: line 11 from "words", line 12 once "lost" is under way (each only after
    // it has been sung and cooled)
    const tWords = l12.words[4]!.start;
    const p11 = l11.words.map((_, i) => tWords + i * 0.13);
    const p12 = l12.words.map((w, i) => Math.max(w.end + 0.22, l12.words[6]!.start + 0.06 + i * 0.1));
    this.placed = [
      { line: l11, row: 0, boxes: bx(l11), peel: p11 },
      { line: l12, row: 1, boxes: bx(l12), peel: p12 },
      { line: l13, row: 0, boxes: bx(l13), peel: [] },
      { line: l14, row: 3, boxes: bx(l14), peel: [] },
    ];
    // handclaps: beats 2 and 4 of every bar
    const db0 = au.downbeats.find((d) => d >= this.ctx.start - 0.01) ?? this.ctx.start;
    const b0 = Math.round(au.beatAt(db0));
    this.claps = au.beats.filter((b) => b > this.ctx.start && b < this.ctx.end && (Math.round(au.beatAt(b)) - b0) % 2 !== 0);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    const t = f.t, t0 = this.ctx.start;
    clearRT(renderer, out, LIN.bone);
    const L = this.text, c = L.ctx; L.clear();
    const [P11, P12, P13, P14] = this.placed as [Placed, Placed, Placed, Placed];
    const l11 = P11.line, l12 = P12.line, l13 = P13.line, l14 = P14.line;

    // ---------------------------------------------------------------- header + the form
    const build = prog(t, t0, t0 + 0.3, ease.outCubic);
    drawEnvelope(c, FX, 64, 64, 44, INK);
    mono(c, 'NEW MESSAGE', FX + 88, 96, { size: 16, color: INK, track: 5, weight: 500 });
    const nWords = this.wordsOnPage(t);
    mono(c, 'COLD · UNSOLICITED · HONEST', FX + FW, 96, { size: 12, color: rgba('graphite', 1), track: 4, align: 'right' });
    c.save();
    c.strokeStyle = INK; c.lineWidth = 2;
    c.strokeRect(FX, FY, FW * build, FH);
    c.lineWidth = 1;
    // TO / SUBJECT rules
    const rule = (y: number, w = 1, col = rgba('ink', 0.85)) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(FX, y); c.lineTo(FX + FW * build, y); c.stroke(); };
    rule(FY + 74); rule(FY + 148, 2);
    // body ruled lines
    for (let i = 0; i < 4; i++) {
      const k = prog(t, t0 + 0.05 + i * 0.04, t0 + 0.35 + i * 0.04, ease.outCubic);
      c.strokeStyle = rgba('ash', 0.9); c.lineWidth = 1;
      c.beginPath(); c.moveTo(BX, ROW(i) + 16); c.lineTo(BX + (FW - 80) * k, ROW(i) + 16); c.stroke();
    }
    // margin rule (a ruled paper form)
    c.strokeStyle = rgba('signal', 0.45); c.lineWidth = 1;
    c.beginPath(); c.moveTo(BX - 14, FY + 148); c.lineTo(BX - 14, FY + 148 + (FH - 230) * build); c.stroke();
    rule(FY + FH - 74);
    c.restore();
    // fields, typed in
    const typed = (s: string, a: number, b: number) => s.slice(0, Math.floor(s.length * prog(t, a, b)));
    mono(c, 'TO:', FX + 24, FY + 47, { size: 15, color: rgba('graphite', 1), track: 3 });
    mono(c, typed('hello@the-other-side', t0 + 0.02, t0 + 0.32), FX + 160, FY + 48, { size: 22, color: INK, track: 1 });
    mono(c, 'SUBJECT:', FX + 24, FY + 121, { size: 15, color: rgba('graphite', 1), track: 3 });
    mono(c, typed('a long shot', t0 + 0.2, t0 + 0.42), FX + 160, FY + 122, { size: 22, color: INK, track: 1 });
    // status bar: word count, the SEND button that never gets pressed
    const sb = FY + FH - 30;
    mono(c, `WORDS ${String(nWords).padStart(2, '0')}`, FX + 24, sb, { size: 14, color: INK, track: 3, weight: 500 });
    mono(c, 'ATTACHMENTS 0', FX + 180, sb, { size: 14, color: rgba('graphite', 1), track: 3 });
    const sil = l14.words[1]!;
    const notSent = t >= sil.start ? mixCss(SIG, rgba('signal', 1), 0) : rgba('graphite', 1);
    mono(c, 'DRAFT · NOT SENT', FX + FW - 190, sb, { size: 14, color: notSent, track: 3, align: 'right', weight: t >= sil.start ? 600 : 400 });
    c.save();
    c.strokeStyle = INK; c.lineWidth = 2;
    c.beginPath(); c.roundRect(FX + FW - 168, sb - 30, 144, 44, 6); c.stroke();
    c.restore();
    mono(c, 'SEND ▸', FX + FW - 96, sb - 1, { size: 16, color: INK, track: 4, align: 'center', weight: 600 });

    // ---------------------------------------------------------------- the body: written as sung, then peeled
    let caret: { x: number; y: number } | null = null;
    for (const P of this.placed) {
      const cur = this.drawBodyLine(c, P, t);
      if (cur && t >= P.line.start - 0.05) caret = cur;
    }
    // the caret: solid while writing, blinking on the beat between lines
    if (caret) {
      const writing = [l11, l12, l13, l14].some((l) => t >= l.start && t <= l.end);
      const on = writing || f.beatPhase < 0.5;
      if (on) { c.fillStyle = SIG; c.fillRect(caret.x + 6, caret.y - this.size * 0.74, 5, this.size * 0.86); }
    }

    // ---------------------------------------------------------------- the price tag on "whisper"
    const wWhisper = P13.boxes[2]!, wCosts = l13.words[3]!, wNothing = l13.words[5]!;
    if (t >= wCosts.start - 0.02) {
      const u = t - (wCosts.start - 0.02);
      const px = BX + (wWhisper.x0 + wWhisper.x1) / 2, py = ROW(0) + 18;
      const th = 1.35 * Math.exp(-1.15 * u) * Math.cos(TAU * 0.78 * u) + 0.03 * Math.sin(u * 2.1);
      drawTag(c, px, py, 120, th, t, wNothing);
    }

    // ---------------------------------------------------------------- right column: REPLIES, the inbox, the ledger
    const nobody = l11.words[4]!, answers = l11.words[5]!;
    if (t >= nobody.start) {
      const k = prog(t, nobody.start, nobody.start + 0.25, ease.outCubic);
      c.save(); c.globalAlpha = k;
      mono(c, 'REPLIES', RX, 205, { size: 15, color: INK, track: 6, weight: 500 });
      c.strokeStyle = INK; c.lineWidth = 2;
      c.beginPath(); c.moveTo(RX, 222); c.lineTo(RX + RW * k, 222); c.stroke();
      mono(c, 'AWAITING · LIVE', RX + RW, 205, { size: 12, color: rgba('graphite', 1), track: 3, align: 'right' });
      c.restore();
      if (t >= answers.start - 0.02) {
        const s = clamp((t - answers.start + 0.02) / 0.14);
        const sc = 1 + 0.4 * (1 - ease.outBack(s, 2.4));
        c.save();
        c.translate(RX + 6, 520); c.scale(sc, sc);
        c.font = font(F.archivo(125, 900), 330); c.textBaseline = 'alphabetic'; c.letterSpacing = '0px';
        c.globalAlpha = clamp(s * 3);
        c.fillStyle = wordColor(answers, t, INK, SIG);
        c.fillText('0', 0, 0);
        c.restore();
        // the empty inbox, re-checked on every handclap
        const inboxA = prog(t, answers.start + 0.2, answers.start + 0.5) * (1 - prog(t, 74.4, 74.65));
        if (inboxA > 0) this.drawInbox(c, t, answers.start, inboxA);
      }
    }
    this.drawLedger(c, t, l14);

    comp.draw(renderer, L.upload(), out);

    // hits: the 0, the tag arriving, €0.00, the total
    let hit = pulse(t, answers.start, 0.1);
    hit = Math.max(hit, pulse(t, wNothing.start, 0.1) * 0.8, pulse(t, l14.words[5]!.start, 0.1));
    for (const cl of this.claps) if (cl > answers.start) hit = Math.max(hit, pulse(t, cl, 0.06) * 0.25);
    void lyrics; void hash; void measure; void LyricsC;
    return { paper: 1, bloom: 0, vignette: 0.12, halation: 0, ca: 0.3, shake: [hit * 4, hit * 3] as [number, number], zoom: 1 + 0.004 * hit };
  }

  /** Words written so far minus words that flew away. */
  wordsOnPage(t: number) {
    let n = 0;
    for (const P of this.placed) P.line.words.forEach((w, i) => { if (t >= w.start && !(P.peel[i] !== undefined && t > P.peel[i]! + 0.15)) n++; });
    return n;
  }

  /** One body line: per-word wipe as sung (signal → ink), each word folding into a paper plane at its peel time. */
  drawBodyLine(c: CanvasRenderingContext2D, P: Placed, t: number): { x: number; y: number } | null {
    const y = ROW(P.row), sz = this.size;
    if (t < P.line.words[0]!.start) return null;
    // a line that is fully gone leaves no caret
    if (P.peel.length && t > Math.max(...P.peel) + 0.3) return null;
    let head: { x: number; y: number } | null = null;
    c.save();
    c.font = font(FAM, sz); c.textBaseline = 'alphabetic'; c.letterSpacing = '0px';
    P.boxes.forEach((b, i) => {
      const w = b.w;
      if (t < w.start) return;
      const p = LyricsC.wordProgress(w, t);
      const tp = P.peel[i];
      const col = wordColor(w, t, INK, SIG);
      const word = P.line.text.slice(b.i0, b.i1);
      const x0 = BX + b.x0, x1 = BX + b.x1;
      if (tp === undefined || t < tp) {
        const xw = p >= 1 ? x1 + 4 : x0 + (x1 - x0) * Math.min(1, p * 1.15);
        c.save(); c.beginPath(); c.rect(x0 - 4, y - sz * 1.2, xw - x0 + 4, sz * 1.6); c.clip();
        c.fillStyle = col; c.fillText(word, x0, y); c.restore();
        head = { x: Math.min(xw, x1), y };
        // a tremor before it peels (the corner lifting)
        return;
      }
      head = null;
      this.drawPeel(c, word, x0, x1, y, t - tp, i, P.row);
    });
    c.restore();
    return head;
  }

  /** The word lifts off as a paper slip, folds into a plane and flies off up and to the right. */
  drawPeel(c: CanvasRenderingContext2D, word: string, x0: number, x1: number, y: number, u: number, i: number, row: number) {
    const sz = this.size;
    const cx = (x0 + x1) / 2, cy = y - sz * 0.36;
    const hw = (x1 - x0) / 2 + 8, hh = sz * 0.5;
    const FOLD = 0.24;
    const s = 40 + 14 * hash(i, row, 1);
    if (u < FOLD) {
      const k = ease.inOutCubic(u / FOLD);
      const lift = ease.outCubic(clamp(u / 0.1)) * 10;
      // the slip (paper with the word on it) folding into a plane
      drawPlane(c, cx, cy - lift, lerp(hw, s, k), -0.12 * k, { fold: k, w0: hw, h0: hh * (1 - 0.3 * k), paper: rgba('bone', 1), ink: rgba('ink', 0.9 * k + 0.1), lw: 1.6 });
      c.save();
      c.globalAlpha = 1 - ease.inQuad(clamp(k * 1.6));
      c.translate(cx, cy - lift); c.scale(1 - 0.6 * k, 1 - 0.8 * k); c.translate(-cx, -(cy - lift));
      c.fillStyle = INK; c.fillText(word, x0, y - lift);
      c.restore();
      return;
    }
    const v = u - FOLD;
    const h1 = hash(i, row, 2), h2 = hash(i, row, 3), h3 = hash(i, row, 4);
    const dur = 1.5 + 0.5 * h3;
    const e = (q: number) => q * q * (0.6 + 0.4 * q); // gathers speed
    const q = v / dur;
    if (q > 1.4) return;
    const dx = 1500 + 700 * h1, dy = 650 + 600 * h2;
    const lift0 = 10;
    const pos = (qq: number) => ({
      x: cx + dx * e(qq) + 40 * Math.sin(qq * 7 + h1 * 6) * qq,
      y: cy - lift0 - dy * e(qq) - 90 * Math.sin(Math.PI * Math.min(1, qq * 1.4)) + 30 * Math.sin(qq * 9 + h2 * 5) * qq,
    });
    const a = pos(q), b = pos(q + 0.01);
    let ang = Math.atan2(b.y - a.y, b.x - a.x);
    ang = lerp(-0.12, ang, ease.outCubic(clamp(v / 0.25)));
    // a dashed flight line behind it, briefly
    c.save();
    c.strokeStyle = rgba('ink', 0.35 * (1 - clamp(q))); c.lineWidth = 1.2; c.setLineDash([3, 7]);
    c.beginPath();
    for (let j = 0; j <= 14; j++) { const p = pos(Math.max(0, q - 0.3 + (j / 14) * 0.3)); if (j === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); }
    c.stroke();
    c.restore();
    drawPlane(c, a.x, a.y, s, ang, { paper: rgba('bone', 1), ink: rgba('ink', 0.9), lw: 1.6 });
  }

  /** The inbox: an empty tray, NO NEW MESSAGES, and a counter of how many times it has been checked. */
  drawInbox(c: CanvasRenderingContext2D, t: number, since: number, a: number) {
    c.save(); c.globalAlpha = a;
    const y0 = 610;
    mono(c, 'INBOX', RX, y0, { size: 15, color: INK, track: 6, weight: 500 });
    c.strokeStyle = INK; c.lineWidth = 2;
    c.beginPath(); c.moveTo(RX, y0 + 17); c.lineTo(RX + RW, y0 + 17); c.stroke();
    // the tray (an empty in-tray in perspective-free elevation)
    const tx = RX + 30, ty = y0 + 70, tw = 250, th = 120;
    const checks = this.claps.filter((cl) => cl >= since && cl <= t);
    const lastC = checks[checks.length - 1];
    const jig = lastC !== undefined ? pulse(t, lastC, 0.07) : 0;
    c.save(); c.translate(0, -jig * 6);
    c.lineWidth = 3; c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(tx, ty + 30); c.lineTo(tx + 40, ty + 30); c.lineTo(tx + 60, ty + 62); c.lineTo(tx + tw - 60, ty + 62); c.lineTo(tx + tw - 40, ty + 30); c.lineTo(tx + tw, ty + 30);
    c.lineTo(tx + tw, ty + th); c.lineTo(tx, ty + th); c.closePath(); c.stroke();
    c.restore();
    mono(c, 'NO NEW MESSAGES', tx + tw + 30, ty + 70, { size: 15, color: INK, track: 3 });
    mono(c, 'CHECKED', tx + tw + 30, ty + 112, { size: 12, color: rgba('graphite', 1), track: 3 });
    const n = checks.length;
    mono(c, `${n}×`, tx + tw + 128, ty + 112, { size: 15, color: jig > 0.3 ? SIG : INK, track: 2, weight: 600 });
    c.restore();
  }

  /** "And silence is the only cost": a ledger with one entry filled in. */
  drawLedger(c: CanvasRenderingContext2D, t: number, l14: Line) {
    const [wAnd, wSil, , , wOnly, wCost] = l14.words as Word[];
    if (!wAnd || t < wAnd.start - 0.05) return;
    const y0 = 610;
    const k = prog(t, wAnd.start - 0.05, wAnd.start + 0.25, ease.outCubic);
    c.save();
    mono(c, 'LEDGER', RX, y0, { size: 15, color: INK, track: 6, weight: 500 });
    mono(c, 'COST', RX + RW, y0, { size: 12, color: rgba('graphite', 1), track: 4, align: 'right' });
    c.strokeStyle = INK; c.lineWidth = 2;
    c.beginPath(); c.moveTo(RX, y0 + 17); c.lineTo(RX + RW * k, y0 + 17); c.stroke();
    const rows: [string, number][] = [['ASKING', wAnd.start], ['A WHISPER', wAnd.start + 0.1], ['A “NO”', wAnd.start + 0.2], ['SILENCE', wSil!.start]];
    rows.forEach(([lab, ts], i) => {
      if (t < ts) return;
      const ry = y0 + 66 + i * 50;
      const a = prog(t, ts, ts + 0.12);
      const hot = i === 3;
      c.globalAlpha = a;
      const typedLab = hot ? lab.slice(0, Math.ceil(lab.length * prog(t, ts, wSil!.end - 0.1))) : lab;
      mono(c, typedLab, RX, ry, { size: 18, color: INK, track: 3, weight: hot ? 600 : 400 });
      // leader dots
      c.fillStyle = rgba('ash', 1);
      for (let x = RX + 200; x < RX + RW - 170; x += 12) c.fillRect(x, ry - 4, 2, 2);
      if (!hot) mono(c, '—', RX + RW, ry, { size: 18, color: rgba('graphite', 1), track: 0, align: 'right' });
      else if (t >= wOnly!.start) {
        const s = clamp((t - wOnly!.start) / 0.12);
        c.save(); c.translate(RX + RW, ry); c.scale(1 + 0.3 * (1 - ease.outBack(s, 2)), 1 + 0.3 * (1 - ease.outBack(s, 2)));
        mono(c, 'EVERYTHING', 0, 0, { size: 18, color: wordColor(wOnly!, t, SIG, SIG), track: 3, align: 'right', weight: 700 });
        c.restore();
      }
      c.globalAlpha = 1;
    });
    // the total
    if (t >= wCost!.start - 0.02) {
      const s = clamp((t - wCost!.start + 0.02) / 0.14);
      const ry = y0 + 66 + 4 * 50 + 46;
      c.strokeStyle = INK; c.lineWidth = 2;
      const lx = RX + RW - 240 * ease.outCubic(s);
      c.beginPath(); c.moveTo(lx, ry - 52); c.lineTo(RX + RW, ry - 52); c.stroke();
      mono(c, 'TOTAL', RX, ry, { size: 18, color: INK, track: 6, weight: 600 });
      const sc = 1 + 0.5 * (1 - ease.outBack(s, 2.4));
      c.save(); c.translate(RX + RW, ry + 8); c.scale(sc, sc);
      c.font = font(F.archivo(112.5, 900), 96); c.textAlign = 'right'; c.letterSpacing = '0px';
      c.fillStyle = wordColor(wCost!, t, INK, SIG);
      c.globalAlpha = clamp(s * 3);
      c.fillText('∞', 0, 0);
      c.restore();
      c.globalAlpha = 1;
      c.beginPath(); c.moveTo(lx, ry + 26); c.lineTo(RX + RW, ry + 26); c.moveTo(lx, ry + 31); c.lineTo(RX + RW, ry + 31); c.stroke();
    }
    c.restore();
  }
}

/** A plain envelope pictogram (outline, flap), top-left at (x, y). */
function drawEnvelope(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ink: string) {
  c.save();
  c.strokeStyle = ink; c.lineWidth = 3; c.lineJoin = 'round';
  c.strokeRect(x, y, w, h);
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + w / 2, y + h * 0.58); c.lineTo(x + w, y); c.stroke();
  c.restore();
}

/** A price tag on a string from (px, py), the string `len` long, swung by `th` (0 = hanging straight down). */
function drawTag(c: CanvasRenderingContext2D, px: number, py: number, len: number, th: number, t: number, wNothing: Word) {
  c.save();
  c.translate(px, py);
  c.rotate(-th);
  // string
  c.strokeStyle = rgba('ink', 1); c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(6, len * 0.4, -6, len * 0.7, 0, len); c.stroke();
  c.fillStyle = rgba('ink', 1); c.beginPath(); c.arc(0, 0, 3.5, 0, TAU); c.fill();
  // the tag hangs from its hole, slightly tilted on its own
  c.translate(0, len);
  c.rotate(th * 0.25);
  const w = 300, h = 178, ch = 46;
  c.beginPath();
  c.moveTo(-w / 2 + ch, -14); c.lineTo(w / 2 - ch, -14); c.lineTo(w / 2, -14 + ch); c.lineTo(w / 2, h); c.lineTo(-w / 2, h); c.lineTo(-w / 2, -14 + ch); c.closePath();
  c.fillStyle = rgba('signal', 1); c.fill();
  // the hole (paper shows through) with its reinforcement ring
  c.fillStyle = rgba('bone', 1); c.beginPath(); c.arc(0, 10, 8, 0, TAU); c.fill();
  c.strokeStyle = rgba('ink', 0.8); c.lineWidth = 2; c.beginPath(); c.arc(0, 10, 13, 0, TAU); c.stroke();
  mono(c, 'COST', -w / 2 + 26, 62, { size: 18, color: rgba('ink', 1), track: 6, weight: 600 });
  mono(c, 'WHISPER, 1 PC', w / 2 - 22, 62, { size: 12, color: rgba('ink', 0.85), track: 2, align: 'right' });
  c.strokeStyle = rgba('ink', 0.9); c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(-w / 2 + 22, 78); c.lineTo(w / 2 - 22, 78); c.stroke();
  if (t >= wNothing.start - 0.02) {
    const s = clamp((t - wNothing.start + 0.02) / 0.12);
    const sc = 1 + 0.5 * (1 - ease.outBack(s, 2.6));
    c.save(); c.translate(0, 152); c.scale(sc, sc);
    c.globalAlpha = clamp(s * 3);
    c.font = font(F.archivo(112.5, 900), 74); c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.letterSpacing = '0px';
    c.fillStyle = rgba('ink', 1);
    c.fillText('€0.00', 0, 0);
    c.restore();
  } else {
    mono(c, '€ —.——', 0, 140, { size: 34, color: rgba('ink', 0.5), track: 2, align: 'center' });
  }
  c.restore();
}
