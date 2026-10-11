// PLATE III `records` — "Collection, catalogued".
//   A. "I've got a hundred records sitting on the shelf": a shelf of 100 record spines (catalogue numbers,
//      label bands, ash/graphite/bone). The spines drop in left to right, accelerating, while an odometer
//      rolls to 100 on "hundred"; on downbeats a hand runs along the spines (a ripple); on "shelf" the last
//      few topple and lean, as records do.
//   B. "But I only needle-drop twenty to find myself": the 80 dim to ghosts and the vital 20 slide out red
//      on the downbeat (the odometer rolls back to 20). Cut (beat) to a top-down turntable: the arm swings
//      in and the needle drops exactly on "drop" (ripple + punch); on "twenty" 20 of the record's 100
//      grooves light red; "to find myself" runs along the groove spiralling in, and the lead-out groove
//      draws a red line into the label: a red dot at the spindle.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { F, font, layout } from '../engine/type';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { clamp, ease, lerp, prog, hash, TAU, polylineLengths, pointAtLength, type V2 } from '../engine/util';
import { Ground, PAPER_POST, VITAL20, drawFifthBar, drawKaraokeWords, drawPlateHead, footnote, fg, RED, isKey, wordIn, type C2D } from './_kit';

const LYR = F.archivo(87.5, 800);
// shelf
const SX0 = 196, SX1 = 1724, BASE = 596;
// turntable
const TT = { x: 1262, y: 574, R: 372 };
const PIV = { x: 1742, y: 196 };
const ARM_L = 560;
const bone = (a = 1) => `rgba(241,235,221,${a})`;
const ink = (a = 1) => `rgba(12,12,14,${a})`;

type Spine = { x: number; w: number; h: number; tone: number; band: number; cat: string; vital: boolean; order: number; tLand: number };

export default class Records extends Scene {
  g = new Ground();
  L = new Layer2D();
  L1!: Line; L2!: Line;
  B: number[] = [];
  spines: Spine[] = [];
  vitalOrder: number[] = [];
  tA = 0; tHund = 0; tRec = 0; tShelf = 0; tBut = 0; tDrop = 0; tTwenty = 0; tCut = 0; tMyself = 0;
  sizeA = 80; sizeB = 100;
  rowsA1: Word[][] = []; rowsA2: Word[][] = []; rowsB: Word[][] = [];
  spiral: V2[] = []; spiralL!: Float32Array;
  grooves: { r: number; a: number; red: number }[] = [];

  override init() {
    const { lyrics, audio, start } = this.ctx;
    this.L1 = lyrics.get('a hundred records');
    this.L2 = lyrics.get('needle-drop twenty');
    const b0 = Math.round(audio.beatAt(start));
    for (let k = 0; k <= 18; k++) this.B.push(audio.timeOfBeat(b0 + k));
    this.tHund = wordIn(this.L1, 'hundred').start;
    this.tRec = wordIn(this.L1, 'records').start;
    this.tShelf = wordIn(this.L1, 'shelf').start;
    this.tBut = wordIn(this.L2, 'but').start;
    const nd = wordIn(this.L2, 'needle-drop');
    this.tDrop = nd.syl && nd.syl.length > 1 ? nd.syl[1]![0] : lerp(nd.start, nd.end, 0.6);
    this.tTwenty = wordIn(this.L2, 'twenty').start;
    this.tMyself = wordIn(this.L2, 'myself').end;
    this.tCut = this.B[10]!; // the beat before "drop"
    this.tA = start + 0.05;
    const tB = wordIn(this.L1, 'hundred').end;

    // 100 spines with widths normalised to the shelf (a gap is left at the right end for the leaners)
    const raw = Array.from({ length: 100 }, (_, i) => 7 + 15 * Math.pow(hash(i, 11), 1.6) + (hash(i, 12) > 0.93 ? 12 : 0));
    const gap = 2, avail = SX1 - SX0 - 74 - gap * 99;
    const sum = raw.reduce((a, b) => a + b, 0);
    let x = SX0;
    for (let i = 0; i < 100; i++) {
      const w = (raw[i]! * avail) / sum;
      const tone = hash(i, 13);
      this.spines.push({
        x, w, h: 300 + 12 * hash(i, 14) + (hash(i, 16) > 0.91 ? -110 : 0) + (hash(i, 15) > 0.95 ? 24 : 0),
        tone, band: hash(i, 17), cat: `PR-${String(i + 1).padStart(3, '0')}`, vital: VITAL20.includes(i), order: 0,
        tLand: this.tA + (tB - this.tA) * Math.sqrt(i / 99),
      });
      x += w + gap;
    }
    this.vitalOrder = [...VITAL20];
    this.vitalOrder.forEach((i, j) => (this.spines[i]!.order = j));

    // lyric rows
    const pick = (l: Line, cuts: number[]) => {
      const rows: Word[][] = []; let a = 0;
      for (const c of [...cuts, l.words.length]) { rows.push(l.words.slice(a, c)); a = c; }
      return rows;
    };
    this.rowsA1 = pick(this.L1, [5]); // I've got a hundred records / sitting on the shelf
    this.rowsA2 = pick(this.L2, [4]); // But I only needle-drop / twenty to find myself
    this.rowsB = pick(this.L2, [3, 4, 5]); // But I only / needle-drop / twenty / (to find myself on the record)
    const fit = (rows: Word[][], w: number, max: number) => {
      let s = max;
      for (const r of rows) s = Math.min(s, (100 * w) / layout(r.map((x) => x.w).join(' '), LYR, 100).width);
      return Math.floor(s);
    };
    this.sizeA = fit([...this.rowsA1, ...this.rowsA2], 1300, 92);
    this.sizeB = fit(this.rowsB.slice(0, 2), 640, 120);

    // the groove: a spiral over the top of the record, inward left to right, then the lead-out into the label
    const pts: V2[] = [];
    for (let i = 0; i <= 400; i++) {
      const u = i / 400;
      const a = lerp(-Math.PI * 0.92, Math.PI * 1.1, u); // ~1.1 turns clockwise
      const r = lerp(TT.R * 0.86, TT.R * 0.2, Math.pow(u, 0.9));
      pts.push({ x: TT.x + Math.cos(a) * r, y: TT.y + Math.sin(a) * r });
    }
    this.spiral = pts;
    this.spiralL = polylineLengths(pts);

    // 100 grooves (concentric rings) between the label and the rim; the vital 20 light red on "twenty"
    for (let i = 0; i < 100; i++) {
      const r = lerp(TT.R * 0.36, TT.R * 0.97, i / 99) + (hash(i, 21) - 0.5) * 1.2;
      this.grooves.push({ r, a: 0.1 + 0.16 * hash(i, 22) + (i % 9 === 0 ? 0.12 : 0), red: VITAL20.indexOf(99 - i) });
    }
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    this.g.render(renderer, out, { paper: 1, grid: 0, vig: 0.22 });
    const c = this.L.ctx; this.L.clear();
    let post: PostOverrides = {};
    if (t < this.tCut) post = this.drawShelf(c, t);
    else post = this.drawTurntable(c, t);
    comp.draw(renderer, this.L.upload(), out);
    return { ...PAPER_POST, ...post };
  }

  // ============================================================ A. the shelf
  drawShelf(c: C2D, t: number): PostOverrides {
    const B = this.B;
    drawPlateHead(c, 3, 'Collection, catalogued', (t - this.ctx.start) / 0.6, { right: 'HOLDINGS REGISTER · VOL. I' });
    const db = B[1]!; // first downbeat
    // camera: steps in on the downbeats
    const zoom = 1 + 0.02 * prog(t, B[5]!, B[5]! + 0.4, ease.outExpo) + 0.02 * prog(t, B[9]!, B[9]! + 0.4, ease.outExpo);
    c.save();
    c.translate(960, 560); c.scale(zoom, zoom); c.translate(-960, -560);

    // shelf unit: uprights + plank (engraved: outline and hatch)
    const pk = prog(t, B[0]!, B[0]! + 0.5, ease.outExpo);
    c.strokeStyle = fg(true, 0.92); c.lineWidth = 6; c.lineCap = 'butt';
    c.beginPath();
    c.moveTo(SX0 - 22, BASE + 34); c.lineTo(SX0 - 22, lerp(BASE + 34, 226, pk));
    c.moveTo(SX1 + 22, BASE + 34); c.lineTo(SX1 + 22, lerp(BASE + 34, 226, pk));
    c.stroke();
    c.lineWidth = 2;
    const px1 = lerp(SX0 - 25, SX1 + 25, pk);
    c.strokeRect(SX0 - 25, BASE, px1 - (SX0 - 25), 30);
    c.save(); c.beginPath(); c.rect(SX0 - 25, BASE, px1 - (SX0 - 25), 30); c.clip();
    c.strokeStyle = fg(true, 0.35); c.lineWidth = 1; c.beginPath();
    for (let x = SX0 - 40; x < SX1 + 40; x += 7) { c.moveTo(x, BASE + 30); c.lineTo(x + 30, BASE); }
    c.stroke(); c.restore();
    // top board
    c.strokeStyle = fg(true, 0.92); c.lineWidth = 6;
    c.beginPath(); c.moveTo(SX0 - 25, 226); c.lineTo(lerp(SX0 - 25, SX1 + 25, pk), 226); c.stroke();
    // shelf shadow line
    c.fillStyle = fg(true, 0.12); c.fillRect(SX0 - 25, BASE + 30, px1 - (SX0 - 25), 8);

    // spine states
    const dimK = prog(t, this.tBut, this.tBut + 0.3, ease.outCubic); // the 80 fade to ghosts
    const pullT0 = B[9]!; // vital 20 slide out on the downbeat, a 32nd apart
    const leanK = prog(t, this.tShelf, this.tShelf + 0.45, (x) => ease.outBack(x, 2.5));
    const nLean = 5;

    for (let i = 0; i < 100; i++) {
      const s = this.spines[i]!;
      if (t < s.tLand - 0.2) continue;
      const land = prog(t, s.tLand - 0.2, s.tLand, ease.inQuad);
      let y = -(1 - land) * 140;
      // squash on landing
      const sq = t >= s.tLand ? Math.exp(-(t - s.tLand) * 22) : 0;
      // hand along the spines on the downbeats (a ripple)
      for (const d of [B[5]!, B[7]!]) {
        const td = d + (s.x - SX0) * 0.00028;
        if (t > td) y -= 10 * Math.exp(-(t - td) * 14) * (1 - Math.exp(-(t - td) * 60));
      }
      // vital pull-out
      let pull = 0, red = 0;
      if (s.vital) {
        const tp = pullT0 + s.order * 0.028;
        pull = prog(t, tp, tp + 0.22, ease.outBack);
        red = prog(t, tp, tp + 0.08);
      }
      y -= pull * 74;
      const alpha = s.vital ? 1 : lerp(1, 0.3, dimK);
      c.save();
      c.globalAlpha = land > 0 ? Math.min(1, land * 3) * alpha : 0;
      // the last few topple on "shelf" and lean as one block into the gap
      if (i >= 100 - nLean) {
        const last = this.spines[99]!;
        const pxr = last.x + last.w;
        c.translate(pxr, BASE); c.rotate(leanK * 0.19); c.translate(-pxr, -BASE);
      }
      this.drawSpine(c, s, BASE + y, sq, red);
      c.restore();
    }

    // counter: odometer rolling to 100 (and back down to 20 on the pull-out)
    const landed = clamp((t - this.tA) / (wordIn(this.L1, 'hundred').end - this.tA));
    let val = 100 * landed * landed;
    const pullK = prog(t, pullT0, pullT0 + 20 * 0.028 + 0.2, ease.outCubic);
    val = lerp(val, 20, pullK);
    const slam = t >= this.tRec ? Math.exp(-(t - this.tRec) * 8) : 0;
    c.save();
    c.translate(SX1 + 22, 186);
    c.scale(1 + slam * 0.12, 1 + slam * 0.12);
    drawOdometer(c, val, 0, 0, 74, pullK > 0.5 ? RED() : fg(true, 0.92));
    c.restore();
    c.font = font(F.mono(500), 14); c.textAlign = 'right'; c.fillStyle = fg(true, 0.62);
    c.fillText(pullK > 0.5 ? 'IN ROTATION' : 'HOLDINGS', SX1 + 22 - 210, 166);
    c.fillStyle = fg(true, 0.45);
    c.fillText(pullK > 0.5 ? 'OF 100' : 'RECORDS', SX1 + 22 - 210, 186);
    c.textAlign = 'left';
    c.restore();

    // caption block: FIG header + the lyric rows (line 1 rolls out, line 2 rolls in on the beat before "But")
    const hx = SX0 - 25, hy = 690;
    const hk = prog(t, B[0]! + 0.2, B[0]! + 0.8, ease.outExpo);
    c.strokeStyle = fg(true, 0.5); c.lineWidth = 1;
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + (SX1 + 50 - hx) * hk, hy); c.stroke();
    c.font = font(F.mono(500), 13); c.fillStyle = fg(true, 0.7);
    const head = 'FIG. 1 — THE COLLECTION, SHELVED (ALPHABETICAL, THEN BY MOOD)';
    c.fillText(head.slice(0, Math.ceil(head.length * hk)), hx, hy - 12);
    c.textAlign = 'right'; c.fillStyle = fg(true, 0.5);
    c.fillText('n = 100', SX1 + 25, hy - 12); c.textAlign = 'left';

    const roll = prog(t, B[8]!, B[8]! + 0.42, ease.outExpo);
    const ROLL = 260;
    c.save();
    c.beginPath(); c.rect(hx - 10, hy + 6, 1600, 290); c.clip();
    const st = { family: LYR, size: this.sizeA, paper: true, pop: 0.03, lead: 0.4 };
    if (roll < 1) this.rowsA1.forEach((r, i) => drawKaraokeWords(c, r, t, hx, 800 + i * 104 - roll * ROLL, st));
    if (roll > 0) this.rowsA2.forEach((r, i) => drawKaraokeWords(c, r, t, hx, 800 + i * 104 + (1 - roll) * ROLL, st));
    c.restore();

    footnote(c, '³ Catalogue numbers assigned in order of acquisition, not of merit.', 96, 1004);

    const kick = t >= this.tRec ? Math.exp(-(t - this.tRec) * 7) : 0;
    return { zoom: 1 + 0.012 * kick };
  }

  drawSpine(c: C2D, s: Spine, base: number, sq: number, red: number) {
    const h = s.h * (1 - sq * 0.04), w = s.w, x = s.x, y = base - h;
    const tone = s.tone;
    let fill: string, line: string;
    if (tone < 0.32) { fill = 'rgba(94,91,87,1)'; line = bone(0.75); }
    else if (tone < 0.62) { fill = 'rgba(156,151,143,1)'; line = ink(0.7); }
    else if (tone < 0.72) { fill = ink(0.9); line = bone(0.7); }
    else { fill = bone(); line = ink(0.7); }
    if (red > 0) { fill = red >= 1 ? RED() : fill; line = bone(0.9); }
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
    if (red > 0 && red < 1) { c.fillStyle = RED(red); c.fillRect(x, y, w, h); }
    c.strokeStyle = ink(0.85); c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // label band(s)
    c.fillStyle = line;
    if (s.band < 0.45) c.fillRect(x + 1, y + 16, w - 2, 2);
    else if (s.band < 0.7) { c.fillRect(x + 1, y + 12, w - 2, 1); c.fillRect(x + 1, y + h - 22, w - 2, 1); }
    else if (s.band < 0.85) c.fillRect(x + 1, y + h * 0.35, w - 2, 6);
    // catalogue number, vertical
    if (w >= 11) {
      c.save();
      c.translate(x + w / 2 + 3.5, y + h - 30); c.rotate(-Math.PI / 2);
      c.font = font(F.mono(500), 9.5); c.fillStyle = line;
      c.fillText(s.cat, 0, 0);
      c.restore();
    }
  }

  // ============================================================ B. the turntable
  /** Tonearm angle (rad, from the pivot): rest → outer groove on the cut, then tracking inward. */
  armAngle(t: number) {
    const rest = 1.66, play = 1.93, inner = 2.12;
    const swing = prog(t, this.tCut, this.tDrop - 0.04, ease.inOutCubic);
    const track = prog(t, this.tDrop, this.ctx.end, ease.linear);
    return lerp(rest, play, swing) + (inner - play) * track;
  }

  drawTurntable(c: C2D, t: number): PostOverrides {
    const B = this.B, { x: cx, y: cy, R } = TT;
    const drop = t >= this.tDrop ? Math.exp(-(t - this.tDrop) * 6) : 0;
    // the frame cuts in on the beat, the camera already moving: settles from a slight zoom
    const k0 = prog(t, this.tCut, this.tCut + 0.5, ease.outExpo);
    const zoom = lerp(1.06, 1, k0) + 0.012 * prog(t, B[13]!, B[13]! + 0.4, ease.outExpo);
    c.save();
    c.translate(cx, cy); c.scale(zoom, zoom); c.translate(-cx, -cy);

    // plinth
    c.strokeStyle = fg(true, 0.9); c.lineWidth = 2;
    c.beginPath(); c.roundRect(cx - R - 70, 138, 2 * R + 190 + 90, 870, 14); c.stroke();
    c.lineWidth = 1; c.strokeStyle = fg(true, 0.4);
    c.beginPath(); c.roundRect(cx - R - 60, 148, 2 * R + 190 + 70, 850, 9); c.stroke();
    // feet/controls: start button, speed selector
    c.strokeStyle = fg(true, 0.8); c.lineWidth = 1.5;
    c.strokeRect(cx - R - 40, 930, 64, 34);
    c.font = font(F.mono(500), 11); c.fillStyle = fg(true, 0.7); c.fillText('START', cx - R - 30, 952);
    c.fillText('33⅓', cx - R + 50, 952); c.fillText('45', cx - R + 100, 952);
    c.fillStyle = RED(); c.beginPath(); c.arc(cx - R + 62, 966, 3, 0, TAU); c.fill();

    // platter + record
    c.fillStyle = fg(true, 0.9);
    c.beginPath(); c.arc(cx, cy, R + 16, 0, TAU); c.lineWidth = 2; c.strokeStyle = fg(true, 0.9); c.stroke();
    // strobe dots around the platter rim, turning
    const rot = (t - this.tCut) * (TAU * 33.333 / 60);
    for (let i = 0; i < 90; i++) {
      const a = rot * 0.25 + (i / 90) * TAU;
      c.fillStyle = fg(true, i % 5 === 0 ? 0.7 : 0.35);
      c.fillRect(cx + Math.cos(a) * (R + 9) - 1, cy + Math.sin(a) * (R + 9) - 1, 2, 2);
    }
    c.fillStyle = ink(1);
    c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    // grooves
    const twK = (j: number) => prog(t, this.tTwenty + j * 0.03, this.tTwenty + j * 0.03 + 0.2, ease.outCubic);
    c.lineWidth = 1;
    for (const g of this.grooves) {
      const rk = g.red >= 0 ? twK(g.red) : 0;
      c.strokeStyle = rk > 0 ? RED(lerp(g.a, 0.95, rk)) : bone(g.a);
      c.lineWidth = rk > 0 ? lerp(1, 1.7, rk) : 1;
      c.beginPath(); c.arc(cx, cy, g.r, 0, TAU); c.stroke();
    }
    // sheen (fixed light): two soft wedges
    const sheen = c.createConicGradient(-0.6, cx, cy);
    sheen.addColorStop(0, bone(0)); sheen.addColorStop(0.08, bone(0.13)); sheen.addColorStop(0.16, bone(0));
    sheen.addColorStop(0.5, bone(0)); sheen.addColorStop(0.58, bone(0.1)); sheen.addColorStop(0.66, bone(0)); sheen.addColorStop(1, bone(0));
    c.fillStyle = sheen;
    c.beginPath(); c.arc(cx, cy, R * 0.98, 0, TAU); c.arc(cx, cy, R * 0.34, 0, TAU, true); c.fill();
    // label: bone disc with the red fifth, turning at 33⅓
    const LR = R * 0.3;
    c.fillStyle = bone(); c.beginPath(); c.arc(cx, cy, LR, 0, TAU); c.fill();
    c.fillStyle = RED(); c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, LR, rot + 2.55, rot + 2.55 + TAU * 0.2); c.closePath(); c.fill();
    c.save();
    c.translate(cx, cy); c.rotate(rot);
    c.font = font(F.mono(600), 13); c.fillStyle = fg(true, 0.85); c.textAlign = 'center';
    c.fillText('SIDE A', 0, -LR * 0.5);
    c.font = font(F.mono(400), 10); c.fillText('33⅓ RPM · 20 OF 100', 0, LR * 0.62);
    c.restore();
    c.fillStyle = fg(true, 1); c.beginPath(); c.arc(cx, cy, 5, 0, TAU); c.fill();

    // "to find myself": along the groove, spiralling in (steps a little further on each beat)
    this.drawGrooveWords(c, t);

    // drop ripple
    const arm = this.armGeom(t);
    if (t >= this.tDrop) {
      for (let i = 0; i < 3; i++) {
        const age = t - this.tDrop - i * 0.09;
        if (age <= 0 || age > 0.9) continue;
        c.strokeStyle = bone(0.6 * (1 - age / 0.9)); c.lineWidth = 1.5;
        c.beginPath(); c.arc(arm.nx, arm.ny, 12 + age * 260, 0, TAU); c.stroke();
      }
    }
    this.drawArm(c, t, arm, drop);
    c.restore();

    // ------------- left column: the line, big
    drawPlateHead(c, 3, 'Collection, catalogued', 1, { right: '', x1: 760 });
    const X = 96, hy = 300;
    c.strokeStyle = fg(true, 0.5); c.lineWidth = 1;
    c.beginPath(); c.moveTo(X, hy); c.lineTo(760, hy); c.stroke();
    c.font = font(F.mono(500), 13); c.fillStyle = fg(true, 0.7);
    c.fillText('FIG. 2 — THE NEEDLE, DROPPED', X, hy - 12);
    const st = { family: LYR, size: this.sizeB, paper: true, pop: 0.03, lead: 0.4 };
    drawKaraokeWords(c, this.rowsB[0]!, t, X, 420, st);
    drawKaraokeWords(c, this.rowsB[1]!, t, X, 420 + this.sizeB * 1.08, st);
    // "twenty": bigger, slams on its word
    const tw = this.rowsB[2]![0]!;
    const twp = t >= tw.start ? Math.exp(-(t - tw.start) * 9) : 0;
    c.save();
    const ty = 420 + this.sizeB * 1.08 * 2 + 40;
    c.translate(X, ty); c.scale(1 + 0.08 * twp, 1 + 0.08 * twp);
    drawKaraokeWords(c, this.rowsB[2]!, t, 0, 0, { ...st, family: F.archivo(100, 900), size: Math.round(this.sizeB * 1.5), pop: 0 });
    c.restore();
    // the fifth bar: shelved / played
    const fk = prog(t, this.tTwenty, this.tTwenty + 0.5, ease.outExpo);
    drawFifthBar(c, X, ty + 50, 640, 18, { fill: prog(t, this.tCut, this.tCut + 0.5, ease.outExpo), split: fk });
    c.font = font(F.mono(500), 14); c.textBaseline = 'top';
    c.fillStyle = fg(true, 0.65); c.fillText('80 SHELVED', X, ty + 80);
    c.fillStyle = RED(fk); c.textAlign = 'right'; c.fillText('20 PLAYED', X + 640, ty + 80);
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';

    footnote(c, '⁴ Side A, track 20 of 20. Self located at 33⅓ rpm.', 96, 1004);
    return { zoom: 1 + 0.025 * drop, shake: [0, 3 * drop * Math.sin((t - this.tDrop) * 90)] };
  }

  armGeom(t: number) {
    const a = this.armAngle(t);
    const ca = Math.cos(a), sa = Math.sin(a);
    return { a, ca, sa, nx: PIV.x + ca * ARM_L, ny: PIV.y + sa * ARM_L };
  }

  drawArm(c: C2D, t: number, g: { a: number; ca: number; sa: number; nx: number; ny: number }, drop: number) {
    const { ca, sa } = g;
    // lifted before the drop: drawn a touch larger with an offset shadow
    const lift = t < this.tDrop ? 1 : 0;
    // shadow
    if (lift) {
      c.strokeStyle = ink(0.15); c.lineWidth = 9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(PIV.x + 10, PIV.y + 14); c.lineTo(g.nx + 10, g.ny + 14); c.stroke();
    }
    // base
    c.fillStyle = bone(); c.strokeStyle = fg(true, 0.9); c.lineWidth = 2;
    c.beginPath(); c.arc(PIV.x, PIV.y, 40, 0, TAU); c.fill(); c.stroke();
    c.lineWidth = 1; c.beginPath(); c.arc(PIV.x, PIV.y, 30, 0, TAU); c.stroke();
    // counterweight
    const wx = PIV.x - ca * 52, wy = PIV.y - sa * 52;
    c.save(); c.translate(wx, wy); c.rotate(g.a);
    c.fillStyle = 'rgba(94,91,87,1)'; c.beginPath(); c.roundRect(-20, -14, 30, 28, 3); c.fill(); c.stroke();
    c.strokeStyle = bone(0.6); c.lineWidth = 1; c.beginPath(); c.moveTo(-12, -14); c.lineTo(-12, 14); c.moveTo(-4, -14); c.lineTo(-4, 14); c.stroke();
    c.restore();
    // tube: outlined (engraved)
    c.lineCap = 'round';
    c.strokeStyle = fg(true, 0.95); c.lineWidth = 9;
    c.beginPath(); c.moveTo(PIV.x - ca * 40, PIV.y - sa * 40); c.lineTo(g.nx - ca * 40, g.ny - sa * 40); c.stroke();
    c.strokeStyle = bone(); c.lineWidth = 4;
    c.beginPath(); c.moveTo(PIV.x - ca * 36, PIV.y - sa * 36); c.lineTo(g.nx - ca * 44, g.ny - sa * 44); c.stroke();
    // headshell (offset angle) with the stylus at the needle point
    c.save();
    c.translate(g.nx, g.ny); c.rotate(g.a + 0.38);
    const hs = 1 + lift * 0.06 + drop * 0.02;
    c.scale(hs, hs);
    c.fillStyle = bone(); c.strokeStyle = fg(true, 0.95); c.lineWidth = 2;
    c.beginPath(); c.roundRect(-52, -15, 62, 30, 4); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-52, -6); c.lineTo(-70, -6); c.stroke(); // finger lift
    c.fillStyle = RED(); c.beginPath(); c.arc(0, 0, 4, 0, TAU); c.fill();
    c.restore();
    c.lineCap = 'butt';
  }

  drawGrooveWords(c: C2D, t: number) {
    const words = this.L2.words.slice(5); // to find myself
    const size = 60;
    const lays = words.map((w) => layout(w.w, LYR, size));
    const sp = size * 0.28;
    // the phrase starts near the top-left of the record and creeps inward a step per beat
    const steps = [11, 12, 13, 14, 15].map((i) => prog(t, this.B[i]!, this.B[i]! + 0.3, ease.outExpo)).reduce((a, b) => a + b, 0);
    let s = 40 + steps * 16;
    const pts = this.spiral, L = this.spiralL;
    // groove line behind the words (the needle's path), red from the needle drop
    const total = L[L.length - 1]!;
    const head = 160;
    c.strokeStyle = bone(0.22); c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < pts.length; i++) { const p = pts[i]!; if (i === 0) c.moveTo(p.x, p.y); else c.lineTo(p.x, p.y); }
    c.stroke();
    // lead-out: the red line runs into the label after "myself"
    const lo = prog(t, this.tMyself - 0.25, this.ctx.end - 0.05, ease.inOutCubic);
    if (lo > 0) {
      c.strokeStyle = RED(); c.lineWidth = 2.5;
      c.beginPath();
      const s1 = lerp(head, total, lo);
      for (let i = 0; i < pts.length; i++) {
        if (L[i]! < head) continue;
        if (L[i]! > s1) break;
        const p = pts[i]!; c.lineTo(p.x, p.y);
      }
      c.stroke();
      if (lo > 0.95) { c.fillStyle = RED(); c.beginPath(); c.arc(TT.x, TT.y, 9 * prog(lo, 0.95, 1, ease.outBack), 0, TAU); c.fill(); }
    }
    // glyphs along the path, upright to the tangent
    c.font = font(LYR, size);
    words.forEach((w, wi) => {
      const lay = lays[wi]!;
      const p = Lyrics.wordProgress(w, t);
      const visible = t >= words[0]!.start - 0.4;
      const key = isKey(w);
      for (const gl of lay.glyphs) {
        const q = pointAtLength(pts, L, s + gl.x + gl.w / 2);
        const k = clamp(p * lay.glyphs.length - gl.i);
        let a = visible ? 0.3 : 0;
        if (k > 0) a = lerp(0.3, 1, k);
        if (a <= 0) continue;
        c.save();
        c.translate(q.x, q.y); c.rotate(q.angle);
        c.fillStyle = key && k > 0 ? RED(a) : bone(a);
        c.fillText(gl.ch, -gl.w / 2, -6);
        c.restore();
      }
      s += lay.width + sp;
    });
  }
}

/** A rolling odometer (right-aligned at x): digits roll like a mechanical counter. */
function drawOdometer(c: C2D, value: number, x: number, y: number, size: number, color: string) {
  const nd = 3;
  c.save();
  c.font = font(F.mono(600), size);
  const cw = c.measureText('0').width;
  const lh = size * 1.15;
  c.beginPath(); c.rect(x - nd * cw - 4, y - size * 0.86, nd * cw + 8, size * 1.02); c.clip();
  c.fillStyle = color;
  const v = Math.max(0, value);
  for (let k = 0; k < nd; k++) {
    const p = Math.pow(10, k);
    const d = v / p;
    let n = Math.floor(d);
    let frac = 0;
    if (k === 0) frac = d - n;
    else { const lower = v % p; frac = clamp(lower - (p - 1)); }
    frac = ease.outCubic(clamp((frac - 0.6) / 0.4));
    const dx = x - (k + 1) * cw;
    // hide leading zeros above the value
    const show = (digit: number) => !(k > 0 && digit === 0 && v < p);
    const d0 = n % 10, d1 = (n + 1) % 10;
    if (show(d0)) c.fillText(String(d0), dx, y - frac * lh);
    if (frac > 0 && (show(d1) || v + 1 >= p)) c.fillText(String(d1), dx, y + (1 - frac) * lh);
    n = 0;
  }
  c.restore();
}
