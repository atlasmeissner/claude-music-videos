// PLATE XIII `bridge` — "The law, engraved".
// Dark, hypnotic. The music sags (♩ 96.5 → 94.3) into a swirl: a guilloché rosette of five rings
// (one red: the red fifth) assembles ring by ring on the beat and twists on the kick fill. "Vilfredo
// Pareto, he knew the score": the rosette frames an engraved cartouche (b. Paris 1848, d. Céligny
// 1923), the score is 80 : 20. "From the peas in his garden to the rich and the poor": ten pods split
// open, two red ones spill 80 of the 100 peas, and the peas roll into a wealth histogram. "It's a law
// of the universe, carved in the stone": a stele slams down, the formula is chiselled into it glyph by
// glyph. "You reap what you sow in the 'vital few' zone": the camera pushes into the carved curve, its
// head hatched red; then the rosette returns and tightens into a single red dot (hand-off to XIV).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, SCALE } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure } from '../engine/type';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { clamp, lerp, ease, prog, hash, noise1, TAU, smoothstep, mulberry32 } from '../engine/util';
import { Ground, INK_POST, drawPlateHead, footnote, fg, RED, pareto, wordIn, wkey, type C2D } from './_kit';
import { karaoke } from './bridge-karaoke';

// ------------------------------------------------------------------ the rosette (guilloché)
interface Ring {
  R: number; A: number; k: number; n: number; m: number; // radius, amplitude, lobes, strands, samples/strand
  B: number; kb: number; // slow envelope wave
  om: number; spin: number; red?: boolean;
}
const RINGS: Ring[] = [
  { R: 200, A: 34, k: 18, n: 7, m: 320, B: 10, kb: 6, om: 0.9, spin: 0.05 },
  { R: 268, A: 30, k: 22, n: 6, m: 390, B: 8, kb: 5, om: -1.3, spin: -0.07, red: true },
  { R: 345, A: 40, k: 27, n: 8, m: 470, B: 14, kb: 9, om: 0.7, spin: 0.04 },
  { R: 432, A: 34, k: 33, n: 7, m: 580, B: 12, kb: 11, om: -0.6, spin: -0.03 },
];
// centre: a hypotrochoid, R = 17, r = 5 (17 lobes, closes after 5 turns)
const HYPO = { R: 17, r: 5, turns: 5, m: 1200 };

const BONE = LIN.bone, SIG = LIN.signal;

type Cam = { cx: number; cy: number; s: number };

export default class Bridge extends Scene {
  g = new Ground();
  lb = new LineBatch(40000, { blend: 'add' });
  L = new Layer2D();
  stone!: HTMLCanvasElement; // full-frame stone texture (SCALE×)
  slabTex!: THREE.CanvasTexture; // the slab (stone, bevel, incised borders, shadow), baked once
  stoneTex!: THREE.CanvasTexture; // darkened full-frame stone for the close-up
  slabDraw: { dy: number } | null = null;
  stoneDraw: { zs: number; a: number } | null = null;
  L1!: Line; L2!: Line; L3!: Line; L4!: Line;
  tB = 0; tC = 0; tD = 0; tE = 0; tEnd = 0; // section starts
  peas: { pod: number; px: number; py: number; hx: number; hy: number; col: number; ord: number; spill: number }[] = [];
  pods: { x: number; n: number; red: boolean }[] = [];
  hypoPts: { x: number; y: number }[] = [];

  override init() {
    const { lyrics, audio } = this.ctx;
    this.L1 = lyrics.get('Vilfredo Pareto');
    this.L2 = lyrics.get('peas in his garden');
    this.L3 = lyrics.get('law of the universe');
    this.L4 = lyrics.get('reap what you sow');
    const beatBefore = (t: number) => audio.timeOfBeat(Math.floor(audio.beatAt(t + 0.03)));
    const dbBefore = (t: number) => [...audio.downbeats].reverse().find((d) => d <= t + 0.03) ?? t;
    this.tB = dbBefore(this.L1.start);           // the cartouche opens a bar before "Vilfredo"
    this.tC = beatBefore(this.L2.start);         // between "score" and "From"
    this.tD = beatBefore(this.L3.start);
    this.tE = this.L4.words[0]!.start - 0.03;     // "You" (the beat lands 50 ms later)
    this.tEnd = this.ctx.end;

    // pods & peas: 10 pods, 100 peas; two red pods hold 80 of them
    const counts = [3, 2, 40, 2, 3, 2, 3, 40, 2, 3];
    this.pods = counts.map((n, i) => ({ x: 330 + i * 140, n, red: n === 40 }));
    // histogram columns: red pods first, then the rest by count
    const order = this.pods.map((p, i) => i).sort((a, b) => this.pods[b]!.n - this.pods[a]!.n || a - b);
    const colX = (j: number) => 450 + j * 114;
    let ord = 0;
    order.forEach((podI, j) => {
      const p = this.pods[podI]!;
      for (let q = 0; q < p.n; q++) {
        // position inside / spilled under the pod
        let px: number, py: number, spill = 0;
        if (p.red) {
          // a heap under the pod: rows of 9,8,7,6,5,4,1
          const rows = [9, 8, 7, 6, 5, 4, 1];
          let r = 0, k = q;
          while (k >= rows[r]!) { k -= rows[r]!; r++; }
          px = p.x + (k - (rows[r]! - 1) / 2) * 17.5 + (hash(q, podI) - 0.5) * 3;
          py = 680 - r * 15;
          spill = 1;
        } else {
          px = p.x + (q - (p.n - 1) / 2) * 20; py = 482;
        }
        // stacked in its column, 5 per row
        const hx = colX(j) + ((q % 5) - 2) * 19;
        const hy = 922 - Math.floor(q / 5) * 19;
        this.peas.push({ pod: podI, px, py, hx, hy, col: j, ord: ord++, spill });
      }
    });

    // hypotrochoid for the carved ornament (unit radius)
    for (let i = 0; i <= 900; i++) {
      const th = (i / 900) * TAU * HYPO.turns;
      const { R, r } = HYPO, d = 7;
      this.hypoPts.push({ x: ((R - r) * Math.cos(th) + d * Math.cos(((R - r) / r) * th)) / 19, y: ((R - r) * Math.sin(th) - d * Math.sin(((R - r) / r) * th)) / 19 });
    }
    this.stone = this.makeStone();
    this.slabTex = this.tex(this.bakeSlab());
    const dark = document.createElement('canvas');
    dark.width = W * SCALE; dark.height = H * SCALE;
    const dc = dark.getContext('2d')!;
    dc.drawImage(this.stone, 0, 0);
    dc.fillStyle = 'rgba(12,12,14,0.58)'; dc.fillRect(0, 0, dark.width, dark.height);
    this.stoneTex = this.tex(dark);
  }

  tex(cv: HTMLCanvasElement) {
    const tx = new THREE.CanvasTexture(cv);
    tx.colorSpace = THREE.SRGBColorSpace; tx.minFilter = THREE.LinearFilter; tx.generateMipmaps = false; tx.flipY = true;
    tx.needsUpdate = true;
    return tx;
  }
  /** The slab, baked once (drawn through the compositor so the stone costs no Canvas2D time per frame). */
  bakeSlab() {
    const cv = document.createElement('canvas');
    cv.width = W * SCALE; cv.height = H * SCALE;
    const c = cv.getContext('2d')!;
    c.scale(SCALE, SCALE);
    const x0 = 330, x1 = 1590, top = 165, bot = 935, ch0 = 34;
    // shadow
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(x0 + 18, top + 22, x1 - x0, bot - top);
    // the slab, corners chamfered
    const path = new Path2D();
    path.moveTo(x0 + ch0, top); path.lineTo(x1 - ch0, top); path.lineTo(x1, top + ch0); path.lineTo(x1, bot - ch0);
    path.lineTo(x1 - ch0, bot); path.lineTo(x0 + ch0, bot); path.lineTo(x0, bot - ch0); path.lineTo(x0, top + ch0); path.closePath();
    c.save();
    c.clip(path);
    c.drawImage(this.stone, 0, 0, W, H);
    c.lineWidth = 16; c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.beginPath(); c.moveTo(x1, top); c.lineTo(x1, bot); c.lineTo(x0, bot); c.stroke();
    c.strokeStyle = 'rgba(241,235,221,0.12)';
    c.beginPath(); c.moveTo(x0, bot); c.lineTo(x0, top); c.lineTo(x1, top); c.stroke();
    c.restore();
    c.lineWidth = 1.5; c.strokeStyle = 'rgba(241,235,221,0.35)'; c.stroke(path);
    // inner incised border (double)
    for (const [ins, lw] of [[30, 1.6], [40, 0.9]] as const) {
      const ip = new Path2D();
      const q = ch0 * 0.6;
      ip.moveTo(x0 + ins + q, top + ins); ip.lineTo(x1 - ins - q, top + ins); ip.lineTo(x1 - ins, top + ins + q); ip.lineTo(x1 - ins, bot - ins - q);
      ip.lineTo(x1 - ins - q, bot - ins); ip.lineTo(x0 + ins + q, bot - ins); ip.lineTo(x0 + ins, bot - ins - q); ip.lineTo(x0 + ins, top + ins + q); ip.closePath();
      c.save();
      c.lineWidth = lw; c.strokeStyle = 'rgba(16,15,14,0.75)'; c.stroke(ip);
      c.translate(1, 1.4); c.strokeStyle = 'rgba(241,235,221,0.22)'; c.stroke(ip);
      c.restore();
    }

    // carved ornaments: the rosette in miniature at the four corners
    for (const [ox, oy] of [[x0 + 92, top + 92], [x1 - 92, top + 92], [x0 + 92, bot - 92], [x1 - 92, bot - 92]] as const)
      this.carvedPolyline(c, this.hypoPts.map((p) => ({ x: ox + p.x * 34, y: oy + p.y * 34 })), 1, 1);
    return cv;
  }

  /** Stone: warm grey, lit from the top left, engraved with fine strata hatching, speckle and two cracks. */
  makeStone() {
    const cv = document.createElement('canvas');
    cv.width = W * SCALE; cv.height = H * SCALE;
    const c = cv.getContext('2d')!;
    c.scale(SCALE, SCALE);
    const gr = c.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#8c877e'); gr.addColorStop(0.55, '#74706a'); gr.addColorStop(1, '#5a5751');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    const rnd = mulberry32(1848);
    // strata: long, slightly wavy hairlines
    c.lineWidth = 0.8;
    for (let i = 0; i < 420; i++) {
      const y0 = rnd() * (H + 400) - 200, a = (rnd() - 0.5) * 0.12 + 0.18;
      c.strokeStyle = rnd() < 0.5 ? `rgba(30,28,26,${0.10 + rnd() * 0.16})` : `rgba(200,192,178,${0.05 + rnd() * 0.08})`;
      c.beginPath();
      for (let x = -20; x <= W + 20; x += 40) {
        const y = y0 + x * a + Math.sin(x * 0.004 + i) * 10 + (rnd() - 0.5) * 1.5;
        if (x === -20) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    // speckle
    for (let i = 0; i < 9000; i++) {
      const x = rnd() * W, y = rnd() * H, r = rnd() * 1.3 + 0.3;
      c.fillStyle = rnd() < 0.6 ? `rgba(25,24,22,${0.25 + rnd() * 0.3})` : `rgba(215,208,195,${0.15 + rnd() * 0.2})`;
      c.fillRect(x, y, r, r);
    }
    // cracks
    c.strokeStyle = 'rgba(20,19,18,0.55)'; c.lineWidth = 1.1;
    for (const [sx, sy, ang] of [[600, 140, 1.2], [1380, 980, -1.9]] as const) {
      let x = sx, y = sy, a = ang;
      c.beginPath(); c.moveTo(x, y);
      for (let i = 0; i < 26; i++) { a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * 14; y += Math.sin(a) * 14; c.lineTo(x, y); }
      c.stroke();
    }
    return cv;
  }

  // ---------------------------------------------------------------- rosette into the line batch
  /**
   * The guilloché: four modulated bands (one red) around a hypotrochoid. `rv[i]` reveals ring i
   * (i = 0: centre, 1..4: bands) as a sweep. `twist` shears the bands into spirals, `breath` swells
   * the amplitude (kicks), `ph` advances the strand phases (the hypnotic travel).
   */
  rosette(cam: Cam, t: number, o: { rv: number[]; twist: number; breath: number; alpha: number; ph: number; redGain?: number; collapse?: number }) {
    const lb = this.lb;
    const s = cam.s * (1 - (o.collapse ?? 0));
    if (s < 0.002 || o.alpha <= 0.002) return;
    const a = o.alpha;
    const bone: [number, number, number] = [BONE[0] * 0.42 * a, BONE[1] * 0.42 * a, BONE[2] * 0.42 * a];
    const rg = (o.redGain ?? 1) * a;
    const red: [number, number, number] = [SIG[0] * 1.25 * rg, SIG[1] * 1.25 * rg, SIG[2] * 1.25 * rg];
    // centre hypotrochoid, its pen offset breathing
    const rv0 = clamp(o.rv[0] ?? 0);
    if (rv0 > 0) {
      const { R, r, turns, m } = HYPO;
      const d = 7 + 2.2 * Math.sin(o.ph * 0.6) + 2 * o.breath;
      const rot = o.ph * 0.15;
      const sc = (150 / 19) * s;
      const nn = Math.floor(m * rv0);
      let px = 0, py = 0;
      for (let i = 0; i <= nn; i++) {
        const th = (i / m) * TAU * turns;
        const x = (R - r) * Math.cos(th) + d * Math.cos(((R - r) / r) * th);
        const y = (R - r) * Math.sin(th) - d * Math.sin(((R - r) / r) * th);
        const cr = Math.cos(rot), sr = Math.sin(rot);
        const X = cam.cx + (x * cr - y * sr) * sc, Y = cam.cy + (x * sr + y * cr) * sc;
        if (i > 0) lb.seg2(px, py, X, Y, 1, bone, 1);
        px = X; py = Y;
      }
    }
    RINGS.forEach((rg0, ri) => {
      const rv = clamp(o.rv[ri + 1] ?? 0);
      if (rv <= 0) return;
      const col = rg0.red ? red : bone;
      const A = rg0.A * (1 + 0.45 * o.breath);
      const spin = rg0.spin * o.ph + (ri % 2 ? -1 : 1) * o.twist * 0.15;
      const ms = Math.floor(rg0.m * rv);
      for (let si = 0; si < rg0.n; si++) {
        const phi = (si / rg0.n) * TAU + rg0.om * o.ph;
        let px = 0, py = 0;
        for (let i = 0; i <= ms; i++) {
          const th = (i / rg0.m) * TAU;
          const r = rg0.R + A * Math.sin(rg0.k * th + phi) + rg0.B * Math.sin(rg0.kb * th - o.ph * 0.5);
          const thd = th + spin + o.twist * (r - rg0.R) / rg0.R * 2.2;
          const X = cam.cx + Math.cos(thd) * r * s, Y = cam.cy + Math.sin(thd) * r * s;
          if (i > 0) lb.seg2(px, py, X, Y, rg0.red ? 1.1 : 0.9, col, 1);
          px = X; py = Y;
        }
      }
    });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp, audio } = this.ctx;
    const t = f.t;
    this.g.render(renderer, out, { paper: 0, vig: 0 });
    const c = this.L.ctx; this.L.clear();
    this.lb.clear();
    const post: PostOverrides = { ...INK_POST, bloom: 0.5 };
    this.slabDraw = null; this.stoneDraw = null;

    // shared rosette clock: phase slows with the music, breath on kicks
    const ph = audio.beatAt(t) * 0.55;
    const breath = f.a.kick * 0.6;
    const t0 = this.ctx.start;
    const beat = (i: number) => audio.timeOfBeat(Math.floor(audio.beatAt(t0 + 0.03)) + i);

    if (t < this.tB) this.secA(f, c, ph, breath, beat);
    else if (t < this.tC) this.secB(f, c, ph, breath);
    else if (t < this.tD) this.secC(f, c, ph, breath);
    else if (t < this.tE) this.secD(f, c, ph, breath, post);
    else this.secE(f, c, ph, breath, post);

    this.lb.render(renderer, out);
    const sd = this.stoneDraw as { zs: number; a: number } | null, sl = this.slabDraw as { dy: number } | null;
    if (sd) comp.draw(renderer, this.stoneTex, out, { opacity: sd.a, scale: [1 / sd.zs, 1 / sd.zs] });
    if (sl) comp.draw(renderer, this.slabTex, out, { offset: [0, sl.dy / H] });
    comp.draw(renderer, this.L.upload(), out);
    return post;
  }

  // ---------------------------------------------------------------- A: the swirl (instrumental)
  secA(f: Frame, c: C2D, ph: number, breath: number, beat: (i: number) => number) {
    const t = f.t, { audio } = this.ctx;
    // a ring every 2 beats, each sweeping in over a beat
    const rv = [0, 1, 2, 3, 4].map((i) => prog(t, beat(i * 2), beat(i * 2 + 1.2), ease.outExpo));
    // twist builds through the kick fill (last two bars before B)
    const fill0 = beat(8);
    const twist = 0.25 * Math.sin(ph * 0.7) + 0.9 * ease.inOutCubic(prog(t, fill0, this.tB)) * (0.6 + 0.4 * Math.sin(ph * 2.0));
    // downbeat push-ins
    let s = 1.0;
    for (const d of audio.downbeats) if (d >= this.ctx.start - 0.01 && d <= t) s += 0.035 * ease.outExpo(clamp((t - d) / 0.5));
    this.rosette({ cx: 960, cy: 560, s: s * 0.98 }, t, { rv, twist, breath, alpha: 1, ph });

    drawPlateHead(c, 13, 'The law, engraved', (t - this.ctx.start) / 0.6, { paper: false, right: 'AFTER V. PARETO, COURS D’ÉCONOMIE POLITIQUE, 1896' });

    // instrument table (left): tempo read off the beat grid
    const k = prog(t, this.ctx.start + 0.3, this.ctx.start + 1.2);
    const bi = Math.floor(audio.beatAt(t));
    const per = audio.timeOfBeat(bi + 1) - audio.timeOfBeat(bi);
    const bpm = 60 / per;
    const hyp = clamp((t - this.ctx.start) / (this.tB - this.ctx.start));
    const rows: [string, string, boolean?][] = [
      ['TEMPO', `${bpm.toFixed(1)} BPM ↓`],
      ['RINGS', `${rv.filter((x) => x > 0.5).length} OF 5`],
      ['RED', rv[2]! > 0.5 ? '1 OF 5 (20%)' : '—', rv[2]! > 0.5],
      ['TWIST', `${(twist * 57.3 / 2.2).toFixed(0).padStart(3)}°`],
      ['HYPNOSIS', `${(hyp * 80).toFixed(1)}%`],
    ];
    c.save();
    c.globalAlpha = k;
    c.font = font(F.mono(500), 15); c.textBaseline = 'alphabetic';
    let y = 790;
    c.fillStyle = fg(false, 0.55); c.fillText('FIG. XIII·1', 96, y - 34);
    c.strokeStyle = fg(false, 0.3); c.lineWidth = 1;
    c.beginPath(); c.moveTo(96, y - 22); c.lineTo(330, y - 22); c.stroke();
    for (const [a, b, red] of rows) {
      c.fillStyle = fg(false, 0.55); c.fillText(a, 96, y);
      c.fillStyle = red ? RED() : fg(false, 0.9); c.fillText(b, 206, y);
      y += 26;
    }
    c.restore();
    // right: caption
    c.save();
    c.globalAlpha = k;
    c.font = font(F.serif(400, true), 30); c.fillStyle = fg(false, 0.8); c.textAlign = 'right';
    c.fillText('A rosette of five rings,', W - 96, 870);
    c.fillText('one of which matters.', W - 96, 906);
    c.restore();
    footnote(c, 'guilloché after no banknote in particular; r = R + A·sin(kθ + φᵢ)', W - 96, 950, { paper: false, align: 'right', a: k });
  }

  // ---------------------------------------------------------------- B: the cartouche
  secB(f: Frame, c: C2D, ph: number, breath: number) {
    const t = f.t, L = this.L1;
    const open = prog(t, this.tB, this.tB + 0.9, ease.outExpo);
    const cx = 960, cy = 470;
    const s = lerp(1.0, 1.62, open);
    this.rosette({ cx, cy, s }, t, { rv: [1 - open, 1, 1, 1, 1], twist: 0.3 * Math.sin(ph * 0.7), breath: breath * 0.6, alpha: lerp(1, 0.6, open), ph });

    // cartouche: ink plate with a double rule and a beaded border
    const rx = 470 * ease.outBack(open, 1.2), ry = 260 * ease.outBack(open, 1.2);
    if (rx > 2) {
      c.save();
      c.fillStyle = rgba('ink', 1);
      c.beginPath(); c.ellipse(cx, cy, rx + 26, ry + 26, 0, 0, TAU); c.fill();
      c.strokeStyle = fg(false, 0.85); c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, TAU); c.stroke();
      c.lineWidth = 0.8; c.strokeStyle = fg(false, 0.5);
      c.beginPath(); c.ellipse(cx, cy, rx - 10, ry - 10, 0, 0, TAU); c.stroke();
      // beads around the border, rotating slowly with the music
      c.fillStyle = fg(false, 0.6);
      const nb = 96;
      for (let i = 0; i < nb; i++) {
        const a = (i / nb) * TAU + ph * 0.05;
        c.beginPath(); c.arc(cx + Math.cos(a) * (rx + 13), cy + Math.sin(a) * (ry + 13), i % 8 === 0 ? 2.6 : 1.3, 0, TAU); c.fill();
      }
      c.restore();
    }
    // the name, engraved in Cormorant
    const nameIn = prog(t, L.start - 0.45, L.start - 0.1);
    if (nameIn > 0) {
      c.save(); c.globalAlpha = nameIn;
      karaoke(c, [L.words[0]!], t, cx, cy - 40, { family: F.serif(600, true), size: 100, paper: false, align: 'center', dim: 0.22, lead: 9, alpha: nameIn });
      karaoke(c, [L.words[1]!], t, cx, cy + 110, { family: F.serif(600, true), size: 168, paper: false, align: 'center', dim: 0.22, lead: 9, alpha: nameIn });
      c.font = font(F.mono(500), 17); c.fillStyle = fg(false, 0.6); c.textAlign = 'center';
      c.fillText('· PARIS 1848 — CÉLIGNY 1923 ·', cx, cy + 178);
      c.restore();
    }
    // "he knew the score" on a label plate, and the score itself
    const pw = 640, ph2 = 100, py = 905;
    const plateK = prog(t, this.tB + 0.6, this.tB + 1.1, ease.outExpo);
    if (plateK > 0) {
      c.save();
      c.fillStyle = rgba('ink', 1);
      c.fillRect(cx - pw / 2 * plateK, py - ph2 / 2, pw * plateK, ph2);
      c.strokeStyle = fg(false, 0.6); c.lineWidth = 1;
      c.strokeRect(cx - pw / 2 * plateK + 0.5, py - ph2 / 2 + 0.5, pw * plateK - 1, ph2 - 1);
      c.strokeRect(cx - pw / 2 * plateK + 6.5, py - ph2 / 2 + 6.5, pw * plateK - 13, ph2 - 13);
      c.restore();
      karaoke(c, L.words.slice(2), t, cx, py + 20, { family: F.archivo(100, 700), size: 58, paper: false, align: 'center', dim: 0.25, lead: 9 });
    }
    // the scoreboard
    const sc = wordIn(L, 'score');
    const k2 = prog(t, sc.start, sc.start + 0.35, ease.outBack);
    if (k2 > 0) {
      const x = cx + pw / 2 + 40, y = py;
      c.save();
      c.translate(x, y); c.scale(1, k2);
      c.fillStyle = rgba('ink2', 1); c.fillRect(0, -40, 196, 80);
      c.strokeStyle = fg(false, 0.6); c.lineWidth = 1; c.strokeRect(0.5, -39.5, 195, 79);
      c.font = font(F.mono(600), 44); c.textBaseline = 'middle'; c.textAlign = 'center';
      c.fillStyle = fg(false, 0.9); c.fillText('80', 52, 2);
      c.fillStyle = fg(false, 0.5); c.fillText(':', 98, 0);
      c.fillStyle = RED(); c.fillText('20', 144, 2);
      c.font = font(F.mono(500), 12); c.fillStyle = fg(false, 0.5); c.textBaseline = 'alphabetic';
      c.fillText('MANY', 52, -46); c.fillText('FEW', 144, -46);
      c.restore();
    }
  }

  // ---------------------------------------------------------------- C: peas → wealth
  secC(f: Frame, c: C2D, ph: number, breath: number) {
    const t = f.t, L = this.L2;
    this.rosette({ cx: 960, cy: 560, s: 1.75 }, t, { rv: [0, 1, 1, 1, 1], twist: 0.2 * Math.sin(ph * 0.7), breath: breath * 0.4, alpha: 0.09, ph, redGain: 0.5 });
    const peasW = wordIn(L, 'peas'), toW = wordIn(L, 'to'), richW = wordIn(L, 'rich'), poorW = wordIn(L, 'poor'), gardenW = wordIn(L, 'garden');
    const enter = prog(t, this.tC, this.tC + 0.5, ease.outExpo);

    // the lyric: two rows, top left
    const rows = [L.words.slice(0, 6), L.words.slice(6)];
    c.save();
    c.translate(lerp(-40, 0, enter), 0); c.globalAlpha = enter;
    karaoke(c, rows[0]!, t, 160, 230, { family: F.archivo(100, 700), size: 66, paper: false, alpha: enter, lead: 9 });
    karaoke(c, rows[1]!, t, 160, 312, { family: F.archivo(100, 700), size: 66, paper: false, alpha: enter, lead: 9 });
    c.restore();

    // pods
    const toHist = prog(t, toW.start - 0.1, toW.start + 0.5, ease.inOutCubic);
    const podA = 1 - 0.65 * toHist;
    this.pods.forEach((p, i) => {
      const openT = peasW.start + i * 0.045;
      const op = prog(t, openT, openT + 0.3, ease.outBack);
      const appear = prog(t, this.tC + 0.05 + i * 0.03, this.tC + 0.4 + i * 0.03, ease.outExpo);
      if (appear <= 0) return;
      this.drawPod(c, p.x, 480 + (1 - appear) * 30, op, p.red, podA * appear);
      // count label
      if (op > 0.5) {
        c.save(); c.globalAlpha = podA * clamp((op - 0.5) * 2);
        c.font = font(F.mono(p.red ? 600 : 400), p.red ? 20 : 15); c.textAlign = 'center';
        c.fillStyle = p.red ? RED() : fg(false, 0.5);
        c.fillText(String(p.n), p.x, 412);
        c.restore();
      }
    });
    // pod captions
    const capK = prog(t, gardenW.start, gardenW.start + 0.4) * (1 - toHist);
    if (capK > 0) {
      c.save(); c.globalAlpha = capK;
      c.font = font(F.mono(500), 15); c.fillStyle = fg(false, 0.6);
      c.fillText('FIG. XIII·2  PISUM SATIVUM, THE GARDEN AT CÉLIGNY — 10 PODS, 100 PEAS', 330 - 56, 540);
      c.fillStyle = RED(); c.fillText('2 PODS → 80 PEAS', 1590 + 56 - measure('2 PODS → 80 PEAS', F.mono(500), 15), 540);
      c.restore();
    }

    // peas: in the pods / spilled in heaps, then rolling into the histogram
    const nPea = this.peas.length;
    c.save();
    for (const pe of this.peas) {
      const pod = this.pods[pe.pod]!;
      const i = this.pods.indexOf(pod);
      const openT = peasW.start + i * 0.045;
      let x: number, y: number, a = 1;
      // spill (red pods): a fountain out of the pod
      const sp0 = openT + 0.12 + (pe.ord % 40) * 0.012;
      const sp = pe.spill ? prog(t, sp0, sp0 + 0.42) : 1;
      if (!pe.spill) { x = pe.px; y = pe.py; a = prog(t, openT + 0.1, openT + 0.3); }
      else if (sp <= 0) { x = pod.x; y = 480; a = 0; }
      else {
        const u = sp;
        x = lerp(pod.x, pe.px, ease.outCubic(u));
        y = lerp(480, pe.py, u) - Math.sin(u * Math.PI) * (70 + hash(pe.ord, 3) * 60);
      }
      // roll into the histogram
      const h0 = toW.start + (pe.ord / nPea) * 1.0;
      const hk = prog(t, h0, h0 + 0.5);
      if (hk > 0) {
        const e = ease.inOutCubic(hk);
        const sx = x, sy = y;
        x = lerp(sx, pe.hx, e);
        y = lerp(sy, pe.hy, e) - Math.sin(hk * Math.PI) * 90;
        a = Math.max(a, hk);
      }
      if (a <= 0) continue;
      const red = pod.red;
      c.globalAlpha = a;
      c.fillStyle = red ? RED() : rgba('ash', 0.9);
      c.beginPath(); c.arc(x, y, 8.2, 0, TAU); c.fill();
      c.strokeStyle = red ? rgba('blood', 1) : rgba('graphite', 1); c.lineWidth = 1;
      c.beginPath(); c.arc(x + 1.5, y + 1.5, 4.5, 0.2, 1.6); c.stroke();
    }
    c.restore();

    // histogram axis & labels
    const ax = prog(t, toW.start, toW.start + 0.6, ease.outExpo);
    if (ax > 0) {
      c.save();
      const x0 = 380, x1 = 450 + 9 * 114 + 70;
      c.strokeStyle = fg(false, 0.7); c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x0, 940); c.lineTo(lerp(x0, x1, ax), 940); c.stroke();
      for (let j = 0; j < 10; j++) {
        const x = 450 + j * 114;
        c.beginPath(); c.moveTo(x, 940); c.lineTo(x, 946); c.stroke();
      }
      c.font = font(F.mono(500), 15); c.globalAlpha = ax;
      c.fillStyle = fg(false, 0.55); c.fillText('WEALTH BY HOUSEHOLD, IN PEAS', x0, 760);
      const rk = prog(t, richW.start, richW.start + 0.25), pk = prog(t, poorW.start, poorW.start + 0.25);
      c.font = font(F.mono(600), 22); c.textAlign = 'center';
      c.fillStyle = rk > 0 ? RED(lerp(0.3, 1, rk)) : fg(false, 0.3); c.fillText('RICH', 450 + 57, 978);
      c.fillStyle = pk > 0 ? fg(false, lerp(0.3, 0.95, pk)) : fg(false, 0.3); c.fillText('POOR', 450 + 114 * 5.5, 978);
      // brackets
      c.strokeStyle = fg(false, 0.4); c.lineWidth = 1;
      c.beginPath(); c.moveTo(410, 954); c.lineTo(410, 958); c.lineTo(450 + 114 + 40, 958); c.lineTo(450 + 114 + 40, 954); c.stroke();
      c.beginPath(); c.moveTo(450 + 2 * 114 - 40, 954); c.lineTo(450 + 2 * 114 - 40, 958); c.lineTo(450 + 9 * 114 + 40, 958); c.lineTo(450 + 9 * 114 + 40, 954); c.stroke();
      c.font = font(F.mono(400), 14); c.textAlign = 'left'; c.fillStyle = fg(false, 0.5);
      c.fillText('20% of households', 410, 1004);
      c.textAlign = 'right'; c.fillText('80% of households', 450 + 9 * 114 + 40, 1004);
      c.restore();
    }
    footnote(c, '² apocryphal; the peas did not object', W - 96, 160, { paper: false, align: 'right', a: capK });
  }

  /** A pea pod: a lens, engraved with a few longitudinal hairlines; `op` lifts the upper valve. */
  drawPod(c: C2D, x: number, y: number, op: number, red: boolean, a: number) {
    const L = red ? 64 : 58, hh = red ? 26 : 21;
    c.save();
    c.globalAlpha = a;
    c.translate(x, y);
    c.lineWidth = 1.3;
    const ink = red ? RED() : fg(false, 0.75);
    // lower valve
    c.strokeStyle = ink;
    c.beginPath(); c.moveTo(-L, 0); c.quadraticCurveTo(0, hh * 2, L, 0); c.stroke();
    c.lineWidth = 0.7; c.strokeStyle = red ? RED(0.55) : fg(false, 0.35);
    for (let k = 1; k <= 3; k++) { c.beginPath(); c.moveTo(-L * 0.85, 1); c.quadraticCurveTo(0, hh * 2 * (1 - k * 0.22), L * 0.85, 1); c.stroke(); }
    // upper valve, hinged at the stalk end (left)
    c.save();
    c.translate(-L, 0); c.rotate(-0.55 * op); c.translate(L, 0);
    c.lineWidth = 1.3; c.strokeStyle = ink;
    c.beginPath(); c.moveTo(-L, 0); c.quadraticCurveTo(0, -hh * 2, L, 0); c.stroke();
    c.lineWidth = 0.7; c.strokeStyle = red ? RED(0.55) : fg(false, 0.35);
    for (let k = 1; k <= 3; k++) { c.beginPath(); c.moveTo(-L * 0.85, -1); c.quadraticCurveTo(0, -hh * 2 * (1 - k * 0.22), L * 0.85, -1); c.stroke(); }
    c.restore();
    // stalk
    c.lineWidth = 1.3; c.strokeStyle = ink;
    c.beginPath(); c.moveTo(-L, 0); c.quadraticCurveTo(-L - 10, -4, -L - 16, -14); c.stroke();
    c.restore();
  }

  // ---------------------------------------------------------------- D: the stele
  secD(f: Frame, c: C2D, ph: number, breath: number, post: PostOverrides) {
    const t = f.t, L = this.L3;
    this.rosette({ cx: 960, cy: 560, s: 1.75 }, t, { rv: [0, 1, 1, 1, 1], twist: 0.2 * Math.sin(ph * 0.7), breath: breath * 0.4, alpha: 0.13, ph, redGain: 0.5 });
    // the slam
    const drop = prog(t, this.tD, this.tD + 0.32, ease.inQuad);
    const land = this.tD + 0.32;
    const dy = (1 - drop) * -1150;
    if (t >= land) {
      const k = Math.exp(-(t - land) * 9);
      post.shake = [Math.sin((t - land) * 90) * 9 * k, Math.cos((t - land) * 70) * 14 * k];
    }
    c.save();
    c.translate(0, dy);
    const x0 = 330, x1 = 1590, top = 165, bot = 935, ch0 = 34;
    this.slabDraw = { dy };


    // row A: "It's a law of the universe," (treatise voice, incised)
    const rowA = L.words.slice(0, 6), rowB = L.words.slice(6).map((w) => ({ ...w, w: w.w.toUpperCase() }));
    this.carvedWords(c, rowA, t, 960, 318, F.serif(600, true), 66, 0.22);
    // formula: chiselled glyph by glyph through "universe,"
    const uni = wordIn(L, 'universe');
    const fk = prog(t, uni.start - 0.15, uni.end);
    this.formula(c, 960, 492, fk);
    // alpha note
    const nk = prog(t, uni.end - 0.4, uni.end);
    if (nk > 0) {
      c.save(); c.globalAlpha = nk;
      c.font = font(F.mono(500), 21); c.textAlign = 'center';
      c.fillStyle = 'rgba(241,235,221,0.25)'; c.fillText('α = log 5 / log 4 ≈ 1.161', 961, 563.4);
      c.fillStyle = 'rgba(18,17,16,0.85)'; c.fillText('α = log 5 / log 4 ≈ 1.161', 960, 562);
      c.restore();
    }
    // the carved curve (through "carved in the")
    const carved = wordIn(L, 'carved');
    const ck = prog(t, carved.start - 0.1, wordIn(L, 'stone').start + 0.1, ease.inOutCubic);
    const cx0 = 820, cy0 = 790, cw = 280, ch = 170;
    if (ck > 0) {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 80; i++) { const x = i / 80; pts.push({ x: cx0 + x * cw, y: cy0 - pareto(x) * ch }); }
      // axes
      this.carvedPolyline(c, [{ x: cx0, y: cy0 - ch - 10 }, { x: cx0, y: cy0 }, { x: cx0 + cw + 10, y: cy0 }], clamp(ck * 3), 1);
      this.carvedPolyline(c, pts, ck, 2.2, ck > 0.25 ? RED(0.9) : undefined);
      if (ck > 0.25) {
        const gk = clamp((ck - 0.25) * 3);
        c.save(); c.globalAlpha = gk;
        c.setLineDash([4, 5]); c.strokeStyle = 'rgba(18,17,16,0.75)'; c.lineWidth = 1;
        const gx = cx0 + 0.2 * cw, gy = cy0 - 0.8 * ch;
        c.beginPath(); c.moveTo(gx, cy0); c.lineTo(gx, gy); c.lineTo(cx0, gy); c.stroke(); c.setLineDash([]);
        c.fillStyle = RED(); c.beginPath(); c.arc(gx, gy, 5, 0, TAU); c.fill();
        c.font = font(F.mono(500), 14); c.fillStyle = 'rgba(18,17,16,0.85)';
        c.textAlign = 'center'; c.fillText('20%', gx, cy0 + 20);
        c.textAlign = 'right'; c.fillText('80%', cx0 - 8, gy + 5);
        c.restore();
      }
    }
    // row B: "CARVED IN THE STONE"
    this.carvedWords(c, rowB, t, 960, 878, F.archivo(112, 900), 58, 0.22, 3, 0.42);
    c.restore();

    // chips flying off the chisel (the glyph being cut)
    footnote(c, '³ P(X > x): the share of anything larger than x', 96, 1000, { paper: false, a: prog(t, uni.start, uni.start + 0.5) });
    // margin note, left
    const mk = prog(t, land + 0.2, land + 0.8);
    if (mk > 0) {
      c.save(); c.globalAlpha = mk;
      c.font = font(F.mono(500), 15); c.fillStyle = fg(false, 0.6);
      c.fillText('FIG. XIII·3', 96, 300);
      c.fillText('THE LAW, AS CARVED', 96, 324);
      c.fillText('MEDIUM: STONE', 96, 360);
      c.fillText('TOLERANCE: NONE', 96, 384);
      c.fillStyle = RED(); c.fillText('REVISIONS: 0', 96, 408);
      c.restore();
    }
  }

  /** Words incised into stone: faint guide before, chiselled (dark + highlight) when sung, key words painted red. */
  carvedWords(c: C2D, words: Word[], t: number, x: number, y: number, fam: string, size: number, dim: number, tracking = 0, space?: number) {
    // highlight (lower lip of the cut)
    karaoke(c, words, t, x + 1.2, y + 1.6, { family: fam, size, paper: false, align: 'center', dim: 0, sung: 'rgba(241,235,221,0.35)', key: 'rgba(255,190,170,0.35)', tracking, lead: 99, space });
    karaoke(c, words, t, x, y, { family: fam, size, paper: true, align: 'center', dim, sung: 'rgba(16,15,14,0.92)', tracking, lead: 99, space });
  }

  /** A polyline incised into stone (dark groove + light lip), revealed to fraction k. */
  carvedPolyline(c: C2D, pts: { x: number; y: number }[], k: number, lw: number, color?: string) {
    if (k <= 0) return;
    const n = Math.max(2, Math.floor(pts.length * clamp(k)));
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [dx, dy, col] of [[1, 1.4, 'rgba(241,235,221,0.28)'], [0, 0, color ?? 'rgba(16,15,14,0.88)']] as const) {
      c.strokeStyle = col; c.lineWidth = lw;
      c.beginPath();
      for (let i = 0; i < n; i++) { const p = pts[i]!; if (i === 0) c.moveTo(p.x + dx, p.y + dy); else c.lineTo(p.x + dx, p.y + dy); }
      c.stroke();
    }
    c.restore();
  }

  /** P(X > x) = (xₘ / x)^α, set in Cormorant italic, chiselled to fraction k (glyph by glyph). */
  formula(c: C2D, cx: number, y: number, k: number) {
    if (k <= 0) return;
    const fam = F.serif(600, true), famR = F.serif(400, false), S = 92;
    // pieces: [text, family, size, dy]
    const P: [string, string, number, number][] = [
      ['P', fam, S, 0], ['(', famR, S, 0], ['X', fam, S, 0], [' > ', famR, S, 0], ['x', fam, S, 0], [')', famR, S, 0],
      [' = ', famR, S, 0], ['(', famR, S, 0], ['x', fam, S, 0], ['m', fam, S * 0.5, 16], [' / ', famR, S, 0], ['x', fam, S, 0], [')', famR, S, 0],
      ['α', fam, S * 0.62, -40],
    ];
    const widths = P.map(([s, f, z]) => (s === 'α' ? z * 0.62 : measure(s, f, z)));
    const total = widths.reduce((a, b) => a + b, 0);
    const nGl = P.reduce((a, [s]) => a + s.replace(/ /g, '').length, 0);
    let x = cx - total / 2, gi = 0;
    const shown = k * nGl;
    c.save();
    c.textBaseline = 'alphabetic';
    P.forEach(([s, f, z, dy], pi) => {
      for (const ch of s) {
        const w = ch === 'α' ? z * 0.62 : measure(ch, f, z);
        if (ch !== ' ') {
          const a = clamp(shown - gi);
          if (a > 0) {
            if (ch === 'α') this.drawAlpha(c, x, y + dy, z, a);
            else {
              c.font = font(f, z);
              c.globalAlpha = a;
              c.fillStyle = 'rgba(241,235,221,0.3)'; c.fillText(ch, x + 1.2, y + dy + 1.6);
              c.fillStyle = 'rgba(16,15,14,0.92)'; c.fillText(ch, x, y + dy);
            }
          }
          gi++;
        }
        x += w;
      }
      void pi;
    });
    c.restore();
  }

  /** α (no font in the kit has it): an italic alpha as a tapered stroke. */
  drawAlpha(c: C2D, x: number, y: number, z: number, a: number) {
    c.save();
    c.globalAlpha = a;
    c.translate(x, y); c.scale(z, z);
    const path = () => {
      c.beginPath();
      c.moveTo(0.60, -0.47);
      c.bezierCurveTo(0.52, -0.25, 0.42, -0.06, 0.26, -0.02);
      c.bezierCurveTo(0.10, 0.02, 0.02, -0.08, 0.04, -0.22);
      c.bezierCurveTo(0.06, -0.38, 0.20, -0.48, 0.32, -0.44);
      c.bezierCurveTo(0.44, -0.40, 0.46, -0.20, 0.52, -0.08);
      c.bezierCurveTo(0.55, -0.02, 0.60, 0.0, 0.66, -0.03);
    };
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.translate(0.012, 0.017); path(); c.lineWidth = 0.075; c.strokeStyle = 'rgba(241,235,221,0.3)'; c.stroke();
    c.translate(-0.012, -0.017); path(); c.strokeStyle = 'rgba(16,15,14,0.92)'; c.stroke();
    c.restore();
  }

  // ---------------------------------------------------------------- E: the vital few zone → collapse
  secE(f: Frame, c: C2D, ph: number, breath: number, post: PostOverrides) {
    const t = f.t, L = this.L4;
    const zone = wordIn(L, 'zone');
    const col0 = zone.end;                 // collapse starts after "zone"
    const col1 = this.ctx.audio.timeOfBeat(Math.round(this.ctx.audio.beatAt(this.tEnd)) - 1); // the snare a beat before the cut
    const enter = prog(t, this.tE, this.tE + 0.6, ease.outExpo);
    const fade = 1 - prog(t, col0 - 0.05, col0 + 0.25, ease.inCubic);

    // stone close-up (the tablet's curve, pushed in)
    if (fade > 0) {
      c.save();
      c.globalAlpha = fade;
      const zs = lerp(1.25, 1.0, enter);
      c.translate(960, 540); c.scale(zs, zs); c.translate(-960, -540);
      this.stoneDraw = { zs, a: fade };
      const x0 = 300, y0 = 900, w = 1320, h = 600;
      // axes
      this.carvedPolyline(c, [{ x: x0, y: y0 - h - 30 }, { x: x0, y: y0 }, { x: x0 + w + 30, y: y0 }], 1, 1.6);
      // red hatching under the head, sweeping up through "vital few"
      const vital = wordIn(L, 'vital'), few = wordIn(L, 'few');
      const hk = prog(t, vital.start - 0.05, few.end, ease.inOutCubic);
      if (hk > 0) {
        c.save();
        const reg = new Path2D();
        reg.moveTo(x0, y0);
        for (let i = 0; i <= 40; i++) { const x = (i / 40) * 0.2; reg.lineTo(x0 + x * w, y0 - pareto(x) * h); }
        reg.lineTo(x0 + 0.2 * w, y0); reg.closePath();
        c.clip(reg);
        c.beginPath(); c.rect(x0, y0 - h * hk - 2, 0.2 * w + 2, h * hk + 4); c.clip();
        c.strokeStyle = RED(0.85); c.lineWidth = 1.6;
        for (let d = -h; d < 0.2 * w + h; d += 9) { c.beginPath(); c.moveTo(x0 + d, y0); c.lineTo(x0 + d + h, y0 - h); c.stroke(); }
        c.restore();
      }
      // the curve, re-cut (pen runs through "You reap what you")
      const sow = wordIn(L, 'sow');
      const rk = prog(t, this.tE, sow.start, ease.inOutCubic);
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 160; i++) { const x = i / 160; pts.push({ x: x0 + x * w, y: y0 - pareto(x) * h }); }
      this.carvedPolyline(c, pts, rk, 5, RED());
      if (rk > 0.2) {
        const gk = clamp((rk - 0.2) * 4);
        c.save(); c.globalAlpha = gk;
        c.setLineDash([6, 7]); c.strokeStyle = 'rgba(241,235,221,0.55)'; c.lineWidth = 1;
        const gx = x0 + 0.2 * w, gy = y0 - 0.8 * h;
        c.beginPath(); c.moveTo(gx, y0); c.lineTo(gx, gy); c.lineTo(x0, gy); c.stroke(); c.setLineDash([]);
        c.font = font(F.mono(500), 17); c.fillStyle = fg(false, 0.8);
        c.textAlign = 'center'; c.fillText('20% OF CAUSES', gx, y0 + 34);
        c.textAlign = 'right'; c.fillText('80%', x0 - 14, gy + 6);
        c.textAlign = 'left'; c.fillText('OF EFFECTS', x0 + 14, gy - 14);
        c.textAlign = 'right'; c.fillStyle = fg(false, 0.5); c.fillText('THE TRIVIAL MANY →', x0 + w, y0 - h - 18);
        c.restore();
      }
      // seeds sown on "sow": 100 along the axis; the first 20 turn red with the hatching
      const sk = prog(t, sow.start, sow.end + 0.2);
      for (let i = 0; i < 100; i++) {
        const k = clamp(sk * 100 - i * 0.8);
        if (k <= 0) continue;
        const x = x0 + (i + 0.5) / 100 * w, y = y0 + 58;
        const red = i < 20 && hk > (i / 20) * 0.6;
        c.fillStyle = red ? RED() : 'rgba(241,235,221,0.55)';
        c.beginPath(); c.arc(x, y - (1 - ease.outBack(k)) * 16, red ? 3.4 : 2.4, 0, TAU); c.fill();
      }
      c.restore();

      // the lyric: incised row top left, then “vital few” zone big in the tail
      c.save();
      const row = L.words.slice(0, 7);
      karaoke(c, row, t, 420, 216, { family: F.archivo(100, 700), size: 62, paper: false, dim: 0.3, lead: 9, alpha: fade * enter, isKeyFn: () => false });
      const vf = L.words.slice(7);
      karaoke(c, vf, t, 700, 600, { family: F.archivo(112, 900), size: 128, paper: false, dim: 0.22, lead: 9, alpha: fade * enter, isKeyFn: (w) => ['vital', 'few'].includes(wkey(w.w)) });
      // VITAL FEW label inside the head
      const lk = prog(t, few.end - 0.1, few.end + 0.3);
      if (lk > 0) {
        c.save(); c.globalAlpha = fade * lk;
        c.translate(x0 + 0.1 * w, 760); c.rotate(-Math.PI / 2);
        c.font = font(F.mono(600), 22); c.textAlign = 'center'; c.fillStyle = fg(false, 0.95);
        c.fillText('VITAL FEW', 0, 8);
        c.restore();
      }
      c.restore();
    }

    // the swirl returns, tightens, and collapses into the red dot
    const sw = prog(t, col0 - 0.25, col0 + 0.1, ease.outCubic);
    if (sw > 0) {
      const coll = prog(t, col0, col1, ease.inCubic);
      const twist = lerp(0.3, 2.6, ease.inCubic(prog(t, col0 - 0.25, col1)));
      // keep the hairlines hairlines: thin the ink as the rings crowd together
      this.rosette({ cx: 960, cy: 540, s: lerp(2.4, 1.3, sw) }, t, { rv: [1, 1, 1, 1, 1], twist, breath, alpha: sw * (1 - 0.75 * coll), ph: ph * (1 + 3 * coll), collapse: coll, redGain: 1 + coll });
    }
    const dotK = t < col1 - 0.08 ? 0 : prog(t, col1 - 0.08, col1 + 0.05, ease.outBack);
    if (dotK > 0) {
      const r = 16 * dotK * (1 + 0.25 * Math.exp(-Math.max(0, t - col1) * 8));
      c.fillStyle = RED();
      c.beginPath(); c.arc(960, 540, r, 0, TAU); c.fill();
      footnote(c, '∴ the few', 960, 600, { paper: false, align: 'center', a: dotK * 0.8 });
      post.bloom = 0.8;
    }
  }
}
