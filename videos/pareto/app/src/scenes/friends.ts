// PLATE IX — "Census of acquaintances". Bone paper; four reframings, one per line:
//  1. "Most of my friends are just background noise": a census ledger. Ten figures stamp in one per 16th,
//     numbered No. 01–10; on "background" eight of them recede; on "noise" those eight dissolve into
//     flickering static; the two that remain are solid; SIGNAL 20% / NOISE 80% bar.
//  2. "Chasing the shadows and the plastic toys": side view. The eight (static) run on the spot; on
//     "shadows" their shadows peel off the ground and escape to the right; on "plastic" / "toys" plastic
//     toys drop on the beats and bounce, each with a deadpan price tag. The two stand aside, not chasing.
//  3. "But there's two out of ten who'd pull me from the rain": grey paper, rain (falling hairlines),
//     words drop in like raindrops. ME alone in front, the ten behind; on "two" two turn red; on "pull"
//     they come forward and lift me out of the puddle; on "rain" a red umbrella forms and the rain stops
//     under it.
//  4. "The rest is just static, a beautiful drain.": the eight static clouds spiral down a drain; the
//     three stay dry at the side; the drain's ink grows and swallows the page into the (dark) chorus 2.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { type Line, type Word } from '../engine/lyrics';
import { clamp, ease, frameIdx, hash, lerp, mulberry32, prog, TAU } from '../engine/util';
import { Ground, drawKaraokeWords, drawPlateHead, drawFifthBar, footnote, wrapWords, fg, RED, PAPER_POST, INK_POST, type C2D } from './_kit';
import { beats, camera, figure, mono, steps, typed, wd } from './park-lib';

const INK = (a = 1) => rgba('ink', a);
const ASH = (a = 1) => rgba('ash', a);
const GRAPH = (a = 1) => rgba('graphite', a);
const VITAL = [3, 7];
const isV = (i: number) => VITAL.includes(i);

/** Points filling a unit-height figure (feet at 0,0), matching park-lib's figure() geometry. */
function figurePoints(n: number, seed: number) {
  const rnd = mulberry32(seed);
  const head = 0.13, bodyH = 0.42, bw = 0.2, legH = 0.32;
  const by = -legH - bodyH, hy = by - head * 1.25;
  const pts: { x: number; y: number; h: number }[] = [];
  let guard = 0;
  while (pts.length < n && guard++ < n * 40) {
    const x = (rnd() - 0.5) * 0.3, y = -rnd() * 1.0;
    let inside = false;
    if (Math.hypot(x, y - hy) < head) inside = true;
    const yy = clamp(y, by + bw / 2, -legH + bw * 0.2 - bw / 2);
    if (Math.hypot(x, y - yy) < bw / 2 && y >= by && y <= -legH + bw * 0.2) inside = true;
    if (y > -legH && (Math.abs(x - bw * 0.22) < bw * 0.16 || Math.abs(x + bw * 0.22) < bw * 0.16)) inside = true;
    if (inside) pts.push({ x, y, h: rnd() });
  }
  return pts;
}

export default class Friends extends Scene {
  g = new Ground();
  L = new Layer2D();
  l1!: Line; l2!: Line; l3!: Line; l4!: Line;
  T = {
    c2: 0, c3: 0, c4: 0, pops: [] as number[], friends: 0, background: 0, noise: 0,
    shadows: 0, plastic: 0, toys: [] as number[], two: 0, ten: 0, pull: 0, me: 0, rain: 0, rainEnd: 0,
    stat: 0, drain: 0, swallow: 0, beats: [] as number[], downs: [] as number[],
  };
  pts: { x: number; y: number; h: number }[][] = [];

  override init() {
    const ly = this.ctx.lyrics, au = this.ctx.audio, B = beats(au), T = this.T;
    this.l1 = ly.get('Most of my friends');
    this.l2 = ly.get('Chasing the shadows');
    this.l3 = ly.get('two out of ten');
    this.l4 = ly.get('beautiful drain');
    T.c2 = B.near(this.l1.end + 0.2);
    T.c3 = B.near(this.l2.end + 0.1);
    T.c4 = (this.l3.end + this.l4.start) / 2;
    const b16 = 60 / au.bpm / 4;
    T.pops = Array.from({ length: 10 }, (_, i) => this.ctx.start + i * b16);
    T.friends = wd(this.l1, 'friends').start;
    T.background = wd(this.l1, 'background').start;
    T.noise = wd(this.l1, 'noise').start;
    T.shadows = wd(this.l2, 'shadows').start;
    T.plastic = wd(this.l2, 'plastic').start;
    const tb = B.before(T.plastic + 0.1);
    T.toys = [0, 1, 2, 3].map((i) => tb + i * b16 * 2);
    T.two = wd(this.l3, 'two').start;
    T.ten = wd(this.l3, 'ten').start;
    T.pull = wd(this.l3, 'pull').start;
    T.me = wd(this.l3, 'me').start;
    T.rain = wd(this.l3, 'rain').start;
    T.rainEnd = this.l3.end;
    T.stat = wd(this.l4, 'static').start;
    T.drain = wd(this.l4, 'drain').start;
    T.swallow = B.before(this.ctx.end - 0.05);
    T.beats = B.list(this.ctx.start - 0.01, this.ctx.end + 0.01);
    T.downs = au.downbeats.filter((d) => d >= this.ctx.start - 0.01 && d < this.ctx.end);
    for (let i = 0; i < 10; i++) this.pts.push(figurePoints(320, 100 + i));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, T = this.T;
    const rainy = t >= T.c3 && t < T.c4;
    this.g.render(renderer, out, { paper: rainy ? 0.84 : 1, vig: rainy ? 0.35 : 0.2, grid: rainy ? 0 : 0 });
    const c = this.L.ctx; this.L.clear();
    let post: PostOverrides = { ...PAPER_POST, bloom: 0.2 };
    if (t < T.c2) this.f1(c, t);
    else if (t < T.c3) this.f2(c, t);
    else if (t < T.c4) this.f3(c, t);
    else post = this.f4(c, t);
    if (t < T.c4 + 0.0) drawPlateHead(c, 9, 'Census of acquaintances', (t - this.ctx.start) / 0.6, { paper: true, right: this.headRight(t) });
    comp.draw(renderer, this.L.upload(), out);
    return post;
  }

  headRight(t: number) {
    const T = this.T;
    if (t < T.c2) return 'TABLE 1 — FRIENDS, ENUMERATED';
    if (t < T.c3) return 'TABLE 2 — PURSUITS';
    return 'TABLE 3 — WEATHER RESPONSE';
  }

  /** A figure that can dissolve into static (k 0..1). */
  staticFig(c: C2D, i: number, x: number, y: number, h: number, k: number, col: string, t: number, o: { lean?: number; stride?: number; arms?: [number, number]; spread?: number } = {}) {
    if (k < 1) {
      c.save(); c.globalAlpha = 1 - k;
      figure(c, x, y, h, { fill: col, lean: o.lean, stride: o.stride, arms: o.arms });
      c.restore();
    }
    if (k > 0) {
      const fi = frameIdx(t);
      const ps = this.pts[i]!;
      const sp = o.spread ?? 0;
      const lean = o.lean ?? 0, cs = Math.cos(lean), sn = Math.sin(lean);
      c.fillStyle = col;
      for (let j = 0; j < ps.length; j++) {
        const p = ps[j]!;
        const fl = hash(fi, j, i);
        if (fl > 0.55 + 0.35 * k) continue;
        const jx = (hash(j, fi, 3) - 0.5) * (3 + sp * 40), jy = (hash(fi, j, 5) - 0.5) * (3 + sp * 40);
        const px = p.x * h, py = p.y * h;
        const rx = px * cs - py * sn, ry = px * sn + py * cs;
        const s = 2.2 + 2 * p.h;
        c.globalAlpha = k * (0.35 + 0.65 * hash(j, fi));
        c.fillRect(x + rx + jx - s / 2, y + ry + jy - s / 2, s, s);
      }
      c.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- 1. the census
  f1(c: C2D, t: number) {
    const T = this.T, t0 = this.ctx.start, l = this.l1;
    const z = 1 + 0.06 * (1 - ease.outExpo(prog(t, t0, t0 + 0.5))) + 0.015 * steps(t, T.downs, 0.35);
    c.save(); camera(c, 960, 540, z);
    // lyric
    const rows = wrapWords(l.words, F.archivo(100, 800), 104, 1500);
    let y = 220;
    for (const row of rows) { drawKaraokeWords(c, row, t, 210, y, { family: F.archivo(100, 800), size: 104, paper: true, dim: 0.2, lead: row[0]!.start - l.start + 0.4 }); y += 112; }
    // ledger rules
    const X0 = 160, X1 = 1760, G = 790;
    c.strokeStyle = INK(0.75); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(X0, G + 0.5); c.lineTo(X1, G + 0.5); c.stroke();
    c.strokeStyle = INK(0.3); c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i <= 10; i++) { const x = X0 + i * 160; c.moveTo(x + 0.5, G + 6); c.lineTo(x + 0.5, G + 120); }
    c.moveTo(X0, G + 46.5); c.lineTo(X1, G + 46.5); c.moveTo(X0, G + 120.5); c.lineTo(X1, G + 120.5);
    c.stroke();
    mono(c, 'No.', X0 - 12, G + 32, 13, INK(0.6), 'right');
    mono(c, 'RELIABLE?', X0 - 12, G + 90, 13, INK(0.6), 'right');
    const bg = ease.inOutCubic(prog(t, T.background, T.background + 0.5));
    const nz = ease.outCubic(prog(t, T.noise - 0.05, T.noise + 0.35));
    for (let i = 0; i < 10; i++) {
      const x = X0 + 80 + i * 160;
      const k = ease.outBack(prog(t, T.pops[i]!, T.pops[i]! + 0.25));
      if (k <= 0) continue;
      const v = isV(i);
      const h = 300 * k * (v ? 1 : 1 - 0.1 * bg);
      const col = v ? INK(1) : bg > 0 ? `rgba(${Math.round(lerp(12, 156, bg))},${Math.round(lerp(12, 151, bg))},${Math.round(lerp(14, 143, bg))},1)` : INK(1);
      this.staticFig(c, i, x, G - (v ? 0 : 26 * bg), h, v ? 0 : nz, col, t);
      mono(c, `${String(i + 1).padStart(2, '0')}`, x, G + 32, 15, INK(0.8 * k), 'center', 'Plex-600');
      // reliability marks after "noise"
      const mk = prog(t, T.noise + 0.35 + i * 0.04, T.noise + 0.55 + i * 0.04);
      if (mk > 0) {
        c.strokeStyle = v ? RED() : INK(0.55); c.lineWidth = 2.5; c.lineCap = 'round';
        c.beginPath();
        if (v) { c.moveTo(x - 14, G + 84); c.lineTo(x - 4, G + 96 * 1); c.lineTo(lerp(x - 4, x + 16, mk), lerp(G + 96, G + 70, mk)); }
        else { c.moveTo(x - 10, G + 74); c.lineTo(lerp(x - 10, x + 10, mk), lerp(G + 74, G + 96, mk)); if (mk > 0.5) { c.moveTo(x + 10, G + 74); c.lineTo(lerp(x + 10, x - 10, (mk - 0.5) * 2), lerp(G + 74, G + 96, (mk - 0.5) * 2)); } }
        c.stroke();
      }
    }
    // bracket on "friends"
    const bk = ease.outExpo(prog(t, T.friends, T.friends + 0.45));
    if (bk > 0) {
      const yb = 420, xm = 960;
      c.strokeStyle = INK(0.6); c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(X0 + 20, yb + 10); c.lineTo(X0 + 20, yb); c.lineTo(lerp(X0 + 20, xm - 120, bk), yb);
      c.moveTo(X1 - 20, yb + 10); c.lineTo(X1 - 20, yb); c.lineTo(lerp(X1 - 20, xm + 120, bk), yb);
      c.stroke();
      mono(c, typed('FRIENDS, n = 10', prog(t, T.friends + 0.1, T.friends + 0.5)), xm, yb + 5, 15, INK(0.8), 'center', 'Plex-600');
    }
    c.restore();
    // signal / noise bar
    const sk = prog(t, T.noise + 0.2, T.noise + 0.6);
    if (sk > 0) {
      drawFifthBar(c, 1310, 990, 450, 10, { paper: true, fill: ease.outExpo(sk), split: prog(t, T.noise + 0.4, T.noise + 0.8), red: 'right' });
      mono(c, 'NOISE 80%', 1310, 975, 13, INK(0.65 * sk));
      mono(c, 'SIGNAL 20%', 1760, 975, 13, RED(sk), 'right', 'Plex-600');
    }
    footnote(c, '¹ Census taken on a Tuesday. Acquaintances counted once, regardless of how often they text.', 96, 1016, { paper: true, a: prog(t, t0 + 0.4, t0 + 1.2) });
  }

  // ---------------------------------------------------------------- 2. pursuits
  f2(c: C2D, t: number) {
    const T = this.T, t0 = T.c2, l = this.l2;
    const z = 1 + 0.05 * (1 - ease.outExpo(prog(t, t0, t0 + 0.5))) + 0.015 * steps(t, T.downs.filter((d) => d > t0), 0.35);
    const CY = 600; // content sits a little high in the frame
    c.save(); camera(c, 960, CY, z);
    const G = 640, FH = 320, LY = G + 165, TG = G + 330;
    // scrolling ground dashes (they run on the spot; the world goes by)
    const run = t - t0;
    c.strokeStyle = INK(0.7); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-100, G + 0.5); c.lineTo(2020, G + 0.5); c.stroke();
    c.strokeStyle = INK(0.3);
    c.beginPath();
    const off = (run * 420) % 80;
    for (let x = -off; x < 2000; x += 80) { c.moveTo(x, G + 22); c.lineTo(x + 30, G + 22); }
    c.stroke();
    // the two, standing aside
    for (const [j, i] of VITAL.entries()) figure(c, 180 + j * 130, G, FH * 0.95, { fill: INK(1) });
    c.strokeStyle = INK(0.5); c.lineWidth = 1;
    c.beginPath(); c.moveTo(120, G + 34); c.lineTo(380, G + 34); c.stroke();
    mono(c, 'Nos. 04, 08 — NOT CHASING', 120, G + 56, 13, INK(0.75), 'left', 'Plex-600');
    // the eight: running, static; shadows peel off on "shadows"
    const peel = prog(t, T.shadows, T.shadows + 1.4);
    const lean = 0.18 * ease.outCubic(prog(t, t0, t0 + 0.4)) + 0.1 * ease.outCubic(prog(t, T.shadows, T.shadows + 0.4));
    let j = 0;
    for (let i = 0; i < 10; i++) {
      if (isV(i)) continue;
      const x = 640 + j * 152;
      const ph = run * 4.2 * TAU / 2.5 + j * 1.3;
      const bob = Math.abs(Math.sin(ph)) * 8;
      // shadow: a skewed ink capsule on the ground (light from the upper left)
      const sx = x + 40 + (ease.inQuad(clamp(peel * 1.3 - j * 0.04)) * 1500);
      c.save();
      c.translate(sx, G);
      c.transform(1, 0, -1.2, 0.22, 0, 0);
      c.globalAlpha = 0.38;
      figure(c, 0, 0, FH, { fill: INK(1), stride: Math.sin(ph) });
      c.restore();
      this.staticFig(c, i, x, G - bob, FH, 1, GRAPH(1), t, { lean, stride: Math.sin(ph) });
      j++;
    }
    const sk = prog(t, T.shadows + 0.4, T.shadows + 0.9);
    if (sk > 0) mono(c, typed('SHADOWS CAUGHT: 0 of 8', sk), 1760, G + 56, 13, INK(0.75), 'right', 'Plex-600');
    // toys drop on the beats
    const toys = [
      { x: 760, label: 'BALL, PLASTIC · 80p', kind: 0 },
      { x: 1040, label: 'CAR, PLASTIC · £1.20', kind: 1 },
      { x: 1320, label: 'BRICK · 20p', kind: 2 },
      { x: 1560, label: 'SPINNING TOP · 50p', kind: 3 },
    ];
    toys.forEach((ty, i) => {
      const td = T.toys[i]!;
      if (t < td - 0.25) return;
      const u = t - (td - 0.25);
      // fall 0.25 s to land on the beat, then decaying bounces
      let yy: number;
      if (u < 0.25) yy = lerp(-60, 0, (u / 0.25) ** 2);
      else { const b = u - 0.25; yy = -Math.abs(Math.sin(b * 9)) * 70 * Math.exp(-b * 5); }
      const ground = TG;
      c.save();
      c.translate(ty.x, ground + yy); c.scale(1.45, 1.45);
      c.globalAlpha = clamp(u / 0.12);
      c.fillStyle = i === 1 ? RED() : INK(0.85);
      c.strokeStyle = INK(0.9); c.lineWidth = 2;
      if (ty.kind === 0) { c.beginPath(); c.arc(0, -26, 26, 0, TAU); c.fill(); c.strokeStyle = rgba('bone', 0.8); c.beginPath(); c.arc(0, -26, 26, -0.6, 0.6); c.stroke(); }
      else if (ty.kind === 1) {
        c.beginPath(); c.roundRect(-44, -36, 88, 24, 6); c.fill();
        c.beginPath(); c.roundRect(-22, -54, 44, 22, 6); c.fill();
        c.fillStyle = INK(1); c.beginPath(); c.arc(-26, -10, 10, 0, TAU); c.arc(26, -10, 10, 0, TAU); c.fill();
      } else if (ty.kind === 2) {
        c.fillRect(-30, -36, 60, 36);
        c.fillStyle = INK(1); for (let k = 0; k < 3; k++) c.fillRect(-26 + k * 20, -44, 13, 8);
      } else {
        c.rotate(Math.sin(t * 20) * 0.06);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(-32, -22); c.quadraticCurveTo(0, -46, 32, -22); c.closePath(); c.fill();
        c.fillRect(-3, -52, 6, 20);
        c.strokeStyle = rgba('bone', 0.6); c.lineWidth = 1.5; c.beginPath(); c.moveTo(-26, -24); c.quadraticCurveTo(0, -34, 26, -24); c.stroke();
      }
      c.restore();
      const lk = prog(t, td + 0.05, td + 0.4);
      mono(c, typed(ty.label, lk), ty.x, ground + 30, 13, i === 1 ? RED() : INK(0.75), 'center', 'Plex-600');
    });
    // lyric along the bottom; "shadows" gets a cast shadow of its own
    const fam = F.archivo(100, 800), size = 82;
    // toys' ground
    c.strokeStyle = INK(0.35); c.lineWidth = 1;
    c.beginPath(); c.moveTo(560, TG + 0.5); c.lineTo(1820, TG + 0.5); c.stroke();
    const boxes = drawKaraokeWords(c, l.words, t, 960, LY, { family: fam, size, paper: true, dim: 0.2, lead: 0.4, align: 'center' });
    void boxes;
    c.restore();
    // the word "shadows": skewed ink copy (drawn under via destination-over)
    const w = l.words.find((ww) => ww.w.toLowerCase().startsWith('shadows'))!;
    const p = prog(t, w.start, w.end);
    if (p > 0) {
      c.save(); camera(c, 960, CY, z);
      // recompute the word's position: lay the line out the same way
      c.font = font(fam, size);
      const sp = c.measureText(' ').width;
      const ws = l.words.map((ww) => c.measureText(ww.w).width);
      const total = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1);
      let x = 960 - total / 2;
      for (let i = 0; i < l.words.length; i++) { if (l.words[i] === w) break; x += ws[i]! + sp; }
      c.globalCompositeOperation = 'destination-over';
      c.translate(x, 805); c.transform(1, 0, -1.1, 0.3, 0, 0);
      c.fillStyle = INK(0.18 * ease.outCubic(p));
      c.fillText(w.w, 0, 0);
      c.restore();
    }
  }

  // ---------------------------------------------------------------- 3. the rain
  f3(c: C2D, t: number) {
    const T = this.T, t0 = T.c3, l = this.l3;
    const z = 1 + 0.05 * (1 - ease.outExpo(prog(t, t0, t0 + 0.5))) + 0.02 * ease.outExpo(prog(t, T.pull, T.pull + 0.4)) + 0.02 * ease.outExpo(prog(t, T.rain, T.rain + 0.4));
    c.save(); camera(c, 960, 540, z);
    const GB = 800, GF = 975;
    // umbrella geometry (forms on "rain")
    const uk = ease.outBack(prog(t, T.rain - 0.05, T.rain + 0.35));
    const U = { x: 960, y: 630, r: 235 };
    // rain: slanted hairlines; under the umbrella it stops
    const fi = frameIdx(t);
    c.strokeStyle = GRAPH(0.55); c.lineWidth = 1.1;
    c.beginPath();
    for (let i = 0; i < 260; i++) {
      const sp = 1500 + 600 * hash(i, 2);
      const x0 = hash(i, 1) * 2300 - 200;
      const yy = ((hash(i, 3) * 1300 + (t - t0) * sp) % 1300) - 150;
      const len = 30 + 30 * hash(i, 4);
      const x = x0 - yy * 0.18;
      let y1 = yy + len;
      if (uk > 0.5 && Math.abs(x - U.x) < U.r * uk && y1 > U.y - 40) {
        if (yy > U.y - 40) continue;
        y1 = Math.min(y1, U.y - 40 - Math.sqrt(Math.max(0, U.r * U.r * uk * uk - (x - U.x) ** 2)) * 0.5);
      }
      c.moveTo(x, yy); c.lineTo(x - len * 0.18, y1);
    }
    c.stroke();
    void fi;
    // lyric: words drop like raindrops onto their line
    const rows = wrapWords(l.words, F.archivo(100, 800), 100, 1520);
    let y = 210;
    for (const row of rows) {
      // draw word by word to drop each in
      c.font = font(F.archivo(100, 800), 100);
      drawKaraokeWords(c, row, t, 200, y, { family: F.archivo(100, 800), size: 100, paper: true, dim: 0.18, lead: row[0]!.start - l.start + 0.4 });
      y += 110;
    }
    // ground lines
    c.strokeStyle = INK(0.35); c.lineWidth = 1;
    c.beginPath(); c.moveTo(150, GB + 0.5); c.lineTo(1770, GB + 0.5); c.stroke();
    c.strokeStyle = INK(0.7); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(100, GF + 0.5); c.lineTo(1820, GF + 0.5); c.stroke();
    // puddle under ME
    const lift = ease.inOutCubic(prog(t, T.me, T.me + 0.5));
    c.fillStyle = GRAPH(0.35 * (1 - 0.6 * lift));
    c.beginPath(); c.ellipse(960, GF + 8, 160, 16, 0, 0, TAU); c.fill();
    // ripples
    for (let k = 0; k < 3; k++) {
      const ph = ((t - t0) * 1.6 + k / 3) % 1;
      c.strokeStyle = INK(0.3 * (1 - ph)); c.lineWidth = 1;
      c.beginPath(); c.ellipse(900 + k * 60, GF + 8, 10 + 50 * ph, 3 + 6 * ph, 0, 0, TAU); c.stroke();
    }
    // the ten, behind
    const twoK = ease.outCubic(prog(t, T.two, T.two + 0.3));
    const come = ease.inOutCubic(prog(t, T.pull - 0.1, T.pull + 0.55));
    for (let i = 0; i < 10; i++) {
      const xb = 960 + (i - 4.5) * 150;
      if (isV(i)) {
        const side = i === VITAL[0] ? -1 : 1;
        const x = lerp(xb, 960 + side * 150, come);
        const yy = lerp(GB, GF, come);
        const h = lerp(170, 230, come);
        const armUp = Math.PI * 0.62 * ease.outCubic(prog(t, T.me - 0.1, T.me + 0.3));
        const col = twoK > 0 ? RED() : GRAPH(0.9);
        figure(c, x, yy, h, { fill: col, arms: side < 0 ? [0.2, armUp] : [armUp, 0.2] });
      } else {
        this.staticFig(c, i, xb, GB, 170, 0.85, GRAPH(0.9), t);
      }
    }
    // ME, in front, lifted out of the puddle
    figure(c, 960, GF - 50 * lift, 240, { fill: INK(1), arms: [Math.PI * 0.55 * lift, Math.PI * 0.55 * lift] });
    mono(c, 'ME', 960, GF + 44, 14, INK(0.8), 'center', 'Plex-600');
    // umbrella: a red canopy, four scallops of ink trim
    if (uk > 0) {
      c.save();
      c.translate(U.x, U.y); c.scale(uk, uk);
      c.fillStyle = RED();
      c.beginPath();
      c.arc(0, 0, U.r, Math.PI, 0);
      const n = 5;
      for (let k = n; k > 0; k--) {
        const xa = -U.r + (k - 0.5) * (2 * U.r / n);
        c.arc(xa, 0, U.r / n, 0, Math.PI, true);
      }
      c.closePath(); c.fill();
      c.strokeStyle = rgba('blood', 0.9); c.lineWidth = 2;
      c.beginPath();
      for (let k = 1; k < n; k++) { const xa = -U.r + k * (2 * U.r / n); c.moveTo(0, -U.r); c.quadraticCurveTo(xa * 0.6, -U.r * 0.55, xa, 0); }
      c.stroke();
      c.strokeStyle = INK(0.9); c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, -U.r); c.lineTo(0, -U.r - 24); c.stroke();
      c.restore();
    }
    // annotations
    const ck = prog(t, T.ten, T.ten + 0.4);
    if (ck > 0) {
      mono(c, typed('2 OF 10', ck), 1700, 560, 22, RED(), 'right', 'Plex-700');
      mono(c, typed('WOULD PULL YOU FROM THE RAIN', prog(t, T.ten + 0.2, T.ten + 0.7)), 1700, 586, 13, INK(0.75), 'right', 'Plex-600');
    }
    const pk = prog(t, T.rain + 0.3, T.rain + 0.8);
    if (pk > 0) mono(c, typed('PRECIPITATION ON SUBJECT: 0%', pk), 220, 586, 13, INK(0.8), 'left', 'Plex-600');
    c.restore();
    mono(c, typed('¹ Rain: British, persistent. Umbrella assembled on site by Nos. 04 and 08.', prog(t, T.rain + 0.5, T.rain + 1.2)), 1700, 612, 12, INK(0.55), 'right', 'Plex-400');
  }

  // ---------------------------------------------------------------- 4. the drain
  f4(c: C2D, t: number): PostOverrides {
    const T = this.T, t0 = T.c4, l = this.l4;
    const D = { x: 1150, y: 690 };
    const z = 1 + 0.05 * (1 - ease.outExpo(prog(t, t0, t0 + 0.5))) + 0.015 * steps(t, T.downs.filter((d) => d > t0), 0.35);
    c.save(); camera(c, 960, 540, z);
    const spin = (t - t0) * (1.2 + 2.5 * prog(t, T.stat, this.ctx.end, ease.inQuad));
    // vortex: log-spiral arms
    const vk = ease.outCubic(prog(t, t0, t0 + 0.6));
    c.lineWidth = 1;
    for (let a = 0; a < 7; a++) {
      c.strokeStyle = INK(0.28 * vk);
      c.beginPath();
      for (let s = 0; s <= 60; s++) {
        const r = 20 * Math.exp(s * 0.055) * vk;
        const th = a * (TAU / 7) + s * 0.12 - spin;
        const x = D.x + Math.cos(th) * r, y = D.y + Math.sin(th) * r * 0.55;
        s ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    }
    // the ink hole grows; at the end it swallows the page
    const sw = ease.inCubic(prog(t, T.swallow, this.ctx.end));
    const hr = lerp(30 + 20 * prog(t, T.stat, T.drain), 2400, sw);
    c.fillStyle = INK(1);
    c.beginPath(); c.ellipse(D.x, D.y, hr, hr * lerp(0.55, 1, sw), 0, 0, TAU); c.fill();
    // grate
    if (sw < 0.3) {
      c.strokeStyle = rgba('bone', 0.6); c.lineWidth = 2;
      c.beginPath();
      for (let k = -2; k <= 2; k++) { c.moveTo(D.x + k * 10, D.y - 12); c.lineTo(D.x + k * 10, D.y + 12); }
      c.stroke();
    }
    // the eight static clouds spiralling in
    let j = 0;
    for (let i = 0; i < 10; i++) {
      if (isV(i)) continue;
      const x0 = 660 + j * 150, y0 = 900;
      const dk = prog(t, T.stat - 0.6 + j * 0.12, T.drain + 0.6 + j * 0.05, ease.inCubic);
      const r0 = Math.hypot(x0 - D.x, (y0 - D.y) / 0.55);
      const th0 = Math.atan2((y0 - D.y) / 0.55, x0 - D.x);
      const r = r0 * (1 - dk);
      const th = th0 - dk * 5.5;
      const x = D.x + Math.cos(th) * r, y = D.y + Math.sin(th) * r * 0.55 + 0;
      const h = 190 * (1 - 0.85 * dk);
      if (dk < 0.98) this.staticFig(c, i, x, y, h, 1, GRAPH(1), t, { lean: -dk * 3, spread: dk * 0.6 });
      j++;
    }
    // the three, dry, at the side
    const G = 900;
    c.strokeStyle = INK(0.6); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(150, G + 0.5); c.lineTo(520, G + 0.5); c.stroke();
    figure(c, 230, G, 170, { fill: RED() });
    figure(c, 335, G, 175, { fill: INK(1) });
    figure(c, 440, G, 170, { fill: RED() });
    mono(c, 'KEPT: 2 (+ ME)', 335, G + 34, 13, INK(0.8), 'center', 'Plex-600');
    const rk = prog(t, T.stat + 0.3, T.stat + 0.8);
    if (rk > 0) {
      mono(c, typed('DRAIN RATE: 8 FRIENDS / 3.2 s', rk), 1760, 470, 13, INK(0.8), 'right', 'Plex-600');
      mono(c, typed('FLOW: CLOCKWISE (NORTHERN HEMISPHERE)', prog(t, T.stat + 0.6, T.stat + 1.1)), 1760, 492, 13, INK(0.6), 'right');
    }
    // lyric: ink on paper, bone where the hole has reached it
    const rows = wrapWords(l.words, F.archivo(100, 800), 108, 1520);
    const drawRows = (paper: boolean) => {
      let y = 230;
      for (const row of rows) {
        drawKaraokeWords(c, row, t, 200, y, { family: F.archivo(100, 800), size: 108, paper, dim: 0.2, lead: row[0]!.start - l.start + 0.4 });
        y += 118;
      }
    };
    drawRows(true);
    if (sw > 0) {
      c.save();
      c.beginPath(); c.ellipse(D.x, D.y, hr, hr * lerp(0.55, 1, sw), 0, 0, TAU); c.clip();
      drawRows(false);
      c.restore();
    }
    c.restore();
    footnote(c, '¹ The rest: eight of ten. Beautiful, on balance. Plumbing not to scale.', 96, 1016, { paper: true, a: prog(t, t0 + 0.3, t0 + 1) * (1 - sw) });
    drawPlateHead(c, 9, 'Census of acquaintances', 1, { paper: sw < 0.5, right: 'TABLE 4 — DISPOSAL' });
    return sw > 0.9 ? { ...INK_POST, bloom: 0.3, bloomThreshold: 0.95 } : { ...PAPER_POST, bloom: 0.2 };
  }
}
void fg;
export type _W = Word;
