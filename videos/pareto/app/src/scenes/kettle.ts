// PLATE IV `kettle` — "Breakfast, engraved".
//   A. "The kettle's boiling over, the toast is slightly charred": a kitchen engraving (contour hatching,
//      stipple, a tiled wall). Steam rises from the kettle's spout and each word of the first half rides
//      it up into place as it is sung; the lid rattles on every beat from "boiling" and the pot spills
//      over on "over". The second half rises off the toast as it browns; on "charred" exactly its top
//      fifth chars red, with a dimension bracket: 20% CHARRED / 80% EDIBLE.
//   B. "Why's living the simple life so bloody hard?": a whip-pan (beat) along the page to a deadpan
//      chart, EFFORT vs. RESULT. The effort bar climbs a step per beat while the result stays a red stub;
//      on "bloody" effort breaks through the top of the chart, and "so bloody hard?" slams across the
//      foot of the page on its words (shake).
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { F, font, layout } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { clamp, ease, lerp, prog, hash, noise1, smoothstep, TAU } from '../engine/util';
import { Ground, PAPER_POST, drawKaraokeWords, drawPlateHead, footnote, fg, RED, wordIn, type C2D, type KaraokeStyle } from './_kit';

const LYR = F.archivo(87.5, 800);
const SLAM = F.archivo(112.5, 900);
const TIP0 = { x: 712, y: 606 }; // spout tip (kettle space)
const KS = 1.2, KAX = 360, KAY = 962; // the kettle group is drawn scaled about this anchor
const TS = 1.2; // and the toast about (TOAST.x, KAY)
const TIP = { x: KAX + (TIP0.x - KAX) * KS, y: KAY + (TIP0.y - KAY) * KS };
const TOAST = { x: 1360, top: 586, bot: 930 };
const TOAST_TOP = KAY + (TOAST.top - KAY) * TS;
const ROW_X = 500, ROW_Y = [300, 412];
const bone = (a = 1) => `rgba(241,235,221,${a})`;
const ink = (a = 1) => `rgba(12,12,14,${a})`;
const BLOOD = (a = 1) => `rgba(163,23,14,${a})`;
const EMBER = (a = 1) => `rgba(255,122,74,${a})`;

type Flier = { w: Word; x: number; y: number; from: { x: number; y: number }; ctrl: { x: number; y: number } };

export default class Kettle extends Scene {
  g = new Ground();
  L = new Layer2D();
  L1!: Line; L2!: Line;
  B: number[] = [];
  body!: Path2D; spout!: Path2D; lid!: Path2D; slice!: Path2D; crust!: Path2D;
  fliers: Flier[] = [];
  sizeA = 88; sizeB = 104; sizeS = 160;
  rowsB: Word[][] = [];
  tBoil = 0; tOver = 0; tToast = 0; tChar = 0; tBloody = 0; tHard = 0; tLife = 0;
  stipple: { x: number; y: number; r: number }[] = [];

  override init() {
    const { lyrics, audio, start } = this.ctx;
    this.L1 = lyrics.get("The kettle's boiling");
    this.L2 = lyrics.get('simple life so bloody');
    const b0 = Math.round(audio.beatAt(start));
    for (let k = 0; k <= 18; k++) this.B.push(audio.timeOfBeat(b0 + k));
    this.tBoil = wordIn(this.L1, 'boiling').start;
    this.tOver = wordIn(this.L1, 'over').start;
    this.tToast = wordIn(this.L1, 'toast').start;
    this.tChar = wordIn(this.L1, 'charred').start;
    this.tBloody = wordIn(this.L2, 'bloody').start;
    this.tHard = wordIn(this.L2, 'hard').start;
    this.tLife = wordIn(this.L2, 'life').start;

    // kettle (stovetop, side view)
    const b = new Path2D();
    b.moveTo(214, 930); b.bezierCurveTo(150, 820, 200, 664, 300, 642); b.lineTo(480, 642);
    b.bezierCurveTo(580, 664, 630, 820, 566, 930); b.closePath();
    this.body = b;
    const s = new Path2D();
    s.moveTo(548, 868); s.bezierCurveTo(626, 846, 652, 700, 698, 598); s.lineTo(720, 612);
    s.bezierCurveTo(684, 724, 650, 878, 560, 906); s.closePath();
    this.spout = s;
    const l = new Path2D();
    l.moveTo(304, 646); l.quadraticCurveTo(390, 596, 476, 646); l.closePath();
    this.lid = l;
    // toast slice
    const tx = TOAST.x, sl = new Path2D();
    sl.moveTo(tx - 140, 930); sl.lineTo(tx - 146, 704); sl.bezierCurveTo(tx - 196, 640, tx - 140, 574, tx - 62, 594);
    sl.bezierCurveTo(tx - 30, 572, tx + 30, 572, tx + 62, 594); sl.bezierCurveTo(tx + 140, 574, tx + 196, 640, tx + 146, 704);
    sl.lineTo(tx + 140, 930); sl.closePath();
    this.slice = sl;
    const cr = new Path2D();
    cr.moveTo(tx - 122, 914); cr.lineTo(tx - 128, 708); cr.bezierCurveTo(tx - 170, 652, tx - 124, 598, tx - 60, 614);
    cr.bezierCurveTo(tx - 28, 594, tx + 28, 594, tx + 60, 614); cr.bezierCurveTo(tx + 124, 598, tx + 170, 652, tx + 128, 708);
    cr.lineTo(tx + 122, 914); cr.closePath();
    this.crust = cr;
    for (let i = 0; i < 420; i++) this.stipple.push({ x: tx + (hash(i, 41) - 0.5) * 250, y: 610 + hash(i, 42) * 300, r: 0.6 + hash(i, 43) * 1.1 });

    // lyric line 1 laid out in two rows; each word flies in from the steam (row 1) or the toast (row 2)
    const fit = (rows: Word[][], fam: string, w: number, max: number) => {
      let sz = max;
      for (const r of rows) sz = Math.min(sz, (100 * w) / layout(r.map((x) => x.w).join(' '), fam, 100).width);
      return Math.floor(sz);
    };
    const r1 = this.L1.words.slice(0, 4), r2 = this.L1.words.slice(4);
    this.sizeA = fit([r1, r2], LYR, 1820 - ROW_X, 96);
    const cvs = document.createElement('canvas').getContext('2d')!;
    cvs.font = font(LYR, this.sizeA);
    const space = cvs.measureText(' ').width;
    [r1, r2].forEach((row, ri) => {
      let x = ROW_X;
      for (const w of row) {
        const wd = layout(w.w, LYR, this.sizeA).width;
        const from = ri === 0 ? { x: TIP.x + 10, y: TIP.y - 20 } : { x: TOAST.x, y: TOAST_TOP - 14 };
        const ctrl = ri === 0 ? { x: TIP.x + 60 + (x - ROW_X) * 0.3, y: ROW_Y[0]! + 160 } : { x: (TOAST.x + x + wd / 2) / 2, y: TOAST_TOP - 90 };
        this.fliers.push({ w, x, y: ROW_Y[ri]!, from, ctrl });
        x += wd + space;
      }
    });

    // line 2: two rows at left, the slam row across the foot
    const ws = this.L2.words;
    this.rowsB = [ws.slice(0, 2), ws.slice(2, 5), ws.slice(5)]; // Why's living / the simple life / so bloody hard?
    this.sizeB = fit(this.rowsB.slice(0, 2), LYR, 900, 116);
    this.sizeS = fit([this.rowsB[2]!], SLAM, 1600, 190);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, B = this.B;
    this.g.render(renderer, out, { paper: 1, grid: 0, vig: 0.24 });
    const c = this.L.ctx; this.L.clear();

    // whip-pan to the chart on the beat before "Why's"
    const tW = B[8]!;
    const pan = prog(t, tW, tW + 0.42, ease.outExpo);
    drawPlateHead(c, 4, 'Breakfast, engraved', (t - this.ctx.start) / 0.6, { right: pan < 0.5 ? 'FIG. 1 — THE KITCHEN, 07:58' : 'FIG. 2 — EFFORT vs. RESULT' });

    if (pan < 1) {
      c.save();
      const zoom = 1 + 0.015 * prog(t, B[1]!, B[1]! + 0.4, ease.outExpo) + 0.015 * prog(t, B[5]!, B[5]! + 0.4, ease.outExpo);
      c.translate(-pan * 1920, 0);
      c.translate(960, 600); c.scale(zoom, zoom); c.translate(-960, -600);
      this.drawKitchen(c, t);
      c.restore();
      c.save(); c.translate(-pan * 1920, 0);
      footnote(c, '⁵ Source: the kettle. Toast measured from the top; n = 1 slice.', 96, 1032);
      c.restore();
    }
    if (pan > 0) {
      c.save();
      c.translate((1 - pan) * 1920, 0);
      this.drawChart(c, t);
      c.restore();
    }

    comp.draw(renderer, this.L.upload(), out);

    // hits: the spill on "over", the slams on "bloody" and "hard?"
    const hit = (t0: number, k = 9) => (t >= t0 ? Math.exp(-(t - t0) * k) : 0);
    const sh = hit(this.tBloody, 10) * 9 + hit(this.tHard, 9) * 14;
    const ph = (t - (t >= this.tHard ? this.tHard : this.tBloody)) * 70;
    return {
      ...PAPER_POST,
      zoom: 1 + 0.012 * hit(this.tOver) + 0.02 * hit(this.tBloody) + 0.03 * hit(this.tHard),
      shake: [Math.sin(ph) * sh, Math.cos(ph * 1.3) * sh * 0.6],
    };
  }

  // ============================================================ A. the kitchen
  drawKitchen(c: C2D, t: number) {
    const B = this.B;
    const k0 = prog(t, B[0]!, B[0]! + 0.5, ease.outExpo);
    // wall tiles (faint) and the worktop
    c.strokeStyle = fg(true, 0.07); c.lineWidth = 1;
    c.beginPath();
    for (let x = 96; x <= 1824; x += 72) { c.moveTo(x, 470); c.lineTo(x, 960); }
    for (let y = 474; y <= 960; y += 72) { c.moveTo(96, y); c.lineTo(1824, y); }
    c.stroke();
    c.strokeStyle = fg(true, 0.9); c.lineWidth = 3;
    c.beginPath(); c.moveTo(96, 962); c.lineTo(96 + 1728 * k0, 962); c.stroke();
    c.save(); c.beginPath(); c.rect(96, 963, 1728 * k0, 34); c.clip();
    c.strokeStyle = fg(true, 0.3); c.lineWidth = 1; c.beginPath();
    for (let x = 80; x < 1850; x += 6) { c.moveTo(x, 997); c.lineTo(x + 34, 963); }
    c.stroke(); c.restore();

    c.save();
    c.translate(KAX, KAY); c.scale(KS, KS); c.translate(-KAX, -KAY);
    this.drawHob(c, t);
    this.drawSteam(c, t);
    this.drawKettle(c, t);
    c.restore();
    c.save();
    c.translate(TOAST.x, KAY); c.scale(TS, TS); c.translate(-TOAST.x, -KAY);
    this.drawToast(c, t);
    c.restore();
    this.drawLegend(c, t);
    this.drawWords(c, t);
  }

  drawHob(c: C2D, t: number) {
    // burner ring + gas flames (red), flickering on the hats, taller on the kicks
    const cx = 390, y = 944;
    c.strokeStyle = fg(true, 0.85); c.lineWidth = 2;
    c.beginPath(); c.ellipse(cx, y + 6, 190, 12, 0, 0, TAU); c.stroke();
    const kick = this.ctx.audio.hit('kick', t, 0.1);
    for (let i = 0; i < 11; i++) {
      const x = cx - 170 + i * 34;
      const h = 14 + 8 * noise1(t * 9 + i * 3.1, 5) + 9 * kick;
      c.fillStyle = RED(0.9);
      c.beginPath(); c.moveTo(x - 6, y); c.quadraticCurveTo(x - 6, y - h * 0.5, x, y - h); c.quadraticCurveTo(x + 6, y - h * 0.5, x + 6, y); c.closePath(); c.fill();
      c.fillStyle = EMBER(0.9);
      c.beginPath(); c.moveTo(x - 2.5, y); c.quadraticCurveTo(x - 2.5, y - h * 0.3, x, y - h * 0.5); c.quadraticCurveTo(x + 2.5, y - h * 0.3, x + 2.5, y); c.closePath(); c.fill();
    }
  }

  drawKettle(c: C2D, t: number) {
    const B = this.B;
    const k = lerp(0.86, 1, prog(t, B[0]!, B[0]! + 0.4, (x) => ease.outBack(x, 3)));
    c.save();
    c.translate(390, 930); c.scale(1, k); c.translate(-390, -930);
    // handle (behind)
    c.lineCap = 'round';
    c.strokeStyle = fg(true, 0.95); c.lineWidth = 18;
    c.beginPath(); c.moveTo(270, 668); c.bezierCurveTo(250, 462, 530, 462, 510, 668); c.stroke();
    c.strokeStyle = bone(); c.lineWidth = 11; c.stroke();
    c.strokeStyle = fg(true, 0.6); c.lineWidth = 1; c.setLineDash([2, 5]); c.stroke(); c.setLineDash([]);
    // spout
    c.fillStyle = bone(); c.fill(this.spout);
    c.save(); c.clip(this.spout);
    c.strokeStyle = fg(true, 0.55); c.lineWidth = 1; c.beginPath();
    for (let i = 0; i < 40; i++) { const y = 600 + i * 8; c.moveTo(540, y); c.lineTo(730, y - 30); }
    c.stroke(); c.restore();
    c.strokeStyle = fg(true, 0.95); c.lineWidth = 2.2; c.stroke(this.spout);
    // body with contour hatching (light from the left)
    c.fillStyle = bone(); c.fill(this.body);
    c.save(); c.clip(this.body);
    for (let x = 160; x < 640; x += 5) {
      const d = x - 390;
      if (d > -130 && d < -92) continue; // specular stripe
      const lw = 0.35 + 2.1 * smoothstep(-60, 190, d);
      c.lineWidth = lw; c.strokeStyle = fg(true, 0.75);
      c.beginPath(); c.moveTo(x, 640); c.quadraticCurveTo(x + d * 0.18, 790, x, 935); c.stroke();
    }
    // base band
    c.strokeStyle = fg(true, 0.7); c.lineWidth = 1; c.beginPath();
    for (let y = 904; y < 930; y += 3) { c.moveTo(150, y); c.lineTo(640, y); }
    c.stroke();
    c.restore();
    c.strokeStyle = fg(true, 0.95); c.lineWidth = 2.6; c.stroke(this.body);
    c.lineWidth = 1.5; c.beginPath(); c.moveTo(196, 903); c.lineTo(584, 903); c.stroke();
    // spill on "over": drips run down the body from under the lid
    if (t >= this.tOver) {
      for (let i = 0; i < 5; i++) {
        const x0 = 312 + i * 40 + hash(i, 51) * 14;
        const len = (40 + 90 * hash(i, 52)) * prog(t, this.tOver + i * 0.04, this.tOver + 0.6 + i * 0.04, ease.outCubic);
        if (len <= 0) continue;
        c.strokeStyle = bone(); c.lineWidth = 7; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x0, 652); c.lineTo(x0 + (x0 - 390) * 0.12, 652 + len); c.stroke();
        c.strokeStyle = fg(true, 0.9); c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(x0 - 3.5, 652); c.lineTo(x0 - 3.5 + (x0 - 390) * 0.12, 652 + len); c.arc(x0 + (x0 - 390) * 0.12, 652 + len, 3.5, Math.PI, 0, true); c.lineTo(x0 + 3.5, 652); c.stroke();
      }
    }
    // splash on "over": droplets thrown from under the lid
    if (t >= this.tOver && t < this.tOver + 0.9) {
      const age = t - this.tOver;
      c.fillStyle = fg(true, 0.85 * (1 - age / 0.9));
      c.beginPath();
      for (let i = 0; i < 14; i++) {
        const side = i % 2 ? 1 : -1;
        const vx = side * (90 + 220 * hash(i, 81)), vy = -(160 + 260 * hash(i, 82));
        const x = 390 + side * (60 + 30 * hash(i, 83)) + vx * age, y = 640 + vy * age + 900 * age * age;
        const r = 2 + 3 * hash(i, 84);
        c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU);
      }
      c.fill();
    }
    // lid: rattles on every beat from "boiling" (and on the kicks)
    let lift = 0, tilt = 0;
    if (t >= this.tBoil) {
      const bp = this.ctx.audio.beatAt(t);
      const ph = bp - Math.floor(bp);
      lift = 9 * Math.exp(-ph * 7) + 5 * this.ctx.audio.hit('snare', t, 0.08);
      tilt = (Math.floor(bp) % 2 ? 1 : -1) * 0.05 * Math.exp(-ph * 6);
      if (t >= this.tOver) lift += 22 * Math.exp(-(t - this.tOver) * 5);
    }
    c.save();
    c.translate(390, 646 - lift); c.rotate(tilt); c.translate(-390, -646);
    c.fillStyle = bone(); c.fill(this.lid);
    c.save(); c.clip(this.lid);
    c.strokeStyle = fg(true, 0.6); c.lineWidth = 1; c.beginPath();
    for (let x = 300; x < 480; x += 5) { c.moveTo(x, 600); c.lineTo(x, 650); }
    c.stroke(); c.restore();
    c.strokeStyle = fg(true, 0.95); c.lineWidth = 2.2; c.stroke(this.lid);
    c.beginPath(); c.moveTo(380, 616); c.lineTo(380, 606); c.moveTo(400, 616); c.lineTo(400, 606); c.stroke();
    c.fillStyle = bone(); c.beginPath(); c.arc(390, 598, 15, 0, TAU); c.fill(); c.stroke();
    c.lineWidth = 1; c.beginPath(); c.arc(390, 598, 15, Math.PI * 0.1, Math.PI * 0.9); c.stroke();
    c.restore();
    c.restore();
  }

  /** Steam intensity: rises with the kettle, peaks at the boil-over. */
  steamK(t: number) {
    return clamp(0.3 + prog(t, this.B[0]!, this.tBoil, ease.outCubic) * 0.3 + prog(t, this.tBoil, this.tOver, ease.linear) * 0.4 + (t >= this.tOver ? 0.3 * Math.exp(-(t - this.tOver) * 2) : 0), 0, 1.3);
  }

  drawSteam(c: C2D, t: number) {
    const k = this.steamK(t);
    if (k <= 0) return;
    c.lineCap = 'round';
    const n = 7;
    for (let j = 0; j < n; j++) {
      const ph = hash(j, 61) * TAU, spread = (j - (n - 1) / 2) * 7;
      c.beginPath();
      for (let i = 0; i <= 44; i++) {
        const s = i / 44;
        const up = s * 300 * (0.6 + 0.4 * k);
        const x = TIP0.x + spread * (0.4 + s) + s * 90 + s * s * 160 + Math.sin(s * 8 - t * 5.2 + ph) * 20 * s;
        const y = TIP0.y - 12 - up;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      const grd = c.createLinearGradient(0, TIP0.y, 0, TIP0.y - 330);
      const a0 = 0.32 * k + 0.1 * (j % 2);
      grd.addColorStop(0, fg(true, a0)); grd.addColorStop(0.55, fg(true, a0 * 0.6)); grd.addColorStop(1, fg(true, 0));
      c.strokeStyle = grd; c.lineWidth = 1.2;
      c.stroke();
    }
    // puffs: outlined loops drifting up, born on the eighths
    const rate = 1 / ((this.B[1]! - this.B[0]!) / 2);
    const n0 = Math.floor((t - 1.2) * rate), n1 = Math.floor(t * rate);
    for (let m = n0; m <= n1; m++) {
      const tb = m / rate;
      if (tb > t || tb < this.B[0]!) continue;
      const age = t - tb;
      if (age > 1.2) continue;
      const kk = this.steamK(tb);
      if (kk <= 0.05) continue;
      const x = TIP0.x + 20 + age * 120 + age * age * 80 + (hash(m, 62) - 0.5) * 30;
      const y = TIP0.y - 30 - age * 260;
      const r = 8 + age * 26 * (0.6 + hash(m, 63));
      c.strokeStyle = fg(true, 0.45 * kk * (1 - age / 1.2)); c.lineWidth = 1.2;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      c.beginPath(); c.arc(x + r * 0.7, y + r * 0.2, r * 0.6, 0, TAU); c.stroke();
    }
  }

  drawToast(c: C2D, t: number) {
    const B = this.B, tx = TOAST.x;
    const k = prog(t, B[1]!, B[1]! + 0.4, ease.outBack);
    if (k <= 0) return;
    c.save();
    c.translate(tx, 930); c.scale(1, k); c.translate(-tx, -930);
    // toast rack wires
    c.strokeStyle = fg(true, 0.85); c.lineWidth = 2;
    c.beginPath(); c.moveTo(tx - 230, 930); c.lineTo(tx - 230, 760); c.arc(tx - 200, 760, 30, Math.PI, 0); c.lineTo(tx - 170, 930); c.stroke();
    // slice
    const brown = prog(t, this.tToast, this.tChar, ease.inQuad);
    c.fillStyle = bone(); c.fill(this.slice);
    c.save(); c.clip(this.slice);
    // crust band: dense hatch between the outline and the crumb
    c.strokeStyle = fg(true, 0.55); c.lineWidth = 1; c.beginPath();
    for (let x = tx - 220; x < tx + 220; x += 4) { c.moveTo(x, 560); c.lineTo(x + 40, 940); }
    c.stroke();
    c.fillStyle = bone(); c.fill(this.crust);
    // crumb stipple
    c.save(); c.clip(this.crust);
    c.fillStyle = fg(true, 0.5);
    c.beginPath();
    for (const s of this.stipple) { c.moveTo(s.x + s.r, s.y); c.arc(s.x, s.y, s.r, 0, TAU); }
    c.fill();
    // browning: diagonal hatch, denser and darker as it toasts
    if (brown > 0) {
      c.strokeStyle = fg(true, 0.12 + 0.3 * brown); c.lineWidth = 0.6 + 0.8 * brown; c.beginPath();
      for (let x = tx - 400; x < tx + 400; x += 10 - 4 * brown) { c.moveTo(x, 940); c.lineTo(x + 360, 580); }
      c.stroke();
    }
    c.restore();
    // the top fifth chars on "charred": red with a blood crosshatch, burning down from the crown
    const ck = prog(t, this.tChar, this.tChar + 0.35, ease.outExpo);
    const yF = TOAST.top + (TOAST.bot - TOAST.top) * 0.2;
    if (ck > 0) {
      const yc = lerp(TOAST.top - 10, yF, ck);
      c.save(); c.beginPath(); c.rect(tx - 250, 500, 500, yc - 500); c.clip();
      c.fillStyle = RED(); c.fillRect(tx - 250, 500, 500, 300);
      c.strokeStyle = BLOOD(0.85); c.lineWidth = 1.2; c.beginPath();
      for (let x = tx - 300; x < tx + 300; x += 6) { c.moveTo(x, 700); c.lineTo(x + 160, 540); c.moveTo(x, 540); c.lineTo(x + 160, 700); }
      c.stroke();
      // ember speckles
      c.fillStyle = EMBER(0.9);
      for (let i = 0; i < 40; i++) { const x = tx + (hash(i, 71) - 0.5) * 300, y = TOAST.top + hash(i, 72) * (yF - TOAST.top); c.fillRect(x, y, 2, 2); }
      c.restore();
      // the char line
      c.strokeStyle = BLOOD(); c.lineWidth = 2;
      c.beginPath();
      for (let x = tx - 200; x <= tx + 200; x += 8) c.lineTo(x, yc + Math.sin(x * 0.21) * 3 + (hash(x, 73) - 0.5) * 3);
      c.stroke();
    }
    c.restore();
    c.strokeStyle = fg(true, 0.95); c.lineWidth = 2.6; c.stroke(this.slice);
    c.lineWidth = 1; c.stroke(this.crust);
    // second rack wire (in front) and the base rail
    c.strokeStyle = fg(true, 0.85); c.lineWidth = 2;
    c.beginPath(); c.moveTo(tx + 170, 930); c.lineTo(tx + 170, 760); c.arc(tx + 200, 760, 30, Math.PI, 0); c.lineTo(tx + 230, 930); c.stroke();
    c.lineWidth = 5; c.beginPath(); c.moveTo(tx - 250, 932); c.lineTo(tx + 250, 932); c.stroke();
    c.restore();

    // smoke wisps after the char
    if (t >= this.tChar) {
      const sk = prog(t, this.tChar, this.tChar + 0.6);
      for (let j = 0; j < 4; j++) {
        c.beginPath();
        for (let i = 0; i <= 30; i++) {
          const s = i / 30;
          const x = tx - 60 + j * 40 + Math.sin(s * 6 - t * 4 + j) * 12 * s;
          const y = TOAST.top - 6 - s * 110 * sk;
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.strokeStyle = fg(true, 0.3 * (1 - j * 0.15)); c.lineWidth = 1; c.stroke();
      }
    }

    // dimension bracket: 20% charred / 80% edible
    const dk = prog(t, this.tChar + 0.1, this.tChar + 0.5, ease.outExpo);
    const lk = prog(t, this.tToast, this.tToast + 0.4, ease.outExpo);
    if (lk > 0) {
      const X = tx + 250;
      const yF = TOAST.top + (TOAST.bot - TOAST.top) * 0.2;
      c.lineWidth = 1.2;
      c.strokeStyle = fg(true, 0.6 * lk);
      c.beginPath(); c.moveTo(X, yF); c.lineTo(X, lerp(yF, TOAST.bot, lk)); c.moveTo(X - 7, TOAST.bot); c.lineTo(X + 7, TOAST.bot); c.stroke();
      c.font = font(F.mono(600), 15);
      c.save(); c.translate(X + 20, (yF + TOAST.bot) / 2); c.rotate(-Math.PI / 2);
      c.textAlign = 'center'; c.fillStyle = fg(true, 0.7 * lk); c.fillText('80% EDIBLE', 0, 6); c.restore();
      if (dk > 0) {
        c.strokeStyle = RED(dk); c.lineWidth = 2;
        c.beginPath(); c.moveTo(X, yF); c.lineTo(X, lerp(yF, TOAST.top, dk)); c.moveTo(X - 7, TOAST.top); c.lineTo(X + 7, TOAST.top); c.moveTo(X - 7, yF); c.lineTo(X + 7, yF); c.stroke();
        c.fillStyle = RED(dk); c.textAlign = 'left';
        c.fillText('20% CHARRED', X + 16, (TOAST.top + yF) / 2 + 6);
      }
      c.textAlign = 'left';
    }
  }

  /** Engraver's callouts: italic letters on leaders, and the key to them. */
  drawLegend(c: C2D, t: number) {
    const B = this.B;
    const items: [string, string, number, number, number, number, number][] = [
      // letter, legend, appear time, anchor x,y, letter x,y
      ['a', 'Kettle; boiling over', B[2]!, 300, 760, 236, 660],
      ['b', 'Steam; carrying the words', this.tBoil, TIP.x + 40, TIP.y - 90, TIP.x + 120, TIP.y - 40],
      ['c', 'Toast; top fifth charred', this.tToast, TOAST.x - 160, 540, TOAST.x - 250, 500],
    ];
    const LX = 830, LY = 610;
    let row = 0;
    for (const [ch, txt, t0, ax, ay, lx, ly] of items) {
      const k = prog(t, t0, t0 + 0.35, ease.outExpo);
      if (k <= 0) continue;
      c.strokeStyle = fg(true, 0.5 * k); c.lineWidth = 1;
      c.beginPath(); c.moveTo(lx + 8, ly - 6); c.lineTo(lerp(lx + 8, ax, k), lerp(ly - 6, ay, k)); c.stroke();
      c.fillStyle = fg(true, 0.85 * k); c.beginPath(); c.arc(ax, ay, 2.5 * k, 0, TAU); c.fill();
      c.font = font(F.serif(600, true), 30); c.textAlign = 'center';
      c.fillStyle = bone(k); c.fillRect(lx - 4, ly - 26, 24, 30);
      c.fillStyle = fg(true, 0.9 * k); c.fillText(ch, lx + 8, ly);
      // key
      c.textAlign = 'left';
      c.font = font(F.serif(600, true), 22); c.fillText(ch + '.', LX, LY + row * 30);
      c.font = font(F.mono(400), 14); c.fillStyle = fg(true, 0.7 * k);
      c.fillText(txt.slice(0, Math.ceil(txt.length * k)), LX + 28, LY + row * 30);
      row++;
    }
  }

  drawWords(c: C2D, t: number) {
    const st: KaraokeStyle = { family: LYR, size: this.sizeA, paper: true, pop: 0.03, lead: 0.4 };
    for (const fl of this.fliers) {
      const w = fl.w;
      const t1 = w.start - 0.02, t0 = Math.max(w.start - 0.4, this.ctx.start - 0.05);
      if (t < t0) continue;
      const u = prog(t, t0, t1, ease.outCubic);
      const x = (1 - u) * (1 - u) * fl.from.x + 2 * (1 - u) * u * fl.ctrl.x + u * u * (fl.x + 20);
      const y = (1 - u) * (1 - u) * fl.from.y + 2 * (1 - u) * u * fl.ctrl.y + u * u * fl.y;
      const sc = lerp(0.25, 1, ease.outCubic(u));
      c.save();
      c.translate(x, y); c.scale(sc, sc);
      c.globalAlpha = clamp(u * 2.5);
      // a wobble while it rides the steam
      c.rotate((1 - u) * Math.sin(t * 9 + w.gi) * 0.25);
      drawKaraokeWords(c, [w], t, u < 1 ? -20 * u : -20, 0, st);
      c.restore();
    }
  }

  // ============================================================ B. effort vs. result
  drawResultIcons(c: C2D, x: number, y: number) {
    c.save();
    c.lineWidth = 1.5; c.strokeStyle = fg(true, 0.9); c.fillStyle = bone();
    // cup
    c.beginPath(); c.moveTo(x - 52, y - 30); c.lineTo(x - 48, y); c.lineTo(x - 20, y); c.lineTo(x - 16, y - 30); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.arc(x - 14, y - 18, 7, -Math.PI / 2, Math.PI / 2); c.stroke();
    c.strokeStyle = fg(true, 0.4); c.beginPath(); c.moveTo(x - 38, y - 36); c.quadraticCurveTo(x - 30, y - 44, x - 36, y - 50); c.stroke();
    // toast slice
    const sx = x + 30, h = 40, w = 34;
    const p = new Path2D();
    p.moveTo(sx - w / 2, y); p.lineTo(sx - w / 2, y - h * 0.75); p.bezierCurveTo(sx - w / 2 - 8, y - h, sx, y - h - 6, sx, y - h);
    p.bezierCurveTo(sx, y - h - 6, sx + w / 2 + 8, y - h, sx + w / 2, y - h * 0.75); p.lineTo(sx + w / 2, y); p.closePath();
    c.fillStyle = bone(); c.fill(p);
    c.save(); c.clip(p); c.fillStyle = RED(); c.fillRect(sx - w, y - h - 8, 2 * w, h * 0.2 + 8); c.restore();
    c.strokeStyle = fg(true, 0.9); c.stroke(p);
    c.restore();
  }

  /** Effort bar height (0..1 of the chart, >1 off it): a step per beat, then through the roof on "bloody". */
  effortAt(t: number) {
    const B = this.B;
    let h = 0.06;
    for (let i = 9; i <= 13; i++) h += 0.13 * prog(t, B[i]!, B[i]! + 0.22, (x) => ease.outBack(x, 2));
    h += 0.75 * prog(t, this.tBloody, this.tBloody + 0.3, ease.outExpo);
    h += 0.25 * prog(t, this.tHard, this.tHard + 0.2, ease.outExpo);
    return h;
  }

  drawChart(c: C2D, t: number) {
    const B = this.B;
    // left: line 2, rows 1–2
    const X = 96;
    c.strokeStyle = fg(true, 0.5); c.lineWidth = 1;
    c.beginPath(); c.moveTo(X, 300); c.lineTo(1000, 300); c.stroke();
    c.font = font(F.mono(500), 13); c.fillStyle = fg(true, 0.7);
    c.fillText('FIG. 2 — EFFORT vs. RESULT, A STUDY', X, 288);
    
    const st: KaraokeStyle = { family: LYR, size: this.sizeB, paper: true, pop: 0.03, lead: 0.4 };
    drawKaraokeWords(c, this.rowsB[0]!, t, X, 420, st);
    drawKaraokeWords(c, this.rowsB[1]!, t, X, 420 + this.sizeB * 1.1, st);
    // the slam row across the foot: "so bloody hard?" — big words pop hard on their starts
    c.save();
    drawKaraokeWords(c, this.rowsB[2]!, t, X - 6, 900, { family: SLAM, size: this.sizeS, paper: true, pop: 0.07, space: 0.34, lead: this.rowsB[2]![0]!.start - this.L2.start + 0.3, dim: 0.12 });
    c.restore();

    // the chart (right)
    const x0 = 1180, x1 = 1800, yb = 720, yt = 250, H = yb - yt;
    const k = prog(t, B[8]! + 0.2, B[8]! + 0.7, ease.outExpo);
    c.strokeStyle = fg(true, 0.9); c.lineWidth = 2;
    c.beginPath(); c.moveTo(x0, yt - 20); c.lineTo(x0, yb); c.lineTo(lerp(x0, x1, k), yb); c.stroke();
    // y ticks
    c.font = font(F.mono(500), 12); c.fillStyle = fg(true, 0.55); c.textAlign = 'right';
    c.lineWidth = 1; c.strokeStyle = fg(true, 0.15);
    for (let i = 0; i <= 5; i++) {
      const y = yb - (i / 5) * H;
      c.beginPath(); c.moveTo(x0 - 6, y); c.lineTo(lerp(x0, x1, k), y); c.stroke();
      c.fillText(`${i * 20}`, x0 - 12, y + 4);
    }
    c.save(); c.translate(x0 - 52, (yt + yb) / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center';
    c.fillText('UNITS (ARBITRARY, EXHAUSTING)', 0, 0); c.restore();
    c.textAlign = 'center';
    // effort bar: hatched graphite, steps on the beats, bursts through the top
    const eh = this.effortAt(t) * k;
    const ex = 1280, bw = 170;
    const top = yb - eh * H;
    const roof = 130;
    const ey = Math.max(top, roof);
    c.fillStyle = 'rgba(94,91,87,0.9)'; c.fillRect(ex, ey, bw, yb - ey);
    c.save(); c.beginPath(); c.rect(ex, ey, bw, yb - ey); c.clip();
    c.strokeStyle = bone(0.35); c.lineWidth = 1; c.beginPath();
    for (let y = ey - bw; y < yb; y += 7) { c.moveTo(ex, y + bw); c.lineTo(ex + bw, y); }
    c.stroke(); c.restore();
    c.strokeStyle = fg(true, 0.95); c.lineWidth = 2; c.strokeRect(ex, ey, bw, yb - ey);
    if (top < roof + 2) {
      // off the chart: torn top + arrow
      c.fillStyle = fg(true, 0.9);
      c.beginPath(); c.moveTo(ex + bw / 2, roof - 44); c.lineTo(ex + bw / 2 + 16, roof - 18); c.lineTo(ex + bw / 2 - 16, roof - 18); c.closePath(); c.fill();
      c.fillRect(ex + bw / 2 - 2, roof - 20, 4, 18);
      c.font = font(F.mono(600), 14); c.textAlign = 'left';
      c.fillText('OFF THE CHART', ex + bw + 16, roof - 22);
    }
    // the chart frame's top is broken where the bar went through
    // result bar: a red stub
    const rx = 1560;
    const rh = (0.035 + 0.02 * prog(t, this.tLife, this.tLife + 0.3, ease.outBack)) * k;
    c.fillStyle = RED(); c.fillRect(rx, yb - rh * H, bw, rh * H);
    c.font = font(F.mono(600), 15); c.fillStyle = fg(true, 0.85); c.textAlign = 'center';
    c.fillText('EFFORT', ex + bw / 2, yb + 30);
    c.fillStyle = RED(); c.fillText('RESULT', rx + bw / 2, yb + 30);
    c.font = font(F.mono(400), 12); c.fillStyle = fg(true, 0.6);
    c.fillText('1 TEA, 1 TOAST', rx + bw / 2, yb - rh * H - 84);
    c.fillText('(SEE FIG. 1)', rx + bw / 2, yb - rh * H - 66);
    // live readout of the ratio
    const ratio = Math.round((eh / Math.max(1e-3, eh + rh)) * 100);
    c.textAlign = 'right'; c.font = font(F.mono(500), 13); c.fillStyle = fg(true, 0.6);
    c.fillText(`EFFORT SHARE ${String(ratio).padStart(2, '0')}%`, 1000, 288);
    c.textAlign = 'left';
    // the result itself, on its stub: one cup, one slice (top fifth charred)
    this.drawResultIcons(c, rx + bw / 2, yb - rh * H - 2);
    footnote(c, '⁶ Four-fifths of the effort, one-fifth of the breakfast. Results not typical; results never typical.', 96, 1032);
  }
}
