// PLATE XIV `cut` — "Editing".
// Drum-fill build-up on bone paper laid on a black cutting mat. Every snare is a scissor cut: a red
// dashed line, the scissors run along it, and the sheet comes apart on the hit (the mat shows in the
// gaps). "Cut the fat!": the line is sliced; FAT! is cut letter-wise and the slivers drop off the page.
// "Trim the wire!": a 1.00 m wire is snipped to 0.20 m (sparks). "Set the twenty percent on fire!": the
// cut-up sheet is swept away; a fresh sheet carries the red fifth bar; the grey 80% is cut off during
// the drum break, the fifth glides to centre and on "fire!" it ignites (gold — the only fire in the
// video); when the band crashes back in the page burns away from it into the dark of the solo.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font, measure } from '../engine/type';
import { type Line } from '../engine/lyrics';
import { clamp, lerp, ease, prog, hash, noise1, TAU, springStep, frameIdx } from '../engine/util';
import { Ground, PAPER_POST, drawPlateHead, fg, RED, wordIn, type C2D, type WordBox } from './_kit';
import { karaoke } from './bridge-karaoke';

type P = { x: number; y: number };
interface CutLine { t: number; a: P; b: P; d: P }
interface Piece { poly: P[]; off: P }

const BONE = '#F1EBDD';

/** Split a convex polygon by the line through a→b: [left, right] (right = positive side). */
function split(poly: P[], a: P, b: P): [P[], P[]] {
  const nx = -(b.y - a.y), ny = b.x - a.x;
  const side = (p: P) => (p.x - a.x) * nx + (p.y - a.y) * ny;
  const L: P[] = [], R: P[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
    const sp = side(p), sq = side(q);
    if (sp <= 0) L.push(p);
    if (sp >= 0) R.push(p);
    if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
      const k = sp / (sp - sq);
      const x = { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
      L.push(x); R.push(x);
    }
  }
  return [L, R];
}

export default class Cut extends Scene {
  g = new Ground();
  L = new Layer2D();
  G = new Layer2D(); // glow: flames, sparks, ember rims (composited additively, tinted > 1)
  sheet = new Layer2D(); // the printed sheet (drawn once per frame, then cut into pieces); never uploaded
  L1!: Line; L2!: Line;
  cuts: CutLine[] = [];
  tFat = 0; tWire = 0; tSweep = 0; tBar = 0; tSnip = 0; tIgnite = 0; tCrash = 0; tFill = 0;
  fatBox: WordBox | null = null;
  sizeA = 180; sizeB = 180; sizeC = 110; sizeD = 150;

  override init() {
    const { lyrics, audio } = this.ctx;
    const up = (l: Line): Line => ({ ...l, words: l.words.map((w) => ({ ...w, w: w.w.toUpperCase() })) });
    this.L1 = up(lyrics.get('Cut the fat'));
    this.L2 = up(lyrics.get('Set the twenty'));
    const sn = audio.events('snare', this.ctx.start - 0.05, this.ctx.end).map(([t]) => t);
    const near = (t: number) => sn.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a), sn[0] ?? t);
    const kick = audio.events('kick', this.ctx.start - 0.05, this.ctx.end).filter(([, s]) => s > 0.5).map(([t]) => t);
    const nearK = (t: number) => kick.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a), kick[0] ?? t);
    const cutW = wordIn(this.L1, 'cut'), fatW = wordIn(this.L1, 'fat'), wireW = wordIn(this.L1, 'wire');
    // the sheet cuts: on "Cut", then on the snares of the riffs
    const s1 = near(fatW.start + 0.2), s3 = near(fatW.end + 0.9), s4 = near(wireW.end), s5 = near(wireW.end + 0.6);
    this.cuts = [
      { t: cutW.start, a: { x: -60, y: 250 }, b: { x: W + 60, y: 560 }, d: { x: 14, y: 22 } },
      { t: s1, a: { x: 1290, y: -60 }, b: { x: 1150, y: H + 60 }, d: { x: 26, y: 4 } },
      { t: s3, a: { x: -60, y: 905 }, b: { x: W + 60, y: 845 }, d: { x: -6, y: 24 } },
      { t: s4, a: { x: 560, y: -60 }, b: { x: 760, y: H + 60 }, d: { x: -24, y: 8 } },
      { t: s5, a: { x: -60, y: 735 }, b: { x: W + 60, y: 770 }, d: { x: 10, y: -20 } },
    ];
    for (const ct of this.cuts) {
      const nx = -(ct.b.y - ct.a.y), ny = ct.b.x - ct.a.x;
      if (ct.d.x * nx + ct.d.y * ny < 0) ct.d = { x: -ct.d.x, y: -ct.d.y };
    }
    this.tFat = near(fatW.end + 0.3);              // FAT! is sliced and drops
    this.tWire = nearK(wireW.start + 0.15);        // the snip, on the kick inside "wire!"
    this.tSweep = this.L2.words[0]!.start - 0.04;  // "Set": the cut-up sheet is swept away
    const tw = wordIn(this.L2, 'twenty'), pc = wordIn(this.L2, 'percent'), fi = wordIn(this.L2, 'fire');
    this.tBar = tw.start;
    this.tSnip = nearK(pc.start + 0.05);           // the last kick before the drum break
    this.tIgnite = fi.start;
    const crash = audio.events('kick', fi.start + 0.6, fi.start + 2.0).find(([, s]) => s > 0.6);
    this.tCrash = crash ? crash[0] : fi.start + 1.33; // the band comes back in
    this.tFill = near(fi.start + 0.7);
    // type sizes
    const famA = F.archivo(112, 900);
    this.sizeA = Math.min(200, 200 * 1480 / measure('CUT THE FAT!', famA, 200));
    this.sizeB = Math.min(200, 200 * 1480 / measure('TRIM THE WIRE!', famA, 200));
    this.sizeC = Math.min(130, 130 * 1500 / measure('SET THE TWENTY PERCENT', famA, 130));
    this.sizeD = 150;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    this.g.render(renderer, out, { paper: 1, vig: 0.15 });
    const c = this.L.ctx; this.L.clear();
    const g = this.G.ctx; this.G.clear();
    const post: PostOverrides = { ...PAPER_POST };
    let glow = false;
    if (t < this.tSweep) this.partOne(f, c, g, post);
    else glow = this.partTwo(f, c, g, post);
    comp.draw(renderer, this.L.upload(), out);
    if (glow || (t >= this.tWire && t < this.tWire + 0.5)) comp.draw(renderer, this.G.upload(), out, { mode: 'add', tint: [1.5, 1.5, 1.5] });
    return post;
  }

  // ---------------------------------------------------------------- the sheet and its pieces
  pieces(t: number, upTo = Infinity): Piece[] {
    let ps: Piece[] = [{ poly: [{ x: -80, y: -80 }, { x: W + 80, y: -80 }, { x: W + 80, y: H + 80 }, { x: -80, y: H + 80 }], off: { x: 0, y: 0 } }];
    for (const ct of this.cuts) {
      if (t < ct.t || ct.t > upTo) continue;
      const e = ease.outExpo(clamp((t - ct.t) / 0.28));
      const next: Piece[] = [];
      for (const p of ps) {
        const [l, r] = split(p.poly, ct.a, ct.b);
        if (l.length >= 3) next.push({ poly: l, off: { ...p.off } });
        if (r.length >= 3) next.push({ poly: r, off: { x: p.off.x + ct.d.x * e, y: p.off.y + ct.d.y * e } });
      }
      ps = next;
    }
    return ps;
  }

  /** The black cutting mat (seen through the gaps): ink, a 40 px grid, ruler ticks. */
  drawMat(c: C2D) {
    c.fillStyle = '#121214'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(156,151,143,0.16)'; c.lineWidth = 1;
    c.beginPath();
    for (let x = 0; x <= W; x += 40) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, H); }
    for (let y = 0; y <= H; y += 40) { c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); }
    c.stroke();
    c.strokeStyle = 'rgba(156,151,143,0.35)';
    c.beginPath();
    for (let x = 0; x <= W; x += 10) { const l = x % 100 === 0 ? 14 : x % 50 === 0 ? 9 : 5; c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, l); }
    c.stroke();
  }

  /** Draw the sheet canvas through the pieces (holes punched to the paper ground, content shifted). */
  drawPieces(c: C2D, ps: Piece[], fly = 0, flyT = 0) {
    for (const p of ps) {
      let ox = p.off.x, oy = p.off.y, rot = 0;
      let cx = 0, cy = 0;
      if (fly > 0) {
        // swept off: each piece flies away from the centre along its own direction
        for (const v of p.poly) { cx += v.x; cy += v.y; }
        cx /= p.poly.length; cy /= p.poly.length;
        const dx = cx - 960 + (hash(cx, cy) - 0.5) * 300, dy = cy - 540 + (hash(cy, cx) - 0.5) * 200;
        const dl = Math.hypot(dx, dy) || 1;
        ox += (dx / dl) * 2200 * fly; oy += (dy / dl) * 1400 * fly + 900 * fly * fly;
        rot = (hash(cx * 3, cy) - 0.5) * 0.9 * fly;
      }
      const path = new Path2D();
      p.poly.forEach((v, i) => (i ? path.lineTo(v.x, v.y) : path.moveTo(v.x, v.y)));
      path.closePath();
      c.save();
      c.translate(ox, oy);
      if (rot) { c.translate(cx, cy); c.rotate(rot); c.translate(-cx, -cy); }
      // shadow on the mat
      c.save(); c.translate(3, 4); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill(path); c.restore();
      if (fly > 0 || flyT > 0) { c.fillStyle = BONE; c.fill(path); }
      else { c.globalCompositeOperation = 'destination-out'; c.fill(path); c.globalCompositeOperation = 'source-over'; }
      c.save(); c.clip(path);
      c.drawImage(this.sheet.canvas, 0, 0, W, H);
      c.restore();
      c.strokeStyle = 'rgba(12,12,14,0.25)'; c.lineWidth = 1; c.stroke(path);
      c.restore();
    }
  }

  /** Scissors (two blades, two rings), centred on the pivot, pointing along `ang`; `open` 0..1. */
  scissors(c: C2D, x: number, y: number, ang: number, open: number, s = 1, col = fg(true, 0.9)) {
    c.save();
    c.translate(x, y); c.rotate(ang); c.scale(s, s);
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2.2; c.lineJoin = 'round';
    for (const sg of [-1, 1]) {
      c.save();
      c.rotate(sg * 0.32 * open);
      // blade (forward), handle ring (back)
      c.beginPath(); c.moveTo(0, 0); c.lineTo(56, sg * 3); c.lineTo(0, sg * 9); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(0, sg * 4); c.lineTo(-18, sg * 12); c.stroke();
      c.beginPath(); c.ellipse(-30, sg * 17, 13, 9, sg * 0.35, 0, TAU); c.stroke();
      c.restore();
    }
    c.beginPath(); c.arc(0, 0, 3, 0, TAU); c.fillStyle = rgba('bone', 1); c.fill(); c.stroke();
    c.restore();
  }

  /** The cut about to happen: a red dashed line, the scissors running along it into the hit. */
  precut(c: C2D, t: number, t0: number, a: P, b: P, lead = 0.2) {
    const k = (t - (t0 - lead)) / lead;
    if (k < 0 || t > t0 + 0.12) return;
    const kk = clamp(k);
    c.save();
    c.setLineDash([10, 8]); c.lineDashOffset = -t * 120;
    c.strokeStyle = RED(0.9 * (t > t0 ? 1 - (t - t0) / 0.12 : 1)); c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    c.restore();
    if (t <= t0 + 0.05) {
      const e = ease.inOutCubic(kk);
      const x = lerp(a.x, b.x, e), y = lerp(a.y, b.y, e);
      this.scissors(c, x, y, Math.atan2(b.y - a.y, b.x - a.x), Math.abs(Math.sin(kk * Math.PI * 5)), 1.7);
    }
  }

  // ---------------------------------------------------------------- part one: cut the fat, trim the wire
  partOne(f: Frame, c: C2D, g: C2D, post: PostOverrides) {
    const t = f.t, L = this.L1;
    const s = this.sheet.ctx; this.sheet.clear();
    // --- the printed sheet
    drawPlateHead(s, 14, 'Editing', (t - this.ctx.start) / 0.6, { paper: true, right: 'CUT ALONG THE DOTTED LINES' });
    const famA = F.archivo(112, 900);
    const rowA = L.words.slice(0, 3), rowB = L.words.slice(3);
    const bA = karaoke(s, rowA, t, 960, 430, { family: famA, size: this.sizeA, paper: true, align: 'center', dim: 0.16, lead: 0.6 });
    this.fatBox = bA[2]!;
    karaoke(s, rowB, t, 960, 650, { family: famA, size: this.sizeB, paper: true, align: 'center', dim: 0.16, lead: 0.5 });
    // FAT! gone: an empty slot with an editor's note
    if (t >= this.tFat) {
      // repaint the slot (karaoke drew FAT! above): cover with paper, then the dashed outline
      const fb = this.fatBox;
      // the word is cut out of the page: a hole onto the mat
      const hx = fb.x - 6, hy = fb.y - this.sizeA * 0.80, hw = fb.width + 12, hh = this.sizeA * 0.86;
      s.save();
      s.fillStyle = '#121214'; s.fillRect(hx, hy, hw, hh);
      s.beginPath(); s.rect(hx, hy, hw, hh); s.clip();
      s.strokeStyle = 'rgba(156,151,143,0.16)'; s.lineWidth = 1; s.beginPath();
      for (let x = Math.ceil(hx / 40) * 40; x < hx + hw; x += 40) { s.moveTo(x + 0.5, hy); s.lineTo(x + 0.5, hy + hh); }
      for (let y = Math.ceil(hy / 40) * 40; y < hy + hh; y += 40) { s.moveTo(hx, y + 0.5); s.lineTo(hx + hw, y + 0.5); }
      s.stroke();
      s.restore();
      s.save();
      s.fillStyle = 'rgba(0,0,0,0.25)'; s.fillRect(hx, hy, hw, 5); s.fillRect(hx, hy, 4, hh);
      const k = prog(t, this.tFat + 0.25, this.tFat + 0.5);
      s.font = font(F.mono(600), 40); s.fillStyle = RED(k); s.textAlign = 'center';
      s.fillText('−80%', hx + hw / 2, hy + hh * 0.55);
      s.font = font(F.mono(500), 15); s.fillStyle = rgba('bone', 0.6 * k);
      s.fillText('FAT, REMOVED', hx + hw / 2, hy + hh * 0.55 + 30);
      s.restore();
    }
    // the dotted lines printed on the sheet (the cuts to come), each with a little scissors mark
    s.save();
    s.setLineDash([9, 9]); s.lineWidth = 1.2;
    const kIn = prog(t, this.ctx.start, this.ctx.start + 0.4, ease.outExpo);
    for (const ct of this.cuts) {
      if (t >= ct.t - 0.2) continue;
      s.strokeStyle = fg(true, 0.32 * kIn);
      const ex = lerp(ct.a.x, ct.b.x, kIn), ey = lerp(ct.a.y, ct.b.y, kIn);
      s.beginPath(); s.moveTo(ct.a.x, ct.a.y); s.lineTo(ex, ey); s.stroke();
    }
    s.restore();
    for (const ct of this.cuts) {
      if (t >= ct.t - 0.2) continue;
      // scissors mark where the line enters the page
      let u = 0.02;
      const inside = (q: number) => { const x = lerp(ct.a.x, ct.b.x, q), y = lerp(ct.a.y, ct.b.y, q); return x > 70 && x < W - 70 && y > 90 && y < H - 70; };
      while (u < 0.5 && !inside(u)) u += 0.01;
      const x = lerp(ct.a.x, ct.b.x, u), y = lerp(ct.a.y, ct.b.y, u);
      this.scissors(s, x, y, Math.atan2(ct.b.y - ct.a.y, ct.b.x - ct.a.x), 0.6, 0.55 * kIn, fg(true, 0.45));
    }
    // margin: proofreader's notes and the edit log
    this.editLog(s, t);

    // --- the mat, then the pieces
    this.drawMat(c);
    const ps = this.pieces(t);
    const slap = 1 - ease.outExpo(clamp((t - this.ctx.start) / 0.35));
    c.save();
    if (slap > 0.001) { c.translate(960, 540); c.scale(1 + 0.06 * slap, 1 + 0.06 * slap); c.rotate(-0.02 * slap); c.translate(-960, -540); }
    this.drawPieces(c, ps);
    c.restore();

    // --- the dashed cut lines + scissors (on top), and the gaps' hit shake
    for (const ct of this.cuts) this.precut(c, t, ct.t, ct.a, ct.b);
    // FAT! letter cuts
    const fb = this.fatBox!;
    if (t > this.tFat - 0.25 && t < this.tFat + 0.15) {
      for (let i = 1; i < fb.lay.glyphs.length; i++) {
        const gx = fb.x + fb.lay.glyphs[i]!.x - 3;
        this.precut(c, t, this.tFat, { x: gx, y: fb.y - this.sizeA * 0.95 }, { x: gx + 8, y: fb.y + 30 }, 0.22);
      }
    }
    // FAT! slivers dropping off the page
    if (t >= this.tFat) {
      c.save();
      c.font = font(famA, this.sizeA);
      for (const gl of fb.lay.glyphs) {
        const t0 = this.tFat + gl.i * 0.05;
        const u = Math.max(0, t - t0);
        const dy = 2400 * u * u + 40 * u, rot = (hash(gl.i, 7) - 0.5) * 2.4 * u, dx = (hash(gl.i, 3) - 0.5) * 160 * u;
        const gx = fb.x + gl.x + gl.w / 2;
        c.save();
        c.translate(gx + dx, fb.y - this.sizeA * 0.35 + dy); c.rotate(rot);
        c.fillStyle = RED(); c.textAlign = 'center';
        c.fillText(gl.ch, 0, this.sizeA * 0.35);
        c.restore();
      }
      c.restore();
    }
    // the wire
    this.wire(c, g, t);
    // a small jolt on each cut
    let sh = 0;
    for (const ct of this.cuts) sh += Math.exp(-Math.max(0, t - ct.t) * 18) * (t >= ct.t ? 1 : 0);
    sh += Math.exp(-Math.max(0, t - this.tFat) * 18) * (t >= this.tFat ? 1 : 0);
    if (sh > 0.01) post.shake = [Math.sin(t * 97) * 5 * sh, Math.cos(t * 83) * 6 * sh];
    // the cut-up sheet starts to go just before "Set"
  }

  editLog(s: C2D, t: number) {
    const nCuts = this.cuts.filter((ct) => t >= ct.t).length + (t >= this.tFat ? 3 : 0);
    const wireDone = t >= this.tWire;
    s.save();
    s.font = font(F.mono(500), 15); s.textBaseline = 'alphabetic';
    const x = 96, y = 930;
    s.fillStyle = fg(true, 0.5); s.fillText('EDIT LOG', x, y);
    s.strokeStyle = fg(true, 0.3); s.lineWidth = 1; s.beginPath(); s.moveTo(x, y + 10); s.lineTo(x + 280, y + 10); s.stroke();
    const rows: [string, string, boolean][] = [
      ['CUTS', String(nCuts), false],
      ['FAT', t >= this.tFat ? '−80.0%' : '100.0%', t >= this.tFat],
      ['WIRE', wireDone ? '1.00 → 0.20 m' : '1.00 m', wireDone],
    ];
    rows.forEach(([a, b, red], i) => {
      s.fillStyle = fg(true, 0.55); s.fillText(a, x, y + 36 + i * 22);
      s.fillStyle = red ? RED() : fg(true, 0.85); s.fillText(b, x + 110, y + 36 + i * 22);
    });
    s.restore();
  }

  /** A taut wire across the sheet; on "wire!" it is snipped at 20%: the stub turns red, the 80% recoils and falls. */
  wire(c: C2D, g: C2D, t: number) {
    const L = this.L1, wireW = wordIn(L, 'wire'), trim = wordIn(L, 'trim');
    const appear = prog(t, trim.start - 0.3, trim.start + 0.2, ease.outExpo);
    if (appear <= 0) return;
    const y = 795, xa = 140, xb = W - 140, xs = lerp(xa, xb, 0.2);
    c.save();
    // posts
    c.fillStyle = fg(true, 0.85);
    for (const x of [xa, xb]) { c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill(); }
    // label
    c.font = font(F.mono(500), 15); c.fillStyle = fg(true, 0.6);
    c.fillText(t < this.tWire ? 'WIRE, 1.00 m' : 'WIRE, 0.20 m', xa - 6, y - 22);
    c.textAlign = 'right'; c.fillStyle = fg(true, 0.45);
    if (t < this.tWire) c.fillText('TRIM TO 0.20 m ✓ (20%)', xb + 6, y - 22);
    // tick at 20%
    c.strokeStyle = RED(0.7); c.lineWidth = 1;
    c.beginPath(); c.moveTo(xs, y - 12); c.lineTo(xs, y + 12); c.stroke();
    c.lineCap = 'round';
    if (t < this.tWire) {
      const xe = lerp(xa, xb, appear);
      const vib = Math.sin(t * 60) * 1.2 * prog(t, wireW.start, this.tWire);
      c.strokeStyle = fg(true, 0.9); c.lineWidth = 3;
      c.beginPath(); c.moveTo(xa, y); c.quadraticCurveTo((xa + xe) / 2, y + vib, xe, y); c.stroke();
    } else {
      const u = t - this.tWire;
      // the kept 20%: red, a small spring wobble
      const wob = Math.sin(u * 40) * 10 * Math.exp(-u * 6);
      c.strokeStyle = RED(); c.lineWidth = 4;
      c.beginPath(); c.moveTo(xa, y); c.quadraticCurveTo((xa + xs) / 2, y + wob, xs - 2, y + wob * 0.4); c.stroke();
      // the 80%: recoils right, sags, then drops
      const rec = springStep(u, 2.2, 0.4);
      const x0 = xs + 6 + 260 * rec, drop = 900 * Math.max(0, u - 0.35) ** 2;
      const sag = 40 + 120 * clamp(u * 2);
      c.strokeStyle = fg(true, 0.75); c.lineWidth = 3;
      c.beginPath(); c.moveTo(x0, y + drop); c.quadraticCurveTo((x0 + xb) / 2, y + sag + drop, xb, y); c.stroke();
      // sparks at the snip
      if (u < 0.45) {
        for (let i = 0; i < 22; i++) {
          const a = -Math.PI / 2 + (hash(i, 1) - 0.5) * 2.6, v = 300 + hash(i, 2) * 700;
          const r0 = v * u, r1 = v * Math.max(0, u - 0.03);
          const gy = 600 * u * u;
          const al = 1 - u / 0.45;
          g.strokeStyle = hash(i, 4) < 0.5 ? `rgba(255,122,74,${al})` : `rgba(242,177,58,${al})`;
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(xs + Math.cos(a) * r1, y + Math.sin(a) * r1 + gy * 0.8);
          g.lineTo(xs + Math.cos(a) * r0, y + Math.sin(a) * r0 + gy);
          g.stroke();
        }
      }
    }
    // the scissors coming in for the snip
    if (t > this.tWire - 0.35 && t < this.tWire + 0.25) {
      const k = clamp((t - (this.tWire - 0.35)) / 0.35);
      const open = t < this.tWire ? 1 - ease.inCubic(clamp((t - (this.tWire - 0.12)) / 0.12)) : 0;
      const fade = t < this.tWire ? 1 : 1 - (t - this.tWire) / 0.25;
      this.scissors(c, xs - 40, lerp(y + 160, y, ease.outExpo(k)), -Math.PI / 2 + 0.0, open * 0.9 + 0.1, 1.6, fg(true, 0.9 * fade));
    }
    c.restore();
  }

  // ---------------------------------------------------------------- part two: set the twenty percent on fire
  partTwo(f: Frame, c: C2D, g: C2D, post: PostOverrides): boolean {
    const t = f.t, L = this.L2;
    const fi = wordIn(L, 'fire'), pc = wordIn(L, 'percent');
    // the fresh sheet: text and the bar
    const famA = F.archivo(112, 900);
    const rowC = L.words.slice(0, 4), rowD = L.words.slice(4);
    // the red fifth bar → the block
    const bx = 210, bw = 1500, by = 560, bh = 120;
    const split = prog(t, this.tBar, this.tBar + 0.45, ease.outExpo);
    const glide = prog(t, this.tSnip + 0.55, this.tIgnite - 0.05, ease.inOutCubic);
    // red block geometry (glides to centre and grows)
    const rx0 = bx + bw * 0.8 + 3, rw0 = bw * 0.2 - 3;
    const sc = lerp(1, 1.55, glide);
    const rw = rw0 * sc, rh = bh * sc;
    const rcx = lerp(rx0 + rw0 / 2, 960, glide), rcy = lerp(by + bh / 2, 600, glide);
    const rX = rcx - rw / 2, rY = rcy - rh / 2;

    // text rows (row C rises away during the glide, row D sits under the block)
    const upC = glide;
    karaoke(c, rowC, t, 210, lerp(400, 300, upC), { family: famA, size: this.sizeC, paper: true, dim: 0.16, lead: 0.5 });
    karaoke(c, rowD, t, 960, 925, { family: famA, size: this.sizeD, paper: true, align: 'center', dim: 0.16, lead: 0.3 + (fi.start - wordIn(L, 'on').start) });

    // grey 80%: present until the snip, then falls away
    const gU = Math.max(0, t - this.tSnip);
    const greyW = bw * 0.8 - 3;
    if (gU < 1.4) {
      c.save();
      const dy = 1500 * Math.max(0, gU - 0.15) ** 2, rot = -0.35 * Math.max(0, gU - 0.15) ** 1.5;
      c.translate(bx + greyW, by + bh + dy); c.rotate(rot); c.translate(-(bx + greyW), -(by + bh));
      c.fillStyle = rgba('graphite', 0.85);
      c.fillRect(bx, by, greyW * prog(t, this.tSweep, this.tSweep + 0.35, ease.outExpo), bh);
      c.font = font(F.mono(500), 16); c.fillStyle = rgba('bone', 0.9);
      c.fillText('80% — THE REST', bx + 16, by + bh - 16);
      c.restore();
    }
    // the cut line at 80% and its scissors
    this.precut(c, t, this.tSnip, { x: bx + bw * 0.8, y: by - 70 }, { x: bx + bw * 0.8, y: by + bh + 70 }, 0.3);
    // the red fifth / block
    if (split > 0) {
      const w = rw * (glide > 0 ? 1 : split);
      c.fillStyle = RED();
      c.fillRect(rX + rw - w, rY, w, rh);
      c.font = font(F.mono(600), 16 * sc); c.fillStyle = rgba('bone', 0.95);
      c.fillText('20%', rX + rw - w + 14 * sc, rY + rh - 16 * sc);
    }
    // annotations
    const ak = prog(t, this.tSweep + 0.1, this.tSweep + 0.5) * (1 - glide);
    if (ak > 0) {
      c.save(); c.globalAlpha = ak;
      c.font = font(F.mono(500), 15); c.fillStyle = fg(true, 0.55);
      c.fillText('FIG. XIV·1  EVERYTHING, BY IMPORTANCE', bx, by - 22);
      c.textAlign = 'right'; c.fillStyle = RED(); c.fillText('KEEP', bx + bw, by - 22);
      c.restore();
    }
    const fk = prog(t, this.tIgnite - 0.3, this.tIgnite);
    if (fk > 0) {
      c.save(); c.globalAlpha = fk * (1 - prog(t, this.tCrash + 0.6, this.tCrash + 1.0));
      c.font = font(F.mono(500), 15); c.fillStyle = fg(true, 0.6); c.textAlign = 'center';
      c.fillText('FIG. XIV·2  THE TWENTY PERCENT, IGNITED', 960, rY - 30);
      c.restore();
    }

    // ---- the burn: from the block outwards once the band crashes back in
    const r0 = Math.hypot(rw, rh) * 0.5;
    const tBurn = Math.max(this.tCrash, fi.end - 0.35); // the page catches once "fire!" has been read
    const burnR = t < tBurn ? 0 : r0 * 0.55 + 1500 * ease.inQuad(prog(t, tBurn, this.ctx.end - 0.2));
    let glow = false;
    if (burnR > 1) {
      const path = this.burnPath(t, rcx, rcy, burnR);
      c.save();
      c.lineJoin = 'round';
      c.strokeStyle = 'rgba(110,70,40,0.25)'; c.lineWidth = 70; c.stroke(path);
      c.strokeStyle = 'rgba(60,36,20,0.55)'; c.lineWidth = 34; c.stroke(path);
      c.strokeStyle = 'rgba(25,16,10,0.9)'; c.lineWidth = 14; c.stroke(path);
      c.fillStyle = '#0c0c0e'; c.fill(path);
      c.restore();
      g.save();
      g.lineJoin = 'round';
      g.strokeStyle = 'rgba(232,52,28,0.8)'; g.lineWidth = 5; g.stroke(path);
      g.strokeStyle = 'rgba(255,122,74,0.9)'; g.lineWidth = 2.4; g.stroke(path);
      g.strokeStyle = 'rgba(242,177,58,0.9)'; g.lineWidth = 1; g.stroke(path);
      g.restore();
      glow = true;
      // the block stays (redraw over the burn)
      c.fillStyle = RED(); c.fillRect(rX, rY, rw, rh);
    }
    // ---- the fire
    if (t >= this.tIgnite) {
      const u = t - this.tIgnite;
      const grow = 0.25 + 0.35 * ease.outCubic(clamp(u / 0.4)) + 0.4 * ease.outExpo(clamp((t - this.tFill) / 0.5)) * (t >= this.tFill ? 1 : 0);
      const crash = t >= this.tCrash ? ease.outExpo(clamp((t - this.tCrash) / 0.3)) : 0;
      const hats = f.a.hat * 0.25 + f.a.kick * 0.15;
      const flameH = rh * (1.1 * grow + 1.6 * crash) * (1 + hats);
      this.flames(c, rX - 6, rX + rw + 6, rY + 6, flameH, t, 1, true);
      this.flames(g, rX - 6, rX + rw + 6, rY + 6, flameH, t, 0.3);
      this.embers(g, rX, rX + rw, rY, t, u, 0.5 + crash);
      this.embers(c, rX, rX + rw, rY, t, u, 0.5 + crash);
      // heat on the block's top edge
      const hg = c.createLinearGradient(0, rY, 0, rY + rh * 0.6);
      hg.addColorStop(0, 'rgba(242,177,58,0.85)'); hg.addColorStop(0.35, 'rgba(255,122,74,0.5)'); hg.addColorStop(1, 'rgba(255,122,74,0)');
      c.fillStyle = hg; c.fillRect(rX, rY, rw, rh * 0.6);
      glow = true;
      // flash on the crash
      if (t >= this.tCrash) post.flash = 0.5 * Math.exp(-(t - this.tCrash) * 7);
      post.bloom = 0.7; post.bloomThreshold = 1.0;
    }
    // the swept-away pieces of the first sheet fly over everything
    if (t < this.tSweep + 0.8) {
      const s = this.sheet.ctx; this.sheet.clear();
      // re-print the old sheet at its final state
      const tl = this.tSweep - 0.001;
      drawPlateHead(s, 14, 'Editing', 1, { paper: true, right: 'CUT ALONG THE DOTTED LINES' });
      const L1 = this.L1;
      karaoke(s, L1.words.slice(0, 2), tl, 960 - (this.fatBox ? 0 : 0), 430, { family: famA, size: this.sizeA, paper: true, align: 'center', dim: 0.16 });
      karaoke(s, L1.words.slice(3), tl, 960, 650, { family: famA, size: this.sizeB, paper: true, align: 'center', dim: 0.16 });
      this.editLog(s, tl);
      const fly = ease.inCubic(prog(t, this.tSweep, this.tSweep + 0.7));
      this.drawPieces(c, this.pieces(tl), Math.max(0.0001, fly));
    }
    // last frames: the paper is gone; fade the burn rim's red bias into the solo's dark
    const burned = clamp(burnR / 1300);
    post.paper = 1 - burned;
    post.halation = 0.12 * burned;
    post.vignette = lerp(0.2, 0.35, burned);
    void pc;
    return glow;
  }

  /** Irregular burn front (closed path) around (cx, cy). */
  burnPath(t: number, cx: number, cy: number, R: number) {
    const p = new Path2D();
    const n = 180;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU;
      const nz = 0.22 * noise1(a * 2.2 + 3, 5) + 0.10 * noise1(a * 7.1 + t * 1.5, 9) + 0.05 * noise1(a * 19 + t * 4, 2) + 0.025 * noise1(a * 47, 3);
      const r = R * (1 + nz) * (1 + 0.25 * Math.abs(Math.cos(a)));
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.85;
      if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
    }
    p.closePath();
    return p;
  }

  /** Flame tongues along [x0, x1] standing on `base`: signal outside, ember, gold core; `hatch` adds engraved hairlines. */
  flames(g: C2D, x0: number, x1: number, base: number, H0: number, t: number, alpha: number, hatch = false) {
    const n = Math.max(4, Math.floor((x1 - x0) / 40));
    const sp = (x1 - x0) / n;
    const tongue = (i: number, hs: number, ws: number) => {
      const xc = x0 + (i + 0.5) * sp + 10 * noise1(t * 1.3 + i * 3.1, 21);
      const e = clamp((i + 0.5) / n, 0, 1);
      const edge = Math.max(0.25, Math.sin(e * Math.PI)) ** 0.7;
      const flick = 0.5 + 0.5 * noise1(t * 6.1 + i * 1.73, 11);
      const lick = 0.5 + 0.5 * Math.sin(t * (7 + 3 * hash(i, 4)) + i * 2.1 + 3 * noise1(t * 2 + i, 8));
      const h = H0 * hs * edge * (0.3 + 0.4 * flick + 0.3 * lick) * (0.6 + 0.8 * hash(i + 9, 19));
      const w = sp * 2.5 * ws;
      const sway = (34 * noise1(t * 2.3 + i * 0.6, 5) + 14 * noise1(t * 7 + i, 6)) * (h / Math.max(1, H0));
      return { xc, h, w, sway };
    };
    const layers: [string, number, number][] = [['232,52,28', 1, 1], ['255,122,74', 0.74, 0.72], ['242,177,58', 0.5, 0.46]];
    for (const [rgb, hs, ws] of layers) {
      g.fillStyle = `rgba(${rgb},${alpha})`;
      for (let i = -1; i <= n; i++) {
        const { xc, h, w, sway } = tongue(i, hs, ws);
        g.beginPath();
        g.moveTo(xc - w / 2, base);
        g.bezierCurveTo(xc - w * 0.62, base - h * 0.32, xc - w * 0.18 + sway * 0.4, base - h * 0.66, xc + sway, base - h);
        g.bezierCurveTo(xc + w * 0.2 + sway * 0.5, base - h * 0.62, xc + w * 0.62, base - h * 0.3, xc + w / 2, base);
        g.closePath(); g.fill();
      }
    }
    if (hatch) {
      // engraved flame: hairlines following each tongue, over all three layers
      g.save();
      g.strokeStyle = `rgba(163,23,14,${0.75 * alpha})`; g.lineWidth = 1.3;
      for (let i = -1; i <= n; i++) {
        const { xc, h, w, sway } = tongue(i, 1, 1);
        for (const q of [-0.32, -0.12, 0.1, 0.3]) {
          const hq = h * (0.9 - Math.abs(q) * 1.1);
          g.beginPath();
          g.moveTo(xc + q * w, base);
          g.bezierCurveTo(xc + q * w * 1.05, base - hq * 0.35, xc + q * w * 0.4 + sway * 0.45, base - hq * 0.66, xc + sway * (hq / Math.max(1, h)), base - hq);
          g.stroke();
        }
      }
      g.restore();
    }
  }

  /** Embers rising from the fire (deterministic: each has a birth time on a loop). */
  embers(g: C2D, x0: number, x1: number, base: number, t: number, u: number, k: number) {
    const N = 70, P = 1.4;
    for (let i = 0; i < N; i++) {
      const ph = hash(i, 31) * P;
      const age = ((t + ph) % P);
      const born = t - age;
      if (born < this.tIgnite) continue;
      const x = lerp(x0, x1, hash(i, 32)) + 40 * noise1(born * 3 + age * 1.5, i) * age;
      const y = base - age * (220 + 260 * hash(i, 33)) * (0.6 + k * 0.6);
      const a = (1 - age / P) * clamp(u * 2);
      const r = 1.2 + 2 * hash(i, 34);
      g.fillStyle = hash(i, 35) < 0.5 ? `rgba(242,177,58,${a})` : `rgba(255,122,74,${a})`;
      g.fillRect(x - r / 2, y - r / 2, r, r);
    }
    void frameIdx;
  }
}
